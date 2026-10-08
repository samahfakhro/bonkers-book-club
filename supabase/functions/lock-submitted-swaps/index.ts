import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Runs hourly (pg_cron). At each zone's cutoff — 2 days before its delivery day, at the zone's cutoff time,
// in DUBAI time — book choices that were SUBMITTED before the cutoff are locked for packing.
// Choices submitted after the cutoff wait for the next cutoff (next week's delivery).

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const DUBAI_OFFSET_MS = 4 * 3600_000 // UTC+4 all year (no daylight saving)

// The most recent cutoff moment (as a real UTC instant) for a zone delivering on `deliveryDay`
function getMostRecentCutoff(deliveryDay: string, cutoffTime: string): Date | null {
  const dayIdx = DAYS.indexOf(deliveryDay.toLowerCase())
  if (dayIdx === -1) return null
  const cutoffDayIdx = (dayIdx - 2 + 7) % 7
  const [h, m] = cutoffTime.split(':').map(Number)
  const nowDubai = new Date(Date.now() + DUBAI_OFFSET_MS) // read with getUTC* = Dubai wall-clock
  const cutoff = new Date(Date.UTC(nowDubai.getUTCFullYear(), nowDubai.getUTCMonth(), nowDubai.getUTCDate(), h, m || 0))
  let daysBack = (nowDubai.getUTCDay() - cutoffDayIdx + 7) % 7
  if (daysBack === 0 && cutoff > nowDubai) daysBack = 7
  cutoff.setUTCDate(cutoff.getUTCDate() - daysBack)
  return new Date(cutoff.getTime() - DUBAI_OFFSET_MS)
}

Deno.serve(async () => {
  const { data: zones, error: zErr } = await supabase.from('zones').select('id, bonkers_day, cutoff_time')
  if (zErr || !zones) return new Response(JSON.stringify({ error: zErr?.message }), { status: 500 })

  let totalLocked = 0
  for (const zone of zones) {
    if (!zone.bonkers_day) continue
    const cutoffMoment = getMostRecentCutoff(zone.bonkers_day, zone.cutoff_time ?? '20:00')
    if (!cutoffMoment) continue

    const { data: households } = await supabase.from('households').select('id').eq('signup_zone_id', zone.id)
    if (!households?.length) continue

    const { data: requests, error: reqErr } = await supabase
      .from('swap_requests')
      .select('id')
      .in('household_id', households.map(h => h.id))
      .eq('status', 'submitted')
      .lte('submitted_at', cutoffMoment.toISOString())
    if (reqErr || !requests?.length) continue

    const { error: updateErr } = await supabase
      .from('swap_requests')
      .update({ status: 'locked' })
      .in('id', requests.map(r => r.id))
    if (!updateErr) totalLocked += requests.length
  }

  return new Response(JSON.stringify({ ok: true, locked: totalLocked }), { headers: { 'Content-Type': 'application/json' } })
})
