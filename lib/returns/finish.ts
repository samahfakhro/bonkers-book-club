import { supabaseAdmin } from '@/lib/supabase-admin'
import { notifyHousehold } from '@/lib/notify'
import { sendBackOnShelfAlerts } from '@/lib/notify-me'
import { dubaiToday } from '@/lib/routes/server'

// "Finished inspecting" on the Returns screen:
//  1. "Back on the shelf" alerts for every book checked in as lendable in this batch
//  2. Over-allowance check: more books at home than the plan allows → message + grace period
//     (2 Bonkers Days, admin setting). After that, new books are on hold (database blocks submitting)
//     until enough books come back. Families who are back within their plan are cleared.

const addDays = (date: string, n: number) => new Date(Date.parse(`${date}T12:00:00Z`) + n * 86400_000).toISOString().slice(0, 10)
const pretty = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
const books = (n: number) => `${n} book${n === 1 ? '' : 's'}`

async function graceDays() {
  const { data } = await supabaseAdmin.from('system_settings').select('value').eq('key', 'over_allowance_grace_bonkers_days').maybeSingle()
  const n = Number(data?.value)
  return Number.isFinite(n) && n >= 0 ? n : 2
}

// books at home vs plan, for every family that has books out
export async function allowanceByHousehold() {
  const [{ data: loans }, { data: subs }] = await Promise.all([
    supabaseAdmin.from('loans').select('household_id').is('returned_at', null).in('status', ['checked_out', 'active']),
    supabaseAdmin.from('subscriptions').select('household_id, subscription_plans(book_count)').eq('status', 'active'),
  ])
  const atHome = new Map<string, number>()
  ;(loans || []).forEach(l => atHome.set(l.household_id, (atHome.get(l.household_id) || 0) + 1))
  const plan = new Map((subs || []).map((s: any) => [s.household_id, s.subscription_plans?.book_count ?? 4]))
  return { atHome, planFor: (id: string) => plan.get(id) ?? 4 }
}

async function alreadyToldToday(householdId: string, title: string) {
  const { count } = await supabaseAdmin.from('notifications').select('id', { count: 'exact', head: true })
    .eq('household_id', householdId).eq('title', title).gte('created_at', `${dubaiToday()}T00:00:00+04:00`)
  return (count || 0) > 0
}

export async function finishInspecting() {
  const now = new Date().toISOString()
  const today = dubaiToday()

  // 1. this batch's check-ins → alerts for the books that went back on the shelf
  const { data: batch } = await supabaseAdmin.from('return_inspections').select('id, final_status, book_copies(book_id)').is('batch_finished_at', null)
  const ids = (batch || []).map(b => b.id)
  if (ids.length) await supabaseAdmin.from('return_inspections').update({ batch_finished_at: now }).in('id', ids)
  const shelvedBookIds = (batch || []).filter(b => b.final_status === 'available').map(b => (b.book_copies as any)?.book_id).filter(Boolean)
  const alertsSent = await sendBackOnShelfAlerts(shelvedBookIds)

  // collected by the driver but never scanned in (a warehouse/van problem, not the family's)
  const { count: notScanned } = await supabaseAdmin.from('loans').select('id', { count: 'exact', head: true }).eq('status', 'in_return_transit')

  // 2. over-allowance
  const { atHome, planFor } = await allowanceByHousehold()
  const { data: flagged } = await supabaseAdmin.from('households').select('id, over_allowance_grace_until').not('over_allowance_since', 'is', null)
  const flaggedMap = new Map((flagged || []).map(h => [h.id, h.over_allowance_grace_until as string | null]))
  // families who had a visit in the last couple of days get a reminder (once per Bonkers Day)
  const { data: recentStops } = await supabaseAdmin.from('route_stops').select('household_id, routes!inner(route_date)').gte('routes.route_date', addDays(today, -2)).lte('routes.route_date', today)
  const visited = new Set((recentStops || []).map(s => s.household_id))
  const grace = await graceDays()
  const result = { newlyOver: 0, reminded: 0, cleared: 0, onHold: 0 }

  for (const [householdId, n] of atHome) {
    const plan = planFor(householdId), extra = n - plan
    if (extra <= 0) continue
    const graceUntil = flaggedMap.get(householdId)
    if (!flaggedMap.has(householdId)) {
      const until = addDays(today, 7 * grace)
      await supabaseAdmin.from('households').update({ over_allowance_since: today, over_allowance_grace_until: until, over_allowance_response: null, over_allowance_responded_at: null }).eq('id', householdId)
      await notifyHousehold({ householdId, type: 'general', title: 'A few too many books at home',
        message: `You have ${n} books at home, but your plan is for ${plan}. Please pop ${books(extra)} in your tote for your next Bonkers Day — or let us know what happened on your dashboard. If they’re not back by ${pretty(until)}, new books will pause until they are.`,
        link: '/dashboard' })
      result.newlyOver++
    } else if (visited.has(householdId)) {
      const onHold = !!graceUntil && graceUntil < today
      const title = onHold ? 'New books are on hold' : 'Reminder: books to return'
      if (await alreadyToldToday(householdId, title)) continue
      await notifyHousehold({ householdId, type: 'general', title,
        message: onHold
          ? `We still need ${books(extra)} back before we can send new ones. Pop ${extra === 1 ? 'it' : 'them'} in your tote for your next Bonkers Day — new books start again as soon as ${extra === 1 ? 'it’s' : 'they’re'} back.`
          : `You still have ${books(extra)} more than your plan at home. Please pop ${extra === 1 ? 'it' : 'them'} in your tote for your next Bonkers Day${graceUntil ? ` — new books pause after ${pretty(graceUntil)}` : ''}.`,
        link: '/dashboard' })
      onHold ? result.onHold++ : result.reminded++
    }
  }
  // back within the plan → clear the flag
  for (const [householdId] of flaggedMap) {
    if ((atHome.get(householdId) || 0) > planFor(householdId)) continue
    await clearOverAllowance(householdId)
    result.cleared++
  }

  return { checkedIn: ids.length, alertsSent, notScanned: notScanned || 0, ...result }
}

