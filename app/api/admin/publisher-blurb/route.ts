import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// The publisher's own description of a book (Google Books, then Penguin's site), so the team can compare it with
// ours on the book page in admin and switch to it. Read-only: nothing is saved here.
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const BROWSER_UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36' }
const decode = (t: string) => t
  .replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<[^>]+>/g, ' ')
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
  .replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').replace(/\n{2,}/g, '\n').trim()
const getText = (url: string) => fetch(url, { headers: BROWSER_UA, signal: AbortSignal.timeout(8000) }).then(r => r.ok ? r.text() : '').catch(() => '')

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { data: book } = await sb.from('books').select('isbn').eq('id', id).maybeSingle()
  const isbn = (book?.isbn || '').replace(/[^0-9X]/gi, '')
  if (!isbn) return NextResponse.json({ blurb: null, reason: 'This book has no barcode, so the publisher’s description can’t be looked up.' })

  // 1. Google Books
  const key = process.env.GOOGLE_GEOCODING_KEY
  const g = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}${key ? `&key=${key}` : ''}`, { signal: AbortSignal.timeout(8000) }).then(r => r.ok ? r.json() : null).catch(() => null)
  const gd = (g?.items || []).find((v: any) => (v.volumeInfo?.description || '').length > 60)?.volumeInfo?.description
  if (gd) return NextResponse.json({ blurb: decode(gd), source: 'Google Books' })
  const googleLimit = /quota/i.test(g?.error?.message || '')

  // 2. Penguin's own site (Puffin, Ladybird and the other Penguin imprints)
  const search = await getText(`https://www.penguin.co.uk/search-results?q=${isbn}`)
  const path = search.match(new RegExp(`/books/\\d+/[^"'\\s]*/${isbn}`))?.[0]
  if (path) {
    const page = await getText('https://www.penguin.co.uk' + path)
    const syn = page.match(/<meta name="synopsis" content="([^"]*)"/)?.[1]
    if (syn && syn.length > 60) return NextResponse.json({ blurb: decode(syn), source: 'Penguin' })
  }
  return NextResponse.json({ blurb: null, reason: googleLimit
    ? 'Google Books has reached its daily limit, so its description can’t be checked right now. Try again tomorrow.'
    : 'No publisher’s description was found for this book.' })
}
