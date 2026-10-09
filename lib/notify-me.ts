import { supabaseAdmin } from '@/lib/supabase-admin'
import { notifyHousehold } from '@/lib/notify'
import { appUrl } from '@/lib/messaging'

// "Notify Me" (the bell on unavailable books). Called when returns staff press "Finished inspecting"
// and when a new copy is added in admin Books. Everyone on the book's list gets one message per batch;
// first to add it to their Coming Next list wins.
export async function sendBackOnShelfAlerts(bookIds: string[]) {
  const ids = [...new Set(bookIds)]
  if (!ids.length) return 0
  // only books with a copy nobody's Coming Next list is already holding
  const { data: free } = await supabaseAdmin.rpc('available_books', { p_book_ids: ids })
  const freeIds = (free || []).map((r: any) => r.book_id as string)
  if (!freeIds.length) return 0

  const [{ data: rows }, { data: books }] = await Promise.all([
    supabaseAdmin.from('book_availability_notifications').select('id, user_id, child_id, book_id, stop_token').in('book_id', freeIds),
    supabaseAdmin.from('books').select('id, title').in('id', freeIds),
  ])
  if (!rows?.length) return 0
  const title = new Map((books || []).map(b => [b.id, b.title as string]))
  const userIds = [...new Set(rows.map(r => r.user_id))]
  const childIds = [...new Set(rows.map(r => r.child_id).filter(Boolean))] as string[]
  const [{ data: hhs }, { data: kids }] = await Promise.all([
    supabaseAdmin.from('households').select('id, user_id').in('user_id', userIds),
    childIds.length ? supabaseAdmin.from('child_profiles').select('id, name').in('id', childIds) : Promise.resolve({ data: [] as any[] }),
  ])
  const hhByUser = new Map((hhs || []).map(h => [h.user_id, h.id as string]))
  const kidName = new Map((kids || []).map((k: any) => [k.id, k.name as string]))

  let sent = 0
  for (const r of rows) {
    const householdId = hhByUser.get(r.user_id)
    if (!householdId) continue
    const t = title.get(r.book_id) || 'A book you wanted'
    const who = r.child_id && kidName.get(r.child_id) ? `${kidName.get(r.child_id)}’s` : 'your'
    await notifyHousehold({
      householdId, type: 'notify_me', childId: r.child_id,
      title: `📚 ${t} is back!`,
      message: `Good news! ${t} is back on the Bonkers shelf. It’s first come, first served — add it to ${who} next swap before someone else does!`,
      link: `/dashboard/library/${r.book_id}?from=parent`,
      extraLink: { label: 'Stop alerts for this book', url: `${appUrl()}/stop-alerts/${r.stop_token}` },
    })
    sent++
  }
  return sent
}

// Once a family gets the book they asked about, they come off its alert list
export async function removeAlertsForHousehold(householdId: string, bookIds: string[]) {
  if (!bookIds.length) return
  const { data: hh } = await supabaseAdmin.from('households').select('user_id').eq('id', householdId).single()
  if (hh?.user_id) await supabaseAdmin.from('book_availability_notifications').delete().eq('user_id', hh.user_id).in('book_id', bookIds)
}
