import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { titleKey } from '@/lib/book-requests'

// A parent or child asks us to add a book or series. Only admins ever see requests.
export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace(/^Bearer /, '')
  if (!token) return NextResponse.json({ error: 'Please sign in again' }, { status: 401 })
  const { data: { user } } = await supabaseAdmin.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Please sign in again' }, { status: 401 })
  const { data: household } = await supabaseAdmin.from('households').select('id').eq('user_id', user.id).maybeSingle()
  if (!household) return NextResponse.json({ error: 'We couldn’t find your account' }, { status: 404 })

  const { title, author, note, childId } = await req.json().catch(() => ({}))
  const cleanTitle = typeof title === 'string' ? title.trim().slice(0, 200) : ''
  if (!cleanTitle) return NextResponse.json({ error: 'Tell us the name of the book or series' }, { status: 400 })

  // a child id must belong to this family
  let child: string | null = null
  if (childId) {
    const { data: c } = await supabaseAdmin.from('child_profiles').select('id').eq('id', childId).eq('household_id', household.id).maybeSingle()
    child = c?.id ?? null
  }

  const { error } = await supabaseAdmin.from('book_requests').insert({
    household_id: household.id, child_id: child, title: cleanTitle, title_key: titleKey(cleanTitle) || cleanTitle.toLowerCase(),
    author: typeof author === 'string' && author.trim() ? author.trim().slice(0, 120) : null,
    note: typeof note === 'string' && note.trim() ? note.trim().slice(0, 500) : null,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
