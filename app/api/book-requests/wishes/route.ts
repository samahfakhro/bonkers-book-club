import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// "Your wish came true!" — books a child asked for that are now in the library and they haven't seen yet.
// GET ?childId=…   → the child's unseen wishes
// POST { ids }     → mark them seen (the card goes away for good)

async function householdFor(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace(/^Bearer /, '')
  if (!token) return null
  const { data: { user } } = await supabaseAdmin.auth.getUser(token)
  if (!user) return null
  const { data } = await supabaseAdmin.from('households').select('id').eq('user_id', user.id).maybeSingle()
  return data?.id ?? null
}

export async function GET(req: NextRequest) {
  const householdId = await householdFor(req)
  if (!householdId) return NextResponse.json({ error: 'Please sign in again' }, { status: 401 })
  const childId = req.nextUrl.searchParams.get('childId')
  if (!childId) return NextResponse.json({ wishes: [] })
  const { data, error } = await supabaseAdmin.from('book_requests')
    .select('id, books ( id, title, author, cover_image_url )')
    .eq('household_id', householdId).eq('child_id', childId).eq('status', 'added').is('child_seen_at', null).not('book_id', 'is', null)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  // one card per book, even if the child asked for it twice
  const seen = new Set<string>()
  const wishes = (data || []).flatMap((r: any) => {
    if (!r.books || seen.has(r.books.id)) return []
    seen.add(r.books.id)
    return [{ requestIds: (data || []).filter((x: any) => x.books?.id === r.books.id).map((x: any) => x.id), book: r.books }]
  })
  return NextResponse.json({ wishes })
}

export async function POST(req: NextRequest) {
  const householdId = await householdFor(req)
  if (!householdId) return NextResponse.json({ error: 'Please sign in again' }, { status: 401 })
  const { ids } = await req.json().catch(() => ({}))
  if (!Array.isArray(ids) || !ids.length) return NextResponse.json({ ok: true })
  await supabaseAdmin.from('book_requests').update({ child_seen_at: new Date().toISOString() }).in('id', ids).eq('household_id', householdId)
  return NextResponse.json({ ok: true })
}
