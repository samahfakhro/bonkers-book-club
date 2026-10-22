// Server-only. Settings → Plan: the rules for upgrading, downgrading, pausing, resuming and cancelling.
// No refunds, ever. Pause and cancel only once every book is actually checked back in (not just marked Returning).
import { supabaseAdmin } from '@/lib/supabase-admin'
import { recheckAllowance } from '@/lib/returns/finish'
import { applyDowngradeAtRenewal, cancelAtPeriodEnd, chargeOutstanding, chargeUpgrade, pauseBilling, resumeBilling, stripeEnabled } from '@/lib/billing/stripe'
import { updateCharge } from '@/lib/returns/charges'
import { notifyHousehold } from '@/lib/notify'
import { renderMessage } from '@/lib/messages'

const DAY = 86400000
export const OUTSTANDING_LOAN_STATUSES = ['checked_out', 'in_return_transit']   // still at home, or collected but not yet checked in
const CHOOSING_STATUSES = ['draft', 'child_confirmed', 'submitted', 'confirmed']

export const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dubai' }).format(new Date())   // YYYY-MM-DD in Dubai
const addDays = (iso: string, n: number) => new Date(new Date(iso + 'T00:00:00Z').getTime() + n * DAY).toISOString().slice(0, 10)
export const addMonths = (iso: string, n: number) => {
  const d = new Date(iso + 'T00:00:00Z'), day = d.getUTCDate()
  d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + n)
  d.setUTCDate(Math.min(day, new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()))
  return d.toISOString().slice(0, 10)
}
export const daysBetween = (from: string, to: string) => Math.max(0, Math.round((new Date(to + 'T00:00:00Z').getTime() - new Date(from + 'T00:00:00Z').getTime()) / DAY))

type Plan = { id: string; name: string; book_count: number; price_monthly: number; stripe_price_id: string | null }

export async function loadMembership(householdId: string) {
  const [{ data: sub }, { data: plans }] = await Promise.all([
    supabaseAdmin.from('subscriptions')
      .select('id, plan_id, status, start_date, next_billing_date, paused_days_remaining, pause_start_date, scheduled_plan_id, cancel_at, stripe_subscription_id')
      .eq('household_id', householdId).in('status', ['active', 'paused', 'cancelling', 'cancelled']).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabaseAdmin.from('subscription_plans').select('id, name, book_count, price_monthly, stripe_price_id').eq('is_active', true).order('book_count'),
  ])
  return { sub, plans: (plans || []) as Plan[] }
}

// Books that stop a pause or cancel: anything not yet checked back in at the warehouse
export async function outstandingBooks(householdId: string) {
  const { data } = await supabaseAdmin.from('loans').select('id, status, return_requested').eq('household_id', householdId).in('status', OUTSTANDING_LOAN_STATUSES)
  const rows = data || []
  return { total: rows.length, notMarked: rows.filter(l => l.status === 'checked_out' && !l.return_requested).length }
}

// Unpaid payment requests (lost / damaged books)
export async function outstandingCharges(householdId: string) {
  const { data } = await supabaseAdmin.from('damage_charges').select('id, kind, charge_amount_aed, book_copies ( books ( title ) )').eq('household_id', householdId).eq('status', 'requested')
  const items = (data || []).map((c: any) => ({ id: c.id as string, kind: c.kind as string, title: c.book_copies?.books?.title || 'A book', amount: Number(c.charge_amount_aed) || 0 }))
  return { items, total: Math.round(items.reduce((n, c) => n + c.amount, 0) * 100) / 100 }
}

// Books that count against a smaller plan: still at home (not yet collected) + already chosen for the next delivery
export async function booksCountingTowardPlan(householdId: string) {
  const [{ count: atHome }, { data: reqs }] = await Promise.all([
    supabaseAdmin.from('loans').select('id', { count: 'exact', head: true }).eq('household_id', householdId).eq('status', 'checked_out'),
    supabaseAdmin.from('swap_requests').select('id, swap_request_items(id)').eq('household_id', householdId).in('status', [...CHOOSING_STATUSES, 'locked']),
  ])
  const chosen = (reqs || []).reduce((n, r: any) => n + (r.swap_request_items?.length || 0), 0)
  return (atHome || 0) + chosen
}

async function deliveryOnItsWay(householdId: string) {
  const { count } = await supabaseAdmin.from('swap_requests').select('id', { count: 'exact', head: true }).eq('household_id', householdId).eq('status', 'locked')
  return (count || 0) > 0
}

