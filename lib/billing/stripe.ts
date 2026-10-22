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
