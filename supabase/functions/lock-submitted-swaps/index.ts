import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const DAYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday']

function getMostRecentCutoff(swapDay: string, cutoffTime: string): Date {
  const swapIdx = DAYS.indexOf(swapDay.toLowerCase())
  if (swapIdx === -1) return new Date(0)
  const cutoffDayIdx = (swapIdx - 2 + 7) % 7
  const [hours, minutes] = cutoffTime.split(':').map(Number)
  const now = new Date()
  const result = new Date(now)
  result.setHours(hours, minutes, 0, 0)
  result.setSeconds(0, 0)
  let daysBack = (now.getDay() - cutoffDayIdx + 7) % 7
  if (daysBack === 0 && result > now) daysBack = 7
  result.setDate(now.getDate() - daysBack)
  return result
}

Deno.serve(async () => {
  const { data: communities, error: commErr } = await supabase
    .from('communities')
    .select('id, swap_days, swap_cutoff_time')

  if (commErr || !communities) {
    return new Response(JSON.stringify({ error: commErr?.message }), { status: 500 })
  }

  let totalLocked = 0

  for (const community of communities) {
    const swapDay = Array.isArray(community.swap_days)
      ? community.swap_days[0]
      : community.swap_days
    const cutoffTime = community.swap_cutoff_time ?? '20:00'

    if (!swapDay) continue

    const cutoffMoment = getMostRecentCutoff(swapDay, cutoffTime)

    // Only lock if cutoff has actually passed
    if (cutoffMoment > new Date()) continue

    const { data: households } = await supabase
      .from('households')
      .select('id')
      .eq('community_id', community.id)

    if (!households?.length) continue

    const householdIds = households.map(h => h.id)

    // Find all submitted swap requests for this community
    const { data: requests, error: reqErr } = await supabase
      .from('swap_requests')
      .select('id')
      .in('household_id', householdIds)
      .eq('status', 'submitted')

    if (reqErr || !requests?.length) continue

    const requestIds = requests.map(r => r.id)

    const { error: updateErr } = await supabase
      .from('swap_requests')
      .update({ status: 'locked' })
      .in('id', requestIds)

    if (!updateErr) totalLocked += requestIds.length
  }

  return new Response(
    JSON.stringify({ ok: true, locked: totalLocked }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
