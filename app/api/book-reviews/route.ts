import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getReviewDisplayName } from '@/lib/review-display'

// Reviews on a book page. Families can't read other families' children, so the reviewer's name and avatar
// come from here: the name the parent chose ("Layla, Age 8" or "Curious reader, Age 8"), never anything else.
// Hidden reviews are left out; words only show once approved.
export async function GET(req: NextRequest) {
  const bookId = req.nextUrl.searchParams.get('bookId')
  if (!bookId) return NextResponse.json({ error: 'bookId required' }, { status: 400 })
  const { data, error } = await supabaseAdmin
    .from('book_reviews')
    .select('id, star_rating, review_text, moderation_status, category_ratings, child_profiles ( name, review_display, date_of_birth, avatars ( image_url ) )')
    .eq('book_id', bookId).neq('moderation_status', 'hidden')
    .order('created_at', { ascending: false }).limit(10)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const reviews = (data || []).map((r: any) => ({
    id: r.id,
    rating: r.star_rating,
    written_review: r.moderation_status === 'approved' ? r.review_text : null,
    category_ratings: r.category_ratings ?? null,
    child: r.child_profiles ? {
      display_name: getReviewDisplayName(r.child_profiles.name, r.child_profiles.review_display, r.child_profiles.date_of_birth),
      avatar_url: r.child_profiles.avatars?.image_url ?? null,
    } : null,
  }))
  return NextResponse.json({ reviews })
}
