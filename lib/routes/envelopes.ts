// A route's stops with what each visit carries: the children whose books go in this visit (one envelope each),
// their books, and how many books to collect. Used by packing AND the driver app so they always agree.
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getRoute } from '@/lib/routes/server'
import { envelopeCode, familyCode } from '@/lib/routes/codes'

export async function routeWithEnvelopes(routeId: string) {
  const route = await getRoute(routeId)
  const stopIds = route.stops.map(s => s.id)
  const hhIds = route.stops.map(s => s.household_id)

  const [{ data: requests }, { data: children }, { data: loans }] = await Promise.all([
    stopIds.length ? supabaseAdmin.from('swap_requests').select('id, child_id, route_stop_id, status').in('route_stop_id', stopIds) : Promise.resolve({ data: [] as any[] }),
    hhIds.length ? supabaseAdmin.from('child_profiles').select('id, household_id, name, last_name, created_at').in('household_id', hhIds).order('created_at') : Promise.resolve({ data: [] as any[] }),
    stopIds.length ? supabaseAdmin.from('loans').select('id, collection_stop_id').in('collection_stop_id', stopIds) : Promise.resolve({ data: [] as any[] }),
  ])
  const requestIds = (requests || []).map(r => r.id)
  const { data: items } = requestIds.length
    ? await supabaseAdmin.from('swap_request_items').select('id, swap_request_id, book_id, packed_copy_id, books(id, title, author, cover_image_url)').in('swap_request_id', requestIds)
    : { data: [] as any[] }

  const bookIds = [...new Set((items || []).map(i => i.book_id).filter(Boolean))]
  const shelf = new Map<string, string>()
  if (bookIds.length) {
    const { data: copies } = await supabaseAdmin.from('book_copies').select('book_id, shelf_location').in('book_id', bookIds).eq('status', 'available')
    for (const c of copies || []) if (c.book_id && c.shelf_location && !shelf.has(c.book_id)) shelf.set(c.book_id, c.shelf_location)
  }

  // A child's number in the family is fixed by when they were added (1, 2, 3…)
  const childNumber = new Map<string, number>()
  for (const hhId of hhIds) (children || []).filter(c => c.household_id === hhId).forEach((c, i) => childNumber.set(c.id, i + 1))

  const stops = route.stops.map(s => ({
    ...s,
    familyCode: familyCode(s.household_id),
    collectCount: (loans || []).filter(l => l.collection_stop_id === s.id).length,
    children: (requests || []).filter(r => r.route_stop_id === s.id).map(r => {
      const child = (children || []).find(c => c.id === r.child_id)
      const n = childNumber.get(r.child_id) ?? 1
      return {
        childId: r.child_id as string, requestId: r.id as string, number: n, envelopeCode: envelopeCode(s.household_id, n),
        name: (child?.name as string) || 'Child', lastName: (child?.last_name as string) || '',
        books: (items || []).filter(i => i.swap_request_id === r.id).map(i => ({
          itemId: i.id as string, bookId: i.book_id as string, packedCopyId: (i.packed_copy_id as string | null) ?? null,
          title: (i as any).books?.title || 'Unknown', author: (i as any).books?.author || null,
          coverUrl: (i as any).books?.cover_image_url || null, shelfLocation: shelf.get(i.book_id) || null,
        })),
      }
    }).filter(c => c.books.length > 0).sort((a, b) => a.number - b.number), // an empty choice is nothing to deliver
  }))
  return { ...route, stops }
}
