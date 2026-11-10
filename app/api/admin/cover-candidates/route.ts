import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Suggested covers for one book, for the team to choose from on /admin/books/covers.
// Sources: Google Books (by ISBN, then by title), Open Library (by ISBN, then by title, English only), Penguin's site.
// Nothing is saved until someone taps a cover; title matches can be other editions, so a person always checks.
// Never Amazon.

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const BROWSER_UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36' }
const ALLOWED = /^https:\/\/(books\.google\.com|books\.googleusercontent\.com|covers\.openlibrary\.org|archive\.org|[a-z0-9-]+\.us\.archive\.org|images\.penguinrandomhouse\.com|[a-z0-9.-]*penguin\.co\.uk|[a-z0-9.-]*penguinrandomhouse\.com)\//i

type Candidate = { url: string; source: string }
const json = (url: string) => fetch(url, { signal: AbortSignal.timeout(7000) }).then(r => r.ok ? r.json() : null).catch(() => null)
const norm = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '')

function googleImage(v: any): string | null {
  if (!v?.id || !v.volumeInfo?.imageLinks) return null
  return `https://books.google.com/books/content?id=${v.id}&printsec=frontcover&img=1&zoom=1&fife=w800-h1200&source=gbs_api`
}

async function penguinCover(isbn: string): Promise<string | null> {
  const search = await fetch(`https://www.penguin.co.uk/search-results?q=${isbn}`, { headers: BROWSER_UA, signal: AbortSignal.timeout(7000) }).then(r => r.ok ? r.text() : '').catch(() => '')
  const path = search.match(new RegExp(`/books/\\d+/[^"'\\s]*/${isbn}`))?.[0]
  if (!path) return null
  const page = await fetch('https://www.penguin.co.uk' + path, { headers: BROWSER_UA, signal: AbortSignal.timeout(7000) }).then(r => r.ok ? r.text() : '').catch(() => '')
  const img = page.match(/<meta property="og:image" content="([^"]+)"/)?.[1]
  return img && ALLOWED.test(img) ? img : null
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { data: book } = await sb.from('books').select('title, author, isbn').eq('id', id).maybeSingle()
  if (!book) return NextResponse.json({ error: 'book not found' }, { status: 404 })
  const isbn = (book.isbn || '').replace(/[^0-9X]/gi, '')
  const author = (book.author || '').split(/[,&]/)[0].trim()
  const key = process.env.GOOGLE_GEOCODING_KEY
  const gq = (q: string) => key ? json(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&langRestrict=en&printType=books&maxResults=6&key=${key}`) : Promise.resolve(null)

  const [gIsbn, gTitle, olSearch, penguin] = await Promise.all([
    isbn ? gq(`isbn:${isbn}`) : null,
    gq(`intitle:${book.title}${author ? ` inauthor:${author}` : ''}`),
    json(`https://openlibrary.org/search.json?${new URLSearchParams({ title: book.title, author, fields: 'title,cover_i,language', limit: '10' })}`),
    isbn.length === 13 ? penguinCover(isbn) : null,
  ])

  const out: Candidate[] = []
  const add = (url: string | null, source: string) => { if (url && !out.some(c => c.url === url)) out.push({ url, source }) }
  for (const v of gIsbn?.items || []) add(googleImage(v), 'Google · same barcode')
  if (penguin) add(penguin, 'Penguin website')
  if (isbn) add(`https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`, 'Open Library · same barcode')
  for (const v of (gTitle?.items || []).filter((v: any) => norm(v.volumeInfo?.title).includes(norm(book.title)) || norm(book.title).includes(norm(v.volumeInfo?.title))).slice(0, 4))
    add(googleImage(v), 'Google · same title')
  for (const d of (olSearch?.docs || []).filter((d: any) => d.cover_i && (!d.language || d.language.includes('eng'))).slice(0, 3))
    add(`https://covers.openlibrary.org/b/id/${d.cover_i}-L.jpg`, 'Open Library · same title')
  return NextResponse.json({ candidates: out })
}

// Save the chosen suggestion: the server downloads it and stores our own copy.
export async function POST(req: NextRequest) {
  const { id, url } = await req.json()
  if (!id || !url || !ALLOWED.test(url)) return NextResponse.json({ error: 'not an allowed cover address' }, { status: 400 })
  const res = await fetch(url, { headers: BROWSER_UA, signal: AbortSignal.timeout(10000) }).catch(() => null)
  const type = res?.headers.get('content-type') || ''
  if (!res?.ok || !type.startsWith('image/')) return NextResponse.json({ error: 'that cover could not be downloaded' }, { status: 400 })
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length < 3000) return NextResponse.json({ error: 'that image is too small to be a cover' }, { status: 400 })
  const ext = type.includes('png') ? 'png' : 'jpg'
  const path = `${id}-${Date.now()}.${ext}`
  const { error } = await sb.storage.from('book-covers').upload(path, buf, { contentType: type, upsert: true })
  if (error) return NextResponse.json({ error: 'storage upload failed' }, { status: 500 })
  const publicUrl = sb.storage.from('book-covers').getPublicUrl(path).data.publicUrl
  await sb.from('books').update({ cover_image_url: publicUrl }).eq('id', id)
  return NextResponse.json({ publicUrl })
}