// Pending deliveries are cancelled; chosen books go back to each child's saved list (nothing is lost, nothing is sent)
async function cancelPendingDeliveries(householdId: string) {
  const { data: reqs } = await supabaseAdmin.from('swap_requests').select('id, swap_request_items(id, book_id, child_id)').eq('household_id', householdId).in('status', CHOOSING_STATUSES)
  for (const r of reqs || []) {
    const items = (r as any).swap_request_items || []
    if (items.length) {
      const { data: have } = await supabaseAdmin.from('wishlists').select('book_id, child_id').in('child_id', [...new Set(items.map((i: any) => i.child_id))])
      const missing = items.filter((i: any) => !(have || []).some(w => w.book_id === i.book_id && w.child_id === i.child_id))
      if (missing.length) await supabaseAdmin.from('wishlists').insert(missing.map((i: any) => ({ book_id: i.book_id, child_id: i.child_id })))
      await supabaseAdmin.from('swap_request_items').delete().in('id', items.map((i: any) => i.id))
    }
    await supabaseAdmin.from('swap_requests').delete().eq('id', r.id)
  }
}

type ActionResult = { ok: true; message: string } | { ok: false; error: string }

// a record of each change in the family's Messages (and by their chosen email / WhatsApp)
const confirmToFamily = async (householdId: string, key: string, vars: Record<string, string | number> = {}) => {
  const m = await renderMessage(key, vars)
  await notifyHousehold({ householdId, type: 'general', title: m.title, message: m.body, link: '/dashboard/settings' }).catch(() => {})
}
const niceDate = (iso: string) => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
const fail = (error: string): ActionResult => ({ ok: false, error })

export async function changePlan(householdId: string, planId: string): Promise<ActionResult> {
  const { sub, plans } = await loadMembership(householdId)
  if (!sub || sub.status !== 'active') return fail('Plans can be changed while your membership is active.')
  const current = plans.find(p => p.id === sub.plan_id), target = plans.find(p => p.id === planId)
  if (!target) return fail('That plan isn’t available.')
  if (!current || target.id === current.id) {
    // choosing your current plan again just cancels a booked downgrade
    if (sub.scheduled_plan_id) await supabaseAdmin.from('subscriptions').update({ scheduled_plan_id: null }).eq('id', sub.id)
    return { ok: true, message: `You’ll stay on ${current?.name ?? 'your plan'}.` }
  }
  if (target.book_count > current.book_count) {
    const billed = await chargeUpgrade(sub.stripe_subscription_id, target.stripe_price_id)
    if (!billed.ok) return fail('We couldn’t take the upgrade payment: ' + billed.error)
    await supabaseAdmin.from('subscriptions').update({ plan_id: target.id, scheduled_plan_id: null }).eq('id', sub.id)
    await recheckAllowance(householdId)
    await confirmToFamily(householdId, 'plan_upgraded', { plan_name: target.name, plan_books: target.book_count })
    return { ok: true, message: `You’re now on ${target.name} — ${target.book_count} books at a time.` }
  }
  await supabaseAdmin.from('subscriptions').update({ scheduled_plan_id: target.id }).eq('id', sub.id)
  if (sub.next_billing_date) await confirmToFamily(householdId, 'downgrade_booked', { plan_name: target.name, plan_books: target.book_count, date: niceDate(sub.next_billing_date) })
  return { ok: true, message: `Your plan will change to ${target.name} on your next billing date.` }
}

export async function bookFreeCollection(householdId: string): Promise<ActionResult> {
  const { data } = await supabaseAdmin.from('loans').update({ return_requested: true }).eq('household_id', householdId).eq('status', 'checked_out').eq('return_requested', false).select('id')
  return { ok: true, message: data?.length ? `We’ll collect ${data.length} ${data.length === 1 ? 'book' : 'books'} on your next Curious Day.` : 'All your books are already booked for collection.' }
}

// Changed their mind: unbook the collection (books already on a driver's route stay booked)
export async function cancelFreeCollection(householdId: string): Promise<ActionResult> {
  // books a delivery on its way depends on can't be unbooked
  const { data: needed } = await supabaseAdmin.rpc('returns_needed', { p_household: householdId })
  if (Number(needed) > 0) return fail(`${needed} ${Number(needed) === 1 ? 'book needs' : 'books need'} to go back for the delivery that’s on its way, so the collection can’t be cancelled.`)
  const { data } = await supabaseAdmin.from('loans').update({ return_requested: false }).eq('household_id', householdId).eq('status', 'checked_out').eq('return_requested', true).is('collection_stop_id', null).select('id')
  const { count: onRoute } = await supabaseAdmin.from('loans').select('id', { count: 'exact', head: true }).eq('household_id', householdId).eq('status', 'checked_out').eq('return_requested', true).not('collection_stop_id', 'is', null)
  if (!data?.length && onRoute) return fail('Your collection is already on the driver’s route for your next Curious Day, so it can’t be changed now.')
  return { ok: true, message: onRoute ? `Collection cancelled for ${data?.length || 0} books. ${onRoute} ${onRoute === 1 ? 'is' : 'are'} already on the driver’s route and will still be collected.` : 'Collection cancelled — your books will stay with you.' }
}

