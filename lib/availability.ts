import { supabase } from '@/lib/supabase'

// Which of these books the signed-in family can still add to Coming Next.
// A copy counts only if it's on the shelf AND not already in another family's Coming Next list.
// Leave bookIds out to check the whole library.
export async function fetchAvailableBookIds(bookIds?: string[]): Promise<Set<string>> {
  if (bookIds && bookIds.length === 0) return new Set()
  const { data, error } = await supabase.rpc('available_books', { p_book_ids: bookIds ?? null })
  if (error) { console.error('available_books failed:', error); return new Set() }
  return new Set((data || []).map((r: { book_id: string }) => r.book_id))
}
