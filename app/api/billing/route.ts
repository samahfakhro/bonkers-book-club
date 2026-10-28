import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { billingPortal, stripeEnabled } from '@/lib/billing/stripe'
import { checkoutForSubscription } from '@/lib/billing/join'

// Signed-in family. POST { action: 'finish' } → Stripe's payment page for a membership still waiting for payment;
// POST { action: 'portal' } → Stripe's "Manage billing" page (card, invoices).
export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace(/^Bearer /, '')
  const { data: { user } } = token ? await supabaseAdmin.auth.getUser(token) : { data: { user: null } }
  if (!user) return NextResponse.json({ error: 'Please sign in again' }, { status: 401 })
  if (!stripeEnabled()) return NextResponse.json({ error: 'Payments aren’t switched on yet' }, { status: 400 })
  const { data: hh } = await supabaseAdmin.from('households').select('id').eq('user_id', user.id).maybeSingle()
  if (!hh) return NextResponse.json({ error: 'Family not found' }, { status: 404 })
  const { action } = await req.json().catch(() => ({}))
  const origin = req.nextUrl.origin

  try {
    if (action === 'finish') {
      const { data: sub } = await supabaseAdmin.from('subscriptions').select('id').eq('household_id', hh.id).eq('status', 'pending_payment').maybeSingle()
      if (!sub) return NextResponse.json({ error: 'Your membership is already set up' }, { status: 400 })
      return NextResponse.json({ url: await checkoutForSubscription(sub.id, origin) })
    }
    if (action === 'portal') {
      const { data: sub } = await supabaseAdmin.from('subscriptions').select('stripe_customer_id').eq('household_id', hh.id)
        .not('stripe_customer_id', 'is', null).order('created_at', { ascending: false }).limit(1).maybeSingle()
      if (!sub?.stripe_customer_id) return NextResponse.json({ error: 'No card on file' }, { status: 400 })
      return NextResponse.json({ url: await billingPortal(sub.stripe_customer_id, `${origin}/dashboard/settings`) })
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Stripe isn’t answering, please try again' }, { status: 500 })
  }
  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