async function readyToStop(householdId: string): Promise<string | null> {
  if (await deliveryOnItsWay(householdId)) return 'You have a delivery on its way. Once it’s arrived and the books have come back, you’ll be able to do this.'
  if ((await outstandingBooks(householdId)).total > 0) return 'All your books need to be returned first.'
  return null
}

export async function pauseMembership(householdId: string): Promise<ActionResult> {
  const { sub } = await loadMembership(householdId)
  if (!sub || sub.status !== 'active') return fail('Only an active membership can be paused.')
  const blocked = await readyToStop(householdId)
  if (blocked) return fail(blocked)
  const saved = sub.next_billing_date ? daysBetween(today(), sub.next_billing_date) : 0
  const billed = await pauseBilling(sub.stripe_subscription_id)
  if (!billed.ok) return fail('We couldn’t pause billing: ' + billed.error)
  await cancelPendingDeliveries(householdId)
  await supabaseAdmin.from('subscriptions').update({ status: 'paused', pause_start_date: today(), pause_requested_at: new Date().toISOString(), pause_end_date: null, paused_days_remaining: saved, scheduled_plan_id: null }).eq('id', sub.id)
  await confirmToFamily(householdId, 'paused', { saved_days: `${saved} ${saved === 1 ? 'day' : 'days'}` })
  return { ok: true, message: `Your membership is paused. ${saved} paid ${saved === 1 ? 'day is' : 'days are'} saved for when you come back.` }
}

export async function resumeMembership(householdId: string): Promise<ActionResult> {
  const { sub } = await loadMembership(householdId)
  if (!sub || sub.status !== 'paused') return fail('Your membership isn’t paused.')
  const saved = sub.paused_days_remaining ?? 0
  const billed = await resumeBilling(sub.stripe_subscription_id, saved)
  if (!billed.ok) return fail('We couldn’t restart billing: ' + billed.error)
  // the saved paid days run from today; the next payment is due once they're used up
  const nextBilling = addDays(today(), saved)
  await supabaseAdmin.from('subscriptions').update({ status: 'active', pause_end_date: today(), paused_days_remaining: null, next_billing_date: nextBilling }).eq('id', sub.id)
  await confirmToFamily(householdId, 'resumed', { date: niceDate(nextBilling) })
  return { ok: true, message: 'Welcome back! Your membership is active again.' }
}

export async function cancelMembership(householdId: string): Promise<ActionResult> {
  const { sub } = await loadMembership(householdId)
  if (!sub || sub.status !== 'active') return fail('Only an active membership can be cancelled.')
  const blocked = await readyToStop(householdId)
  if (blocked) return fail(blocked)
  const billed = await cancelAtPeriodEnd(sub.stripe_subscription_id, true)
  if (!billed.ok) return fail('We couldn’t cancel billing: ' + billed.error)
  const owed = await outstandingCharges(householdId)
  let owedNote = ''
  if (owed.total > 0) {
    const { data: s2 } = await supabaseAdmin.from('subscriptions').select('stripe_customer_id').eq('id', sub.id).single()
    const paid = await chargeOutstanding(s2?.stripe_customer_id, owed.total, `Lost / damaged books (${owed.items.length})`)
    if (paid.ok && !paid.skipped) { for (const c of owed.items) await updateCharge(c.id, { status: 'paid' }); owedNote = ` AED ${owed.total} for lost or damaged books has been charged to your card.` }
    else owedNote = ` You still have AED ${owed.total} to pay for lost or damaged books.`
  }
  await cancelPendingDeliveries(householdId)
  const endsOn = sub.next_billing_date || today()
  // their 'tell me when it's back' bells no longer apply
  const { data: hh } = await supabaseAdmin.from('households').select('user_id').eq('id', householdId).single()
  if (hh?.user_id) await supabaseAdmin.from('book_availability_notifications').delete().eq('user_id', hh.user_id)
  await supabaseAdmin.from('subscriptions').update({ status: 'cancelling', cancel_at: endsOn, cancellation_requested_at: new Date().toISOString(), scheduled_plan_id: null }).eq('id', sub.id)
  await confirmToFamily(householdId, 'cancelling', { date: niceDate(endsOn), owed_note: owedNote })
  return { ok: true, message: `Your membership will end on ${niceDate(endsOn)}.${owedNote}` }
}

