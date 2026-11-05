import { NextRequest, NextResponse } from 'next/server'

// Title suggestions while typing in Admin → Books → Add a book. Google Books (server key), English editions with an ISBN only.
// Picking one runs the normal ISBN lookup, so covers, descriptions and duplicate checks all work the same way.
// (Admin-only: everything under /api/admin/ needs a team sign-in, see proxy.ts.)
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get('q') || '').trim()
  const key = process.env.GOOGLE_GEOCODING_KEY
  if (q.length < 3 || !key) return NextResponse.json({ results: [] })
  try {
    const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&langRestrict=en&printType=books&maxResults=20&key=${key}`
    const g = await fetch(url, { signal: AbortSignal.timeout(6000) }).then(r => r.json())
    const seen = new Set<string>()
    const results = ((g?.items || []) as any[]).flatMap(item => {
      const v = item.volumeInfo || {}
      if (v.language && v.language !== 'en') return []
      const ids = (v.industryIdentifiers || []) as { type: string; identifier: string }[]
      const isbn = ids.find(i => i.type === 'ISBN_13')?.identifier || ids.find(i => i.type === 'ISBN_10')?.identifier
      if (!isbn || seen.has(isbn)) return []
      seen.add(isbn)
      return [{
        isbn,
        title: [v.title, v.subtitle].filter(Boolean).join(': '),
        author: ((v.authors || []) as string[]).filter(a => !/fictitious character/i.test(a)).slice(0, 2).join(', '),
        year: (v.publishedDate || '').slice(0, 4),
        publisher: v.publisher || '',
        thumbnail: (v.imageLinks?.smallThumbnail || v.imageLinks?.thumbnail || '').replace('http://', 'https://'),
      }]
    }).slice(0, 8)
    return NextResponse.json({ results })
  } catch {
    return NextResponse.json({ results: [] })
  }
}
