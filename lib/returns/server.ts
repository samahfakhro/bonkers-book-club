import { supabaseAdmin } from '@/lib/supabase-admin'

// Returns at the warehouse.
//  • Returned books: scanned in → checked in as Good straight away (one scan), condition can be changed after.
//  • Undelivered envelopes: books go back on the normal shelves. The family's choices stay in their Coming Next
//    list, which holds a copy for them (see available_books in the database).

export type Condition = 'good' | 'worn' | 'damaged_ok' | 'withdrawn'
export const CONDITION_LABEL: Record<Condition, string> = {
  good: 'Good', worn: 'Worn but fine', damaged_ok: 'Damaged – still lendable', withdrawn: 'Damaged – withdrawn',
}
const copyFields = (c: Condition, reason: string | null) => c === 'withdrawn'
  ? { condition_grade: 'damaged', status: 'withdrawn', is_suitable_for_circulation: false, removal_reason: reason || 'damaged' }
  : { condition_grade: c === 'damaged_ok' ? 'damaged' : c, status: 'available', is_suitable_for_circulation: true, removal_reason: null }

const clean = (s: string) => s.trim().replace(/[,()]/g, '')
const familyName = (h: any) => [h?.first_name, h?.last_name].filter(Boolean).join(' ') || h?.name || 'Family'

async function findCopy(code: string) {
  const c = clean(code)
  if (!c) return null
  const { data } = await supabaseAdmin.from('book_copies')
    .select('id, book_id, internal_id, status, current_household_id, circulation_count, books(title, cover_image_url)')
    .or(`internal_id.eq.${c},barcode.eq.${c}`).limit(1)
  return data?.[0] ?? null
}

// Everything the returns screen lists
export async function returnsOverview() {
  const [{ data: due }, { data: undelivered }, { data: recent }] = await Promise.all([
    supabaseAdmin.from('loans')
      .select('id, household_id, book_copies(internal_id, books(title, cover_image_url)), child_profiles(name), households(first_name, last_name, name), route_stops:collection_stop_id(routes(route_date))')
      .eq('status', 'in_return_transit'),
    supabaseAdmin.from('swap_request_items')
      .select('id, packed_copy_id, book_copies:packed_copy_id(internal_id, status, books(title, cover_image_url)), swap_requests!inner(household_id, status, route_stop_id, child_profiles(name), households(first_name, last_name, name))')
      .not('packed_copy_id', 'is', null).is('swap_requests.route_stop_id', null).neq('swap_requests.status', 'delivered'),
    supabaseAdmin.from('return_inspections')
      .select('id, final_status, notes, inspected_at, book_copies(internal_id, condition_grade, books(title, cover_image_url)), households(first_name, last_name, name)')
      .gte('inspected_at', new Date(Date.now() - 36 * 3600_000).toISOString()).order('inspected_at', { ascending: false }).limit(200),
  ])
  return {
    due: (due || []).map((l: any) => ({
      loanId: l.id, family: familyName(l.households), child: l.child_profiles?.name || '', title: l.book_copies?.books?.title || '', cover: l.book_copies?.books?.cover_image_url || null,
      internalId: l.book_copies?.internal_id || '', collectedOn: l.route_stops?.routes?.route_date || null,
    })),
    undelivered: (undelivered || []).filter((i: any) => i.book_copies?.status === 'packed').map((i: any) => ({
      itemId: i.id, family: familyName(i.swap_requests?.households), child: i.swap_requests?.child_profiles?.name || '',
      title: i.book_copies?.books?.title || '', cover: i.book_copies?.books?.cover_image_url || null, internalId: i.book_copies?.internal_id || '',
    })),
    checkedIn: (recent || []).map((r: any) => ({
      inspectionId: r.id, title: r.book_copies?.books?.title || '', cover: r.book_copies?.books?.cover_image_url || null, internalId: r.book_copies?.internal_id || '',
      family: familyName(r.households), condition: (r.notes?.split(/[:\s]/)[0] || 'good') as Condition, at: r.inspected_at,
    })),
  }
}

