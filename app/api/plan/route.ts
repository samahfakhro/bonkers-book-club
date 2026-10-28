import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import {
  bookFreeCollection, booksCountingTowardPlan, cancelFreeCollection, cancelMembership, changePlan, daysBetween, deleteAccount, keepMembership,
  loadMembership, outstandingBooks, outstandingCharges, pauseMembership, rejoinMembership, resumeMembership, today,
} from '@/lib/membership/plan'

// Settings → Plan.  GET: everything the screen needs.  POST { action, planId? }: change it.
async function whoIs(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace(/^Bearer /, '')
  if (!token) return null
  const { data: { user } } = await supabaseAdmin.auth.getUser(token)
  if (!user) return null
  const { data } = await supabaseAdmin.from('households').select('id').eq('user_id', user.id).maybeSingle()
  return data ? { householdId: data.id as string, userId: user.id } : null
}
const householdFor = async (req: NextRequest) => (await whoIs(req))?.householdId ?? null

export async function GET(req: NextRequest) {
  const householdId = await householdFor(req)
  if (!householdId) return NextResponse.json({ error: 'Please sign in again' }, { status: 401 })
  const { sub, plans } = await loadMembership(householdId)
  if (!sub) return NextResponse.json({ membership: null, plans })
  const [outstanding, owed, counting, { count: onItsWay }] = await Promise.all([
    outstandingBooks(householdId),
    outstandingCharges(householdId),
    booksCountingTowardPlan(householdId),
    supabaseAdmin.from('swap_requests').select('id', { count: 'exact', head: true }).eq('household_id', householdId).eq('status', 'locked'),
  ])
  const plan = plans.find(p => p.id === sub.plan_id) || null
  const scheduled = plans.find(p => p.id === sub.scheduled_plan_id) || null
  return NextResponse.json({
    plans: plans.map(p => ({ id: p.id, name: p.name, books: p.book_count, price: Number(p.price_monthly) })),
    membership: {
      status: sub.status,
      plan: plan && { id: plan.id, name: plan.name, books: plan.book_count, price: Number(plan.price_monthly) },
      nextBillingDate: sub.next_billing_date,
      paidDaysLeft: sub.status === 'active' && sub.next_billing_date ? daysBetween(today(), sub.next_billing_date) : 0,
      savedDays: sub.paused_days_remaining ?? 0,
      pausedSince: sub.pause_start_date,
      cancelAt: sub.cancel_at,
      scheduled: scheduled && { id: scheduled.id, name: scheduled.name, books: scheduled.book_count, price: Number(scheduled.price_monthly), extraBooks: Math.max(0, counting - scheduled.book_count) },
      booksOut: outstanding.total,              // must all be checked in before pausing or cancelling
      booksNotBooked: outstanding.notMarked,    // at home and not yet booked for collection
      deliveryOnItsWay: (onItsWay || 0) > 0,
      owed,                                     // unpaid lost / damaged book payment requests
      isFree: !!sub.is_free,                    // joined with a free code: no card, no payments
      hasBilling: !!sub.stripe_customer_id,     // card on file with Stripe → "Manage billing"
    },
  })
}

export async function POST(req: NextRequest) {
  const who = await whoIs(req)
  if (!who) return NextResponse.json({ error: 'Please sign in again' }, { status: 401 })
  const { householdId, userId } = who
  const { action, planId } = await req.json().catch(() => ({}))
  const result =
    action === 'change_plan' ? await changePlan(householdId, planId)
    : action === 'book_collection' ? await bookFreeCollection(householdId)
    : action === 'cancel_collection' ? await cancelFreeCollection(householdId)
    : action === 'pause' ? await pauseMembership(householdId)
    : action === 'resume' ? await resumeMembership(householdId)
    : action === 'cancel' ? await cancelMembership(householdId)
    : action === 'keep' ? await keepMembership(householdId)
    : action === 'rejoin' ? await rejoinMembership(householdId)
    : action === 'delete_account' ? await deleteAccount(householdId, userId)
    : { ok: false as const, error: 'Unknown action' }
  return result.ok ? NextResponse.json(result) : NextResponse.json({ error: result.error }, { status: 400 })
}
