import { supabaseAdmin } from '@/lib/supabase-admin'
import { notifyHousehold } from '@/lib/notify'
import { allowanceByHousehold } from '@/lib/returns/finish'
import { renderMessage } from '@/lib/messages'

// Admin edits a child's "Coming next" books from the family's page in Members.
// Allowed until packed. Only books with a free copy can be added. Every change is logged
// and the family gets a short note in their Messages envelope.

const OPEN = ['draft', 'child_confirmed', 'submitted', 'awaiting_approval', 'approved', 'locked', 'delivery_failed']

// free copies of a book for THIS family: on the shelf minus copies held in other families' lists
async function freeCopiesFor(bookId: string, householdId: string) {
  const [{ count: shelf }, { data: held }] = await Promise.all([
    supabaseAdmin.from('book_copies').select('id', { count: 'exact', head: true }).eq('book_id', bookId).eq('status', 'available'),
    supabaseAdmin.from('swap_request_items').select('id, swap_requests!inner(household_id, status)').eq('book_id', bookId).is('packed_copy_id', null)
      .in('swap_requests.status', OPEN).neq('swap_requests.household_id', householdId),
  ])
  return (shelf || 0) - (held?.length || 0)
}

async function packedStop(requestRouteStopId: string | null) {
  if (!requestRouteStopId) return false
  const { data } = await supabaseAdmin.from('route_stops').select('status').eq('id', requestRouteStopId).maybeSingle()
  return data?.status === 'packed' || data?.status === 'done'
}

export async function householdSwaps(householdId: string) {
  const [{ data: kids }, { data: reqs }, { atHome, planFor }, { data: returning }] = await Promise.all([
    supabaseAdmin.from('child_profiles').select('id, name').eq('household_id', householdId).order('created_at'),
    supabaseAdmin.from('swap_requests').select('id, child_id, status, route_stop_id, swap_request_items(id, book_id, packed_copy_id, books(title, cover_image_url))')
      .eq('household_id', householdId).in('status', OPEN).order('created_at', { ascending: false }),
    allowanceByHousehold(),
    supabaseAdmin.from('loans').select('id', { count: 'exact' }).eq('household_id', householdId).eq('return_requested', true).is('returned_at', null),
  ])
  const chosen = (reqs || []).reduce((n, r: any) => n + (r.swap_request_items?.length || 0), 0)
  const plan = planFor(householdId)
  const staying = (atHome.get(householdId) || 0) - (returning?.length || 0)
  const children = await Promise.all((kids || []).map(async k => {
    const req: any = (reqs || []).find(r => r.child_id === k.id)
    return {
      childId: k.id, name: k.name, requestId: req?.id ?? null, status: req?.status ?? null,
      packed: req ? await packedStop(req.route_stop_id) : false,
      books: (req?.swap_request_items || []).map((i: any) => ({ itemId: i.id, bookId: i.book_id, title: i.books?.title || '', cover: i.books?.cover_image_url || null, packed: !!i.packed_copy_id })),
    }
  }))
  return { children, plan, staying, chosen, slotsLeft: Math.max(0, plan - staying - chosen) }
}

export async function searchBooksForFamily(householdId: string, q: string) {
  const term = q.trim().replace(/[%,()]/g, '')
  if (term.length < 2) return []
  const { data } = await supabaseAdmin.from('books').select('id, title, author, cover_image_url').eq('is_active', true).ilike('title', `%${term}%`).limit(12)
  return Promise.all((data || []).map(async b => ({ ...b, free: await freeCopiesFor(b.id, householdId) })))
}

export async function adminAddBook(admin: string, householdId: string, childId: string, bookId: string) {
  const { data: kid } = await supabaseAdmin.from('child_profiles').select('id, name, household_id').eq('id', childId).single()
  if (!kid || kid.household_id !== householdId) return { error: 'Child not found in this family' }
  if (await freeCopiesFor(bookId, householdId) <= 0) return { error: 'No free copy of this book on the shelf' }
  let { data: req } = await supabaseAdmin.from('swap_requests').select('id, route_stop_id').eq('household_id', householdId).eq('child_id', childId).in('status', OPEN).order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (req && await packedStop(req.route_stop_id)) return { error: 'These books are already packed' }
  if (!req) {
    const { data: created, error } = await supabaseAdmin.from('swap_requests').insert({ household_id: householdId, child_id: childId, status: 'draft' }).select('id, route_stop_id').single()
    if (error) return { error: error.message }
    req = created
  }
  const { count } = await supabaseAdmin.from('swap_request_items').select('id', { count: 'exact', head: true }).eq('swap_request_id', req!.id).eq('book_id', bookId)
  if (count) return { error: 'Already in their Coming next' }
  const { error } = await supabaseAdmin.from('swap_request_items').insert({ swap_request_id: req!.id, child_id: childId, book_id: bookId })
  if (error) return { error: error.message }
  const { data: book } = await supabaseAdmin.from('books').select('title').eq('id', bookId).single()
  await supabaseAdmin.from('admin_audit_log').insert({ admin_email: admin, action: 'swap_add_book', household_id: householdId, detail: `${kid.name}: + ${book?.title}` })
  const added = await renderMessage('swap_added', { child_name: kid.name, book_title: book?.title || 'a book' })
  await notifyHousehold({ householdId, childId, type: 'general', title: added.title, message: added.body, link: '/dashboard' })
  return { ok: true }
}

export async function adminRemoveBook(admin: string, householdId: string, itemId: string) {
  const { data: item } = await supabaseAdmin.from('swap_request_items')
    .select('id, packed_copy_id, child_id, books(title), swap_requests!inner(household_id, route_stop_id, status)').eq('id', itemId).single()
  const r: any = item?.swap_requests
  if (!item || r?.household_id !== householdId) return { error: 'Book not found in this family’s Coming next' }
  if (item.packed_copy_id || await packedStop(r.route_stop_id)) return { error: 'This book is already packed — unpack it first' }
  await supabaseAdmin.from('swap_request_items').delete().eq('id', itemId)
  const { data: kid } = await supabaseAdmin.from('child_profiles').select('name').eq('id', item.child_id).single()
  const title = (item.books as any)?.title
  await supabaseAdmin.from('admin_audit_log').insert({ admin_email: admin, action: 'swap_remove_book', household_id: householdId, detail: `${kid?.name}: − ${title}` })
  const removed = await renderMessage('swap_removed', { child_name: kid?.name || 'your child', book_title: title })
  await notifyHousehold({ householdId, childId: item.child_id, type: 'general', title: removed.title, message: removed.body, link: '/dashboard' })
  return { ok: true }
}
