// Adding books to a child's next delivery — one place for the rules, used by the library, book page, dashboard and child profile.
// Space comes from the database (next_delivery_space): allocation − books at home not marked Returning − books already chosen.
// The database also refuses an add to a full delivery (NEXT_DELIVERY_FULL), so it holds even across two phones.
import { supabase } from '@/lib/supabase'

export const ACTIVE_REQUEST_STATUSES = ['draft', 'child_confirmed', 'submitted', 'confirmed']

export async function nextDeliverySpace(childId: string): Promise<number> {
  const { data, error } = await supabase.rpc('next_delivery_space', { p_child_id: childId })
  if (error) { console.error('next_delivery_space failed:', error); return 1 } // never block on a lookup hiccup — the database still checks
  return typeof data === 'number' ? data : 0
}

export type AddResult = { ok: true } | { ok: false; reason: 'full' | 'on_hold' | 'inactive' | 'error'; message?: string }

// Adds a book to the child's next delivery, creating their draft request if needed.
export async function addToNextDelivery(householdId: string, childId: string, bookId: string): Promise<AddResult> {
  const { data: existing } = await supabase.from('swap_requests').select('id, status')
    .eq('child_id', childId).in('status', ACTIVE_REQUEST_STATUSES).order('created_at', { ascending: false }).limit(1).maybeSingle()
  let reqId = existing?.id as string | undefined
  if (!reqId) {
    const { data: created, error } = await supabase.from('swap_requests').insert({ household_id: householdId, child_id: childId, status: 'draft' }).select('id').single()
    if (error || !created) return { ok: false, reason: 'error', message: error?.message }
    reqId = created.id
  } else if (existing && (existing.status === 'child_confirmed' || existing.status === 'submitted')) {
    // changing the pile means it needs confirming again (books can only be added to a draft)
    await supabase.from('swap_requests').update({ status: 'draft' }).eq('id', reqId)
  }
  const { error } = await supabase.from('swap_request_items').insert({ swap_request_id: reqId, book_id: bookId, child_id: childId })
  if (!error || error.code === '23505') return { ok: true }
  if (error.message.includes('MEMBERSHIP_INACTIVE')) return { ok: false, reason: 'inactive' }
  if (error.message.includes('NEXT_DELIVERY_FULL')) return { ok: false, reason: 'full' }
  if (error.message.includes('NEW_BOOKS_ON_HOLD')) return { ok: false, reason: 'on_hold' }
  return { ok: false, reason: 'error', message: error.message }
}

// Opens the "next delivery is full" sheet (mounted once in the dashboard layout).
export type FullDeliveryRequest = {
  childId: string
  book: { id: string; title: string; cover_image_url?: string | null }
  forChild?: boolean               // a child is using the app — friendlier wording
  onAdded?: () => void             // the book ended up in the delivery
}
export const FULL_DELIVERY_EVENT = 'curious:full-delivery'
export function openFullDelivery(req: FullDeliveryRequest) {
  window.dispatchEvent(new CustomEvent<FullDeliveryRequest>(FULL_DELIVERY_EVENT, { detail: req }))
}

// After the cutoff, enough books must stay marked Returning for the delivery that's on its way (database rule RETURNS_NEEDED)
export function returnsNeededMessage(error: { message?: string } | null, forChild = false): string | null {
  const m = error?.message?.match(/RETURNS_NEEDED:(\d+)/)
  if (!m) return null
  const n = Number(m[1])
  return forChild
    ? `${n} ${n === 1 ? 'book needs' : 'books need'} to go back so your new books can come. Pick a different one to keep instead!`
    : `${n} ${n === 1 ? 'book needs' : 'books need'} to go back for your new books to arrive. Choose a different one to keep instead.`
}
