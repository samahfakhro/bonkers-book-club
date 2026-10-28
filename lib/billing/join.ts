// Server-only. Joining with Stripe: a new family's membership waits as 'pending_payment' until they've paid on
// Stripe's page; the webhook (app/api/webhooks/stripe) then switches it to 'active'.
import { supabaseAdmin } from '@/lib/supabase-admin'
import { createCheckout } from '@/lib/billing/stripe'
import { usableCode } from '@/lib/promo-codes'

// Stripe's payment page for one of our subscriptions rows. `origin` is this site (so local testing comes back here).
export async function checkoutForSubscription(subId: string, origin: string): Promise<string> {
  const { data: sub } = await supabaseAdmin.from('subscriptions')
    .select('id, household_id, promo_code, stripe_customer_id, subscription_plans ( stripe_price_id ), households ( user_id )')
    .eq('id', subId).single()
  const priceId = (sub?.subscription_plans as any)?.stripe_price_id as string | undefined
  if (!sub || !priceId) throw new Error('This plan isn’t ready for payments yet')

  const userId = (sub.households as any)?.user_id as string | undefined
  const email = userId ? (await supabaseAdmin.auth.admin.getUserById(userId)).data.user?.email : null

  // a discount code typed at sign-up is taken off on Stripe's page (only if it's still valid)
  let couponId: string | null = null
  if (sub.promo_code) {
    const found = await usableCode(sub.promo_code)
    if (found.ok && found.promo.kind === 'discount') couponId = found.promo.stripe_coupon_id
  }

  return createCheckout({
    priceId, subscriptionRow: sub.id, householdId: sub.household_id, email, customerId: sub.stripe_customer_id, couponId,
    successUrl: `${origin}/signup/paid`, cancelUrl: `${origin}/signup/paid?cancelled=1`,
  })
}

export const addMonth = (d: Date) => { const n = new Date(d); n.setMonth(n.getMonth() + 1); return n.toISOString().slice(0, 10) }
