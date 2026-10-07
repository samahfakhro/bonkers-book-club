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

  let totalCleared = 0

  for (const community of communities) {
    const swapDay = Array.isArray(community.swap_days)
      ? community.swap_days[0]
      : community.swap_days
    const cutoffTime = community.swap_cutoff_time ?? '20:00'

    if (!swapDay) continue

    const cutoffMoment = getMostRecentCutoff(swapDay, cutoffTime)

    const { data: households } = await supabase
      .from('households')
      .select('id')
      .eq('community_id', community.id)

    if (!households?.length) continue

    const householdIds = households.map(h => h.id)

    // Fetch all draft/child_confirmed requests with child swap_permission
    const { data: requests } = await supabase
      .from('swap_requests')
      .select('id, child_id, child_profiles(swap_permission)')
      .in('household_id', householdIds)
      .in('status', ['draft', 'child_confirmed'])
      .lt('created_at', cutoffMoment.toISOString())

    if (!requests?.length) continue

    // All unsubmitted requests at cutoff: clear items to saved list
    for (const reqId of requests.map(r => r.id)) {
      const req = requests.find(r => r.id === reqId)!
      const childId = req.child_id

      // Get items
      const { data: items } = await supabase
        .from('swap_request_items')
        .select('book_id')
        .eq('swap_request_id', reqId)

      if (items?.length) {
        // Upsert each book into the child's wishlist (ignore duplicates)
        const wishlistRows = items.map(item => ({ child_id: childId, book_id: item.book_id }))
        await supabase
          .from('wishlists')
          .upsert(wishlistRows, { onConflict: 'child_id,book_id', ignoreDuplicates: true })

        // Remove items from the swap request
        await supabase
          .from('swap_request_items')
          .delete()
          .eq('swap_request_id', reqId)
      }

      // Reset request back to draft (empty, ready for next cycle)
      await supabase
        .from('swap_requests')
        .update({ status: 'draft' })
        .eq('id', reqId)

      totalCleared++
    }
  }

  return new Response(
    JSON.stringify({ ok: true, cleared: totalCleared }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