export async function keepMembership(householdId: string): Promise<ActionResult> {
  const { sub } = await loadMembership(householdId)
  if (!sub || sub.status !== 'cancelling') return fail('Your membership isn’t being cancelled.')
  const billed = await cancelAtPeriodEnd(sub.stripe_subscription_id, false)
  if (!billed.ok) return fail('We couldn’t update billing: ' + billed.error)
  await supabaseAdmin.from('subscriptions').update({ status: 'active', cancel_at: null, cancellation_requested_at: null }).eq('id', sub.id)
  await confirmToFamily(householdId, 'kept')
  return { ok: true, message: 'Great — your membership will carry on.' }
}

// Coming back after a membership ended: same account, children, saved books and history
export async function rejoinMembership(householdId: string): Promise<ActionResult> {
  const { sub } = await loadMembership(householdId)
  if (!sub || sub.status !== 'cancelled') return fail('Your membership hasn’t ended.')
  const owed = await outstandingCharges(householdId)
  if (owed.total > 0) return fail(`Please settle the AED ${owed.total} still owing for lost or damaged books first, then you can rejoin.`)
  // once Stripe is connected, rejoining goes through checkout (a new payment) — until then the membership simply restarts
  if (stripeEnabled()) return fail('To rejoin, please message us and we’ll restart your membership.')
  const start = today()
  await supabaseAdmin.from('subscriptions').update({ status: 'active', start_date: start, next_billing_date: addMonths(start, 1), cancel_at: null, cancelled_at: null, cancellation_requested_at: null, scheduled_plan_id: null }).eq('id', sub.id)
  return { ok: true, message: 'Welcome back! Your membership is active again.' }
}

// "Delete my account" (right to erasure): only once the membership has ended, every book is back and nothing is owed.
// Personal details are wiped and the login removed; anonymous records (which copy was borrowed when) stay for stock history.
export async function deleteAccount(householdId: string, userId: string): Promise<ActionResult> {
  const { sub } = await loadMembership(householdId)
  if (sub && sub.status !== 'cancelled') return fail('Please cancel your membership first. Your account can be deleted once it has ended.')
  if ((await outstandingBooks(householdId)).total > 0) return fail('All books need to come back before your account can be deleted.')
  const owed = await outstandingCharges(householdId)
  if (owed.total > 0) return fail(`Please settle the AED ${owed.total} still owing first.`)

  const { data: kids } = await supabaseAdmin.from('child_profiles').select('id').eq('household_id', householdId)
  const kidIds = (kids || []).map(k => k.id)
  const steps: PromiseLike<unknown>[] = [
    supabaseAdmin.from('households').update({
      first_name: 'Deleted', last_name: 'family', name: null, address: null, floor: null, delivery_lat: null, delivery_lng: null,
      delivery_container_location_notes: null, parent_pin_hash: null, visitor_id: null, mobile_phone: null, whatsapp_number: null, building: null, villa_flat: null, street: null,
      sub_community: null, area: null, latitude: null, longitude: null, delivery_notes: null, safe_spot_description: null, neighbour_details: null,
      neighbour_permission_enabled: false, user_id: null, account_status: 'deleted',
    }).eq('id', householdId),
    supabaseAdmin.from('notifications').delete().eq('household_id', householdId),
    supabaseAdmin.from('book_requests').delete().eq('household_id', householdId),
    supabaseAdmin.from('book_availability_notifications').delete().eq('user_id', userId),
  ]
  if (kidIds.length) steps.push(
    supabaseAdmin.from('child_profiles').update({ name: 'Reader', nickname: null, last_name: null, date_of_birth: null, access_pin: null, child_pin_hash: null }).in('id', kidIds),
    supabaseAdmin.from('book_reviews').update({ review_text: null }).in('child_id', kidIds),
    supabaseAdmin.from('wishlists').delete().in('child_id', kidIds),
  )
  for (const step of steps) { const r: any = await step; if (r?.error) return fail('Something went wrong deleting your details: ' + r.error.message) }
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)
  if (error) return fail('Your details were removed, but we couldn’t remove your login: ' + error.message)
  return { ok: true, message: 'Your account has been deleted. Thank you for being part of The Curious Library.' }
}

export { applyDowngradeAtRenewal }
