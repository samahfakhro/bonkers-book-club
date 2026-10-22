import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// Admin → Reviews. Written comments wait here until approved; stars and category blobs show straight away.
// (proxy.ts already makes sure only admins get here.)
const STATUSES = ['pending', 'approved', 'hidden'] as const

export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get('status') || 'pending'
  if (!STATUSES.includes(status as typeof STATUSES[number])) return NextResponse.json({ error: 'Unknown status' }, { status: 400 })
  const { data, error } = await supabaseAdmin.from('book_reviews')
    .select('id, star_rating, review_text, moderation_status, created_at, books ( title, cover_image_url ), child_profiles ( name, nickname, households ( first_name, last_name ) )')
    .eq('moderation_status', status).not('review_text', 'is', null).neq('review_text', '')
    .order('created_at', { ascending: status === 'pending' }).limit(200)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const { count } = await supabaseAdmin.from('book_reviews').select('id', { count: 'exact', head: true })
    .eq('moderation_status', 'pending').not('review_text', 'is', null).neq('review_text', '')
  return NextResponse.json({ reviews: data || [], pendingCount: count ?? 0 })
}

export async function PATCH(req: NextRequest) {
  const { id, status } = await req.json().catch(() => ({}))
  if (!id || !['approved', 'hidden'].includes(status)) return NextResponse.json({ error: 'Choose approve or hide' }, { status: 400 })
  const { error } = await supabaseAdmin.from('book_reviews').update({ moderation_status: status }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