export async function clearOverAllowance(householdId: string) {
  await supabaseAdmin.from('households').update({ over_allowance_since: null, over_allowance_grace_until: null, over_allowance_response: null, over_allowance_responded_at: null }).eq('id', householdId)
  await notifyHousehold({ householdId, type: 'general', title: 'All sorted — thank you!', message: 'Everything’s back within your plan. Happy reading!', link: '/dashboard' })
}

// ── Admin actions for families over their allowance ──

export async function overAllowanceList() {
  const { data: hhs } = await supabaseAdmin.from('households')
    .select('id, first_name, last_name, name, whatsapp_number, mobile_phone, over_allowance_since, over_allowance_grace_until, over_allowance_response, over_allowance_responded_at')
    .not('over_allowance_since', 'is', null).order('over_allowance_grace_until')
  if (!hhs?.length) return []
  const { atHome, planFor } = await allowanceByHousehold()
  const { data: loans } = await supabaseAdmin.from('loans')
    .select('id, household_id, child_profiles(name), book_copies(internal_id, books(title))')
    .in('household_id', hhs.map(h => h.id)).is('returned_at', null).in('status', ['checked_out', 'active'])
  const today = dubaiToday()
  return hhs.map(h => ({
    householdId: h.id, family: [h.first_name, h.last_name].filter(Boolean).join(' ') || h.name || 'Family',
    phone: h.whatsapp_number || h.mobile_phone || null, atHome: atHome.get(h.id) || 0, plan: planFor(h.id),
    since: h.over_allowance_since, graceUntil: h.over_allowance_grace_until,
    onHold: !!h.over_allowance_grace_until && h.over_allowance_grace_until < today,
    response: h.over_allowance_response, respondedAt: h.over_allowance_responded_at,
    books: (loans || []).filter(l => l.household_id === h.id).map((l: any) => ({ loanId: l.id, title: l.book_copies?.books?.title || '', internalId: l.book_copies?.internal_id || '', child: l.child_profiles?.name || '' })),
  }))
}

// "More time": one more Bonkers Day (a week)
export async function giveMoreTime(householdId: string) {
  const { data: h } = await supabaseAdmin.from('households').select('over_allowance_grace_until').eq('id', householdId).single()
  const base = h?.over_allowance_grace_until && h.over_allowance_grace_until > dubaiToday() ? h.over_allowance_grace_until : dubaiToday()
  await supabaseAdmin.from('households').update({ over_allowance_grace_until: addDays(base, 7) }).eq('id', householdId)
  return { ok: true }
}

// "Mark lost": the book won't come back (charging for it comes with payment requests)
export async function markLost(loanId: string) {
  const { data: loan } = await supabaseAdmin.from('loans').select('id, household_id, book_copy_id').eq('id', loanId).single()
  if (!loan) return { error: 'Loan not found' }
  await supabaseAdmin.from('loans').update({ status: 'lost', return_requested: false }).eq('id', loanId)
  await supabaseAdmin.from('book_copies').update({ status: 'lost', current_household_id: null, updated_at: new Date().toISOString() }).eq('id', loan.book_copy_id)
  const { atHome, planFor } = await allowanceByHousehold()
  if ((atHome.get(loan.household_id) || 0) <= planFor(loan.household_id)) await clearOverAllowance(loan.household_id)
  return { ok: true }
}
