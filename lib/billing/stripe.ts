// Server-only. Stripe billing for plan changes, pause and cancel.
// Switched OFF until STRIPE_SECRET_KEY is set and a family has a Stripe subscription — until then every call is
// skipped and the app's own records are the source of truth. Must be tested in Stripe TEST MODE before going live.
// Policy: no refunds, ever — nothing here creates a credit or refund.

const KEY = process.env.STRIPE_SECRET_KEY
export const stripeEnabled = () => !!KEY

type Result = { ok: true; skipped?: boolean } | { ok: false; error: string }

async function stripe(path: string, params: Record<string, string> = {}, method: 'GET' | 'POST' | 'DELETE' = 'POST') {
  const body = new URLSearchParams(params).toString()
  const res = await fetch(`https://api.stripe.com/v1/${path}${method === 'GET' && body ? `?${body}` : ''}`, {
    method,
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: method === 'GET' ? undefined : body,
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json?.error?.message || `Stripe error ${res.status}`)
  return json
}

async function guarded(subId: string | null | undefined, fn: (subId: string) => Promise<unknown>): Promise<Result> {
  if (!KEY || !subId) return { ok: true, skipped: true }
  try { await fn(subId); return { ok: true } } catch (e: any) { return { ok: false, error: e.message } }
}

const firstItemId = async (subId: string) => (await stripe(`subscriptions/${subId}`, {}, 'GET')).items.data[0].id as string

// Upgrade now: switch the price and charge the difference for the rest of the cycle immediately.
export const chargeUpgrade = (subId: string | null | undefined, priceId: string | null | undefined) => guarded(subId, async id => {
  if (!priceId) throw new Error('This plan has no Stripe price yet')
  await stripe(`subscriptions/${id}`, { 'items[0][id]': await firstItemId(id), 'items[0][price]': priceId, proration_behavior: 'always_invoice' })
})

// Downgrade at renewal: switch the price for the coming period with no proration (no credit, no refund).
export const applyDowngradeAtRenewal = (subId: string | null | undefined, priceId: string | null | undefined) => guarded(subId, async id => {
  if (!priceId) throw new Error('This plan has no Stripe price yet')
  await stripe(`subscriptions/${id}`, { 'items[0][id]': await firstItemId(id), 'items[0][price]': priceId, proration_behavior: 'none' })
})

// Pause: stop charging (any invoice while paused is voided). The unused paid days are kept in our records.
export const pauseBilling = (subId: string | null | undefined) => guarded(subId, async id => {
  await stripe(`subscriptions/${id}`, { 'pause_collection[behavior]': 'void' })
})

// Resume: start charging again after the saved paid days — Stripe treats them as a free period, then bills monthly from that date.
export const resumeBilling = (subId: string | null | undefined, savedDays: number) => guarded(subId, async id => {
  const params: Record<string, string> = { pause_collection: '', proration_behavior: 'none' }
  if (savedDays > 0) params.trial_end = String(Math.floor(Date.now() / 1000) + savedDays * 86400)
  await stripe(`subscriptions/${id}`, params)
})

// Cancel at the end of the paid period (no refund); undo before that date.
export const cancelAtPeriodEnd = (subId: string | null | undefined, cancel: boolean) => guarded(subId, async id => {
  await stripe(`subscriptions/${id}`, { cancel_at_period_end: cancel ? 'true' : 'false' })
})

// ── Joining ──────────────────────────────────────────────────────────────────────────────────────────────
// Families pay on Stripe's own page (Checkout), so card details never touch our app. `subscriptionRow` is our
// subscriptions.id; the webhook (app/api/webhooks/stripe) uses it to switch the membership on once they've paid.
export async function createCheckout(o: {
  priceId: string; subscriptionRow: string; householdId: string; email?: string | null; customerId?: string | null
  couponId?: string | null; successUrl: string; cancelUrl: string
}): Promise<string> {
  const params: Record<string, string> = {
    mode: 'subscription',
    'line_items[0][price]': o.priceId, 'line_items[0][quantity]': '1',
    client_reference_id: o.householdId,
    'metadata[subscription_row]': o.subscriptionRow,
    'subscription_data[metadata][subscription_row]': o.subscriptionRow,
    'subscription_data[metadata][household_id]': o.householdId,
    success_url: o.successUrl, cancel_url: o.cancelUrl,
  }
  if (o.customerId) params.customer = o.customerId
  else if (o.email) params.customer_email = o.email
  if (o.couponId) params['discounts[0][coupon]'] = o.couponId
  return (await stripe('checkout/sessions', params)).url as string
}

// A discount promo code = a Stripe coupon: % off for the first N monthly payments
export async function createCoupon(percentOff: number, months: number, name: string): Promise<string> {
  const params: Record<string, string> = { percent_off: String(percentOff), name: name.slice(0, 40) }
  if (months <= 1) params.duration = 'once'
  else { params.duration = 'repeating'; params.duration_in_months = String(months) }
  return (await stripe('coupons', params)).id as string
}

// "Manage billing": Stripe's own page for changing card and seeing invoices
export const billingPortal = async (customerId: string, returnUrl: string) =>
  (await stripe('billing_portal/sessions', { customer: customerId, return_url: returnUrl })).url as string

export const getSubscription = (subId: string) => stripe(`subscriptions/${subId}`, {}, 'GET')

// When the current paid month ends (newer Stripe versions keep this on the subscription item)
export const periodEnd = (sub: any): string | null => {
  const t = sub?.current_period_end ?? sub?.items?.data?.[0]?.current_period_end
  return t ? new Date(t * 1000).toISOString().slice(0, 10) : null
}

// Webhooks: check Stripe really sent it (Stripe-Signature header, signed with STRIPE_WEBHOOK_SECRET)
export async function verifyWebhook(rawBody: string, header: string | null): Promise<boolean> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret || !header) return false
  const parts = Object.fromEntries(header.split(',').map(p => p.split('=') as [string, string]))
  const sigs = header.split(',').filter(p => p.startsWith('v1=')).map(p => p.slice(3))
  const t = Number(parts.t)
  if (!t || Math.abs(Date.now() / 1000 - t) > 300) return false   // older than 5 minutes: refuse (replays)
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${t}.${rawBody}`))
  const expected = Array.from(new Uint8Array(mac)).map(b => b.toString(16).padStart(2, '0')).join('')
  return sigs.includes(expected)
}

// Money owed (lost / damaged books) charged to the family's saved card, e.g. when they cancel. A charge, never a refund.
export async function chargeOutstanding(customerId: string | null | undefined, amountAed: number, description: string): Promise<Result> {
  if (!KEY || !customerId || amountAed <= 0) return { ok: true, skipped: true }
  try {
    await stripe('invoiceitems', { customer: customerId, amount: String(Math.round(amountAed * 100)), currency: 'aed', description })
    const invoice = await stripe('invoices', { customer: customerId, auto_advance: 'true', collection_method: 'charge_automatically', pending_invoice_items_behavior: 'include' })
    await stripe(`invoices/${invoice.id}/pay`)
    return { ok: true }
  } catch (e: any) { return { ok: false, error: e.message } }
}