// One scan in the "Returned books" tab: check the book in as Good straight away
export async function checkInByScan(code: string) {
  const copy: any = await findCopy(code)
  if (!copy) return { error: `No book found for “${code.trim()}”` }

  // An undelivered envelope book scanned in the wrong tab
  const { data: und } = await supabaseAdmin.from('swap_request_items').select('id, swap_requests!inner(route_stop_id, status)')
    .eq('packed_copy_id', copy.id).is('swap_requests.route_stop_id', null).neq('swap_requests.status', 'delivered').limit(1)
  if (und?.length && copy.status === 'packed') return { error: `${copy.books?.title} is from an UNDELIVERED envelope — scan it in the Undelivered tab` }

  const { data: loans } = await supabaseAdmin.from('loans').select('id, household_id, status')
    .eq('book_copy_id', copy.id).is('returned_at', null).in('status', ['in_return_transit', 'checked_out', 'active'])
    .order('checked_out_at', { ascending: false })
  // the one the driver collected comes first
  const loan = loans?.find(l => l.status === 'in_return_transit') ?? loans?.[0]
  if (!loan) return { error: `${copy.books?.title} (${copy.internal_id}) isn’t out on loan — status “${copy.status}”` }

  const now = new Date().toISOString()
  await supabaseAdmin.from('loans').update({ status: 'returned', returned_at: now, return_requested: false }).eq('id', loan.id)
  await supabaseAdmin.from('book_copies').update({ ...copyFields('good', null), current_household_id: null, circulation_count: (copy.circulation_count || 0) + 1, updated_at: now }).eq('id', copy.id)
  const { data: insp } = await supabaseAdmin.from('return_inspections').insert({
    book_copy_id: copy.id, household_id: loan.household_id, is_suitable_for_circulation: true, final_status: 'available', notes: 'good', inspected_at: now,
  }).select('id').single()
  return {
    ok: true, inspectionId: insp?.id, title: copy.books?.title, internalId: copy.internal_id,
    warning: loan.status === 'in_return_transit' ? null : 'The driver didn’t record collecting this one — checked in anyway',
  }
}

// Change a checked-in book's condition (damage needs a photo if withdrawn)
export async function setCondition(inspectionId: string, condition: Condition, note: string, photoPath: string | null) {
  if (!CONDITION_LABEL[condition]) return { error: 'Choose a condition' }
  if (condition === 'withdrawn' && !photoPath) return { error: 'Add a photo of the damage before withdrawing the book' }
  const { data: insp } = await supabaseAdmin.from('return_inspections').select('id, book_copy_id').eq('id', inspectionId).single()
  if (!insp) return { error: 'Check-in not found' }
  const f = copyFields(condition, note || null)
  const notes = [condition, note && `: ${note}`, photoPath && ` [photo: ${photoPath}]`].filter(Boolean).join('')
  await supabaseAdmin.from('return_inspections').update({ is_suitable_for_circulation: f.is_suitable_for_circulation, final_status: f.status, removal_reason: f.removal_reason, notes }).eq('id', inspectionId)
  await supabaseAdmin.from('book_copies').update({ ...f, updated_at: new Date().toISOString() }).eq('id', insp.book_copy_id)
  return { ok: true }
}

// One scan in the "Undelivered" tab: the book goes back on the shelf (still held for the family via Coming Next)
export async function shelveUndelivered(code: string) {
  const copy: any = await findCopy(code)
  if (!copy) return { error: `No book found for “${code.trim()}”` }
  const { data: items } = await supabaseAdmin.from('swap_request_items')
    .select('id, swap_requests!inner(household_id, route_stop_id, status, households(first_name, last_name, name))')
    .eq('packed_copy_id', copy.id).is('swap_requests.route_stop_id', null).neq('swap_requests.status', 'delivered').limit(1)
  const item: any = items?.[0]
  if (!item || copy.status !== 'packed') return { error: `${copy.books?.title} (${copy.internal_id}) isn’t from an undelivered envelope` }
  await supabaseAdmin.from('book_copies').update({ status: 'available', current_household_id: null, updated_at: new Date().toISOString() }).eq('id', copy.id)
  await supabaseAdmin.from('swap_request_items').update({ packed_copy_id: null }).eq('id', item.id)
  return { ok: true, title: copy.books?.title, internalId: copy.internal_id, family: familyName(item.swap_requests.households) }
}

