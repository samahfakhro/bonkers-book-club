import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { titleKey, ownTitle } from '@/lib/book-titles'

// The barcodes scanned for each book (table book_isbns). Admin-only: everything under /api/admin/ needs a team sign-in.
//  GET ?list=1          → every saved barcode { book_id, isbn }
//  GET ?isbn=X          → { exact: book_id | null, sameBook: { book_id, title, reason } | null }
//                          exact = this barcode is already saved for a book (or is a book's main ISBN)
//                          sameBook = a new barcode that looks like a book already in the library (same Open Library
//                          record for all editions, or same title and author). Only a suggestion: the team decides.
//  POST { bookId, isbn, setMain? } → saves the barcode for that book (409 if it belongs to a different book)

const admin = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const clean = (v: string) => (v || '').replace(/[^0-9X]/gi, '').toUpperCase()
const norm = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '')
const surname = (a: string) => norm((a || '').split(',')[0].trim().split(' ').pop() || '')

// Open Library's shared record for all editions of this barcode's book (e.g. /works/OL17610986W)
async function workKey(isbn: string): Promise<string | null> {
  try {
    const r = await fetch(`https://openlibrary.org/isbn/${isbn}.json`, { signal: AbortSignal.timeout(6000) })
    if (!r.ok) return null
    const j = await r.json()
    return j?.works?.[0]?.key || null
  } catch { return null }
}

async function googleTitleAuthor(isbn: string): Promise<{ title: string; author: string } | null> {
  const key = process.env.GOOGLE_GEOCODING_KEY
  if (!key) return null
  try {
    const g = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&key=${key}`, { signal: AbortSignal.timeout(6000) }).then(r => r.json())
    const v = g?.items?.[0]?.volumeInfo
    if (!v?.title) return null
    return { title: [v.title, v.subtitle].filter(Boolean).join(': '), author: (v.authors || [])[0] || '' }
  } catch { return null }
}

export async function GET(req: NextRequest) {
  const sb = admin()
  if (req.nextUrl.searchParams.get('list')) {
    const { data, error } = await sb.from('book_isbns').select('book_id, isbn')
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ rows: data })
  }
  const isbn = clean(req.nextUrl.searchParams.get('isbn') || '')
  if (isbn.length < 10) return NextResponse.json({ error: 'Not an ISBN' }, { status: 400 })

  const { data: saved } = await sb.from('book_isbns').select('book_id').eq('isbn', isbn).maybeSingle()
  if (saved) return NextResponse.json({ exact: saved.book_id, sameBook: null })
  const { data: books } = await sb.from('books').select('id, title, author, isbn, series:series_id(name, parent:parent_series_id(name))')
  const main = (books || []).find(b => clean(b.isbn || '') === isbn)
  if (main) return NextResponse.json({ exact: main.id, sameBook: null })

  const [wk, info] = await Promise.all([workKey(isbn), googleTitleAuthor(isbn)])
  if (wk) {
    const { data: sameWork } = await sb.from('book_isbns').select('book_id').eq('ol_work_key', wk).limit(1).maybeSingle()
    const b = sameWork && (books || []).find(x => x.id === sameWork.book_id)
    if (b) return NextResponse.json({ exact: null, sameBook: { book_id: b.id, title: b.title, reason: 'Open Library lists it as the same book' } })
  }
  if (info) {
    // exact same title once shop marketing and punctuation are ignored, and the same author's surname
    // (our titles are the book's own name, so "Dog Man: Lord of the Fleas" is compared as "Lord of the Fleas")
    const t = titleKey(info.title), a = surname(info.author)
    const b = (books || []).find((x: any) => {
      const bt = titleKey(x.title)
      const names = [x.series?.name, x.series?.parent?.name].filter(Boolean)
      return bt.length > 2 && (bt === t || bt === titleKey(ownTitle(info.title, names))) && (!a || surname(x.author) === a)
    })
    if (b) return NextResponse.json({ exact: null, sameBook: { book_id: b.id, title: b.title, reason: 'same title and author' } })
  }
  return NextResponse.json({ exact: null, sameBook: null })
}

export async function POST(req: NextRequest) {
  const { bookId, isbn: raw, setMain } = await req.json()
  const isbn = clean(raw || '')
  if (!bookId || isbn.length < 10) return NextResponse.json({ error: 'bookId and a barcode are needed' }, { status: 400 })
  const sb = admin()
  const { data: existing } = await sb.from('book_isbns').select('book_id').eq('isbn', isbn).maybeSingle()
  if (existing && existing.book_id !== bookId) {
    const { data: other } = await sb.from('books').select('id, title').eq('id', existing.book_id).single()
    return NextResponse.json({ error: 'This barcode is already saved for another book', otherBook: other }, { status: 409 })
  }
  if (!existing) {
    const { error } = await sb.from('book_isbns').insert({ book_id: bookId, isbn, ol_work_key: await workKey(isbn) })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  }
  if (setMain) await sb.from('books').update({ isbn }).eq('id', bookId)
  return NextResponse.json({ ok: true })
}
