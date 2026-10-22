// Server-only. Automatic messages, sent in the app + by each family's chosen email / WhatsApp (see lib/notify.ts).
//  • 12 noon on cutoff day — "choose / confirm your books by 8pm tonight", only to families who haven't confirmed
//    (and who haven't switched swap reminders off in Settings)
//  • the evening before their Curious Day — what's happening tomorrow (delivery, collection, or both), in the words of
//    their own Collection & Delivery preferences
// Both are skipped while a membership is paused / ending (they use the 'swap_reminder' type), and never sent twice a day.
import { supabaseAdmin } from '@/lib/supabase-admin'
import { notifyHousehold } from '@/lib/notify'
import { getSettingValues } from '@/lib/settings'
import { householdDeliveryDay } from '@/lib/delivery-day'
import { preferencesOf } from '@/lib/delivery-preferences'
import { renderMessage } from '@/lib/messages'

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const dubaiWeekday = (offsetDays = 0) => new Date(Date.now() + 4 * 3600_000 + offsetDays * 86400_000).getUTCDay()
const dubaiDate = () => new Date(Date.now() + 4 * 3600_000).toISOString().slice(0, 10)
const timeLabel = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); const hr = ((h + 11) % 12) + 1; return `${hr}${m ? `:${String(m).padStart(2, '0')}` : ''}${h < 12 ? 'am' : 'pm'}` }
const books = (n: number) => `${n} ${n === 1 ? 'book' : 'books'}`

async function sentToday(householdId: string, title: string) {
  const { count } = await supabaseAdmin.from('notifications').select('id', { count: 'exact', head: true })
    .eq('household_id', householdId).eq('title', title).gte('sent_at', `${dubaiDate()}T00:00:00+04:00`)
  return (count || 0) > 0
}

async function families() {
  const { data } = await supabaseAdmin.from('households')
    .select('id, swap_reminders, bonkers_day, delivery_preference, delivery_preferences, safe_spot_description, zones ( bonkers_day, cutoff_time )')
    .eq('account_status', 'active')
  return data || []
}

// ── 12 noon on cutoff day ──
export async function sendCutoffReminders(opts: { dryRun?: boolean; weekday?: number } = {}) {
  const s = await getSettingValues(['cutoff_days_before'])
  const daysBefore = Number(s.cutoff_days_before) || 2
  const todayIdx = opts.weekday ?? dubaiWeekday()
  const sent: { householdId: string; title: string; message: string }[] = []

  for (const hh of await families()) {
    if ((hh as any).swap_reminders === false) continue
    const { day, cutoffTime } = householdDeliveryDay(hh)
    const dayIdx = day ? DAYS.indexOf(day.toLowerCase()) : -1
    if (dayIdx < 0 || ((dayIdx - daysBefore) % 7 + 7) % 7 !== todayIdx) continue

    const { data: reqs } = await supabaseAdmin.from('swap_requests').select('status, swap_request_items(id)')
      .eq('household_id', hh.id).in('status', ['draft', 'child_confirmed', 'submitted', 'confirmed'])
    const waiting = (reqs || []).filter(r => (r.status === 'draft' || r.status === 'child_confirmed') && (r as any).swap_request_items?.length).length
    const confirmed = (reqs || []).some(r => (r.status === 'submitted' || r.status === 'confirmed') && (r as any).swap_request_items?.length)
    let title = '', message = ''
    const vars = { curious_day: cap(day!), cutoff_time: timeLabel(cutoffTime) }
    if (waiting > 0) {
      ;({ title, body: message } = await renderMessage('cutoff_confirm', vars))
    } else if (!confirmed) {
      // nothing chosen yet — only worth a nudge if there's room for new books
      const { data: kids } = await supabaseAdmin.from('child_profiles').select('id').eq('household_id', hh.id)
      let space = 0
      for (const k of kids || []) { const { data: n } = await supabaseAdmin.rpc('next_delivery_space', { p_child_id: k.id }); space += Number(n) || 0 }
      if (space <= 0) continue
      ;({ title, body: message } = await renderMessage('cutoff_choose', vars))
    } else continue

    if (opts.dryRun) { sent.push({ householdId: hh.id, title, message }); continue }
    if (await sentToday(hh.id, title)) continue
    await notifyHousehold({ householdId: hh.id, type: 'swap_reminder', title, message, link: '/dashboard' }).catch(() => {})
    sent.push({ householdId: hh.id, title, message })
  }
  return sent
}

// What tomorrow looks like at the door, built from the pieces in Admin → Messages ("Tomorrow is your Curious Day"):
// the family's #1 preference, with #2 as a backup when #1 needs them home
async function tomorrowMessage(prefs: string[], spotText: string | null, delivering: number, returning: number) {
  const spot = spotText ? spotText.charAt(0).toLowerCase() + spotText.slice(1) : null
  const where: Record<string, string> = { leave_at_door: 'at your door', leave_safe_spot: spot ? `in your safe spot (${spot})` : 'in your safe spot', leave_with_reception: 'with reception' }
  const piece = async (key: string, vars: Record<string, string> = {}) => (await renderMessage(key, vars)).body
  const [first, second] = prefs
  const parts = [await piece(delivering && returning ? 'eve_lead_both' : delivering ? 'eve_lead_delivery' : 'eve_lead_collection', { returning_count: books(returning) })]
  if (first === 'ring_bell' || first === 'call_no_bell') {
    if (returning) parts.push(await piece('eve_handover'))
    parts.push(await piece(first === 'ring_bell' ? 'eve_ring' : 'eve_call'))
    if (delivering && second && where[second]) parts.push(await piece('eve_backup', { place: where[second] }))
  } else if (first && where[first]) {
    parts.push(await piece(delivering && returning ? 'eve_leave_both' : delivering ? 'eve_leave_delivery' : 'eve_leave_collection', { place: where[first] }))
  } else if (returning) parts.push(await piece('eve_no_preference'))
  return parts.join(' ')
}

// ── the evening before their Curious Day ──
export async function sendCuriousDayEveMessages(opts: { dryRun?: boolean; weekday?: number } = {}) {
  const tomorrowIdx = opts.weekday ?? dubaiWeekday(1)
  const sent: { householdId: string; title: string; message: string }[] = []
  for (const hh of await families()) {
    const { day } = householdDeliveryDay(hh)
    if (!day || DAYS.indexOf(day.toLowerCase()) !== tomorrowIdx) continue

    const [{ data: reqs }, { count: returning }] = await Promise.all([
      supabaseAdmin.from('swap_requests').select('swap_request_items(id)').eq('household_id', hh.id).in('status', ['locked', 'submitted', 'confirmed']),
      supabaseAdmin.from('loans').select('id', { count: 'exact', head: true }).eq('household_id', hh.id).eq('status', 'checked_out').eq('return_requested', true),
    ])
    const delivering = (reqs || []).reduce((n, r: any) => n + (r.swap_request_items?.length || 0), 0)
    const collecting = returning || 0
    if (!delivering && !collecting) continue   // nothing happening tomorrow → no message

    const title = (await renderMessage('eve_title')).body
    if (!opts.dryRun && await sentToday(hh.id, title)) continue
    const message = await tomorrowMessage(preferencesOf(hh as any), (hh as any).safe_spot_description, delivering, collecting)
    if (opts.dryRun) { sent.push({ householdId: hh.id, title, message }); continue }
    await notifyHousehold({ householdId: hh.id, type: 'swap_reminder', title, message, link: '/dashboard' }).catch(() => {})
    sent.push({ householdId: hh.id, title, message })
  }
  return sent
}
