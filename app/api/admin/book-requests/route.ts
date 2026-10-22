import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { notifyHousehold } from '@/lib/notify'
import { REQUEST_STATUSES, type RequestStatus } from '@/lib/book-requests'
import { renderMessage } from '@/lib/messages'

// Admin → Book Requests. Requests for the same title are grouped; changing a group's status changes every request in it.
// Marking a group "Added" with its library book tells every family who asked. (proxy.ts: admins only.)

type Row = {
  id: string; title: string; title_key: string; author: string | null; note: string | null; status: RequestStatus; book_id: string | null
  notified_at: string | null; created_at: string; household_id: string; child_id: string | null
  households: { first_name: string | null; last_name: string | null } | null
  child_profiles: { name: string | null; nickname: string | null } | null
  books: { id: string; title: string } | null
}

export async function GET() {
  const { data, error } = await supabaseAdmin.from('book_requests')
    .select('id, title, title_key, author, note, status, book_id, notified_at, created_at, household_id, child_id, households ( first_name, last_name ), child_profiles ( name, nickname ), books ( id, title )')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const groups = new Map<string, Row[]>()
  for (const r of (data || []) as unknown as Row[]) groups.set(r.title_key, [...(groups.get(r.title_key) || []), r])

  const list = [...groups.entries()].map(([key, rows]) => {
    const families = new Set(rows.map(r => r.household_id)).size
    // show the title as most people typed it
    const counts = new Map<string, number>()
    rows.forEach(r => counts.set(r.title, (counts.get(r.title) || 0) + 1))
    const title = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0]
    const authors = [...new Set(rows.map(r => r.author).filter(Boolean))]
    // the group's status is the furthest along any of its requests has got
    const status = (['added', 'ordered', 'not_adding', 'new'] as RequestStatus[]).find(s => rows.some(r => r.status === s)) || 'new'
    const book = rows.find(r => r.books)?.books || null
    return {
      key, title, authors, families, status, book, latest: rows[0].created_at,
      requests: rows.map(r => ({
        id: r.id, created_at: r.created_at, note: r.note,
        family: [r.households?.first_name, r.households?.last_name].filter(Boolean).join(' ') || 'A family',
        reader: r.child_profiles?.nickname || r.child_profiles?.name || null,
      })),
    }
  }).sort((a, b) => b.families - a.families || b.latest.localeCompare(a.latest))

  return NextResponse.json({ groups: list })
}

export async function PATCH(req: NextRequest) {
  const { key, status, bookId } = await req.json().catch(() => ({}))
  if (!key || !REQUEST_STATUSES.includes(status)) return NextResponse.json({ error: 'Choose a status' }, { status: 400 })
  if (status === 'added' && !bookId) return NextResponse.json({ error: 'Pick the library book it was added as' }, { status: 400 })

  let book: { id: string; title: string } | null = null
  if (bookId) {
    const { data } = await supabaseAdmin.from('books').select('id, title').eq('id', bookId).maybeSingle()
    if (!data) return NextResponse.json({ error: 'That book wasn’t found' }, { status: 404 })
    book = data
  }

  const { error } = await supabaseAdmin.from('book_requests').update({ status, ...(book ? { book_id: book.id } : {}) }).eq('title_key', key)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // tell everyone who asked (once) that it's now in the library
  let notified = 0
  if (status === 'added' && book) {
    const { data: waiting } = await supabaseAdmin.from('book_requests').select('id, household_id, child_id').eq('title_key', key).is('notified_at', null)
    const told = new Set<string>()
    for (const r of waiting || []) {
      const who = `${r.household_id}:${r.child_id || ''}`
      if (told.has(who)) continue
      told.add(who)
      const here = await renderMessage('request_added', { book_title: book.title })
      await notifyHousehold({
        householdId: r.household_id, childId: r.child_id, type: 'general',
        title: here.title,
        message: here.body,
        link: r.child_id ? `/dashboard/library/${book.id}?from=child&childId=${r.child_id}` : `/dashboard/library/${book.id}?from=parent`,
      }).catch(() => {})
      notified++
    }
    if (waiting?.length) await supabaseAdmin.from('book_requests').update({ notified_at: new Date().toISOString() }).in('id', waiting.map(r => r.id))
  }
  return NextResponse.json({ ok: true, notified })
}
