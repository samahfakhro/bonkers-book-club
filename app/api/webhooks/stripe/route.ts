import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getSubscription, periodEnd, verifyWebhook } from '@/lib/billing/stripe'
import { markCodeUsed } from '@/lib/promo-codes'
import { notifyHousehold } from '@/lib/notify'
import { renderMessage } from '@/lib/messages'

// Stripe tells us what happened with payments. Open past the site lock (lib/site-lock.ts: /api/webhooks);
// every call must carry Stripe's signature (STRIPE_WEBHOOK_SECRET), anything else is turned away.
// In Stripe: Developers → Webhooks → endpoint https://www.curiouslibrary.ae/api/webhooks/stripe with the events below.
export async function POST(req: NextRequest) {
  const raw = await req.text()
  if (!(await verifyWebhook(raw, req.headers.get('stripe-signature')))) return NextResponse.json({ error: 'Bad signature' }, { status: 400 })
  const event = JSON.parse(raw)
  const obj = event.data?.object ?? {}

  try {
    switch (event.type) {
      // paid on Stripe's page → the membership starts
      case 'checkout.session.completed': {
        const rowId = obj.metadata?.subscription_row
        if (!rowId || !obj.subscription) break
        const { data: row } = await supabaseAdmin.from('subscriptions').select('id, household_id, status, promo_code').eq('id', rowId).maybeSingle()
        if (!row) break
        const stripeSub = await getSubscription(obj.subscription)
        await supabaseAdmin.from('subscriptions').update({
          status: row.status === 'pending_payment' ? 'active' : row.status,
          stripe_customer_id: obj.customer, stripe_subscription_id: obj.subscription,
          start_date: new Date().toISOString(), next_billing_date: periodEnd(stripeSub),
        }).eq('id', row.id)
        if (row.status === 'pending_payment') {
          await markCodeUsed(row.promo_code)
          const { data: hh } = await supabaseAdmin.from('households').select('first_name').eq('id', row.household_id).single()
          const welcome = await renderMessage('welcome', { parent_name: hh?.first_name || 'there' })
          await notifyHousehold({ householdId: row.household_id, type: 'general', title: welcome.title, message: welcome.body, link: '/dashboard' }).catch(() => {})
        }
        break
      }
      // a monthly payment went through → keep the next billing date in step with Stripe
      case 'invoice.paid': {
        const subId = obj.subscription ?? obj.parent?.subscription_details?.subscription
        if (!subId) break
        const next = periodEnd(await getSubscription(subId))
        if (next) await supabaseAdmin.from('subscriptions').update({ next_billing_date: next }).eq('stripe_subscription_id', subId)
        break
      }
      // a payment failed → ask the family to update their card (Stripe retries by itself)
      case 'invoice.payment_failed': {
        const subId = obj.subscription ?? obj.parent?.subscription_details?.subscription
        if (!subId) break
        const { data: row } = await supabaseAdmin.from('subscriptions').select('household_id').eq('stripe_subscription_id', subId).maybeSingle()
        if (row) await notifyHousehold({
          householdId: row.household_id, type: 'general', title: 'We couldn’t take your payment',
          message: 'Your monthly payment didn’t go through. Please update your card in Settings → Plan → Manage billing, and we’ll try again.',
          link: '/dashboard/settings',
        }).catch(() => {})
        break
      }
      // Stripe ended the subscription (e.g. payments kept failing, or a cancellation reached its end date)
      case 'customer.subscription.deleted': {
        await supabaseAdmin.from('subscriptions').update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
          .eq('stripe_subscription_id', obj.id).neq('status', 'cancelled')
        break
      }
    }
  } catch (e: any) {
    console.error('Stripe webhook failed:', event.type, e?.message)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })   // Stripe will retry
  }
  return NextResponse.json({ received: true })
}
