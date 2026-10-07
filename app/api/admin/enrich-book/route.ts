import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const OL_SEARCH = 'https://openlibrary.org/search.json'
const OL_COVERS = 'https://covers.openlibrary.org/b/id'
const OL_WORKS  = 'https://openlibrary.org'

function parseDoc(doc: any) {
  return {
    volumeId: doc.key as string,
    title: (doc.title || '') as string,
    author: ((doc.author_name || []) as string[]).slice(0, 2).join(', '),
    isbn: ((doc.isbn || []) as string[]).find((i: string) => i.length === 13) || ((doc.isbn || [])[0] || ''),
    pageCount: (doc.number_of_pages_median || null) as number | null,
    subjects: (doc.subject || []) as string[],
    coverId: (doc.cover_i || null) as number | null,
    thumbnailUrl: doc.cover_i ? `${OL_COVERS}/${doc.cover_i}-M.jpg` : null,
    description: '',
  }
}

async function fetchDescription(workKey: string): Promise<string> {
  try {
    const res = await fetch(`${OL_WORKS}${workKey}.json`, { signal: AbortSignal.timeout(5000) })
    const data = await res.json()
    const desc = data.description
    if (!desc) return ''
    return typeof desc === 'string' ? desc : (desc.value || '')
  } catch { return '' }
}

async function fetchCoverBase64(coverId: number): Promise<string | null> {
  try {
    const res = await fetch(`${OL_COVERS}/${coverId}-L.jpg`, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return null
    const buf = await res.arrayBuffer()
    return `data:image/jpeg;base64,${Buffer.from(buf).toString('base64')}`
  } catch { return null }
}

async function enrichWithClaude(book: ReturnType<typeof parseDoc> & { categoryNames?: string[] }, apiKey: string): Promise<{ result: any; error?: string }> {
  try {
    const client = new Anthropic({ apiKey })
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      messages: [{
        role: 'user',
        content: `You are cataloguing children's books for a library called Bonkers.

Book: "${book.title}" by ${book.author}
${book.description ? `Description: ${book.description.slice(0, 600)}` : ''}
${book.subjects.length ? `Subjects: ${book.subjects.slice(0, 10).join(', ')}` : ''}
${book.pageCount ? `Pages: ${book.pageCount}` : ''}
${book.categoryNames?.length ? `\nAvailable library categories (pick all that apply): ${book.categoryNames.join(', ')}` : ''}

Return ONLY valid JSON (no markdown, no other text):
{
  "description": "2-3 sentence engaging description of the book suitable for a children's library — what it is about, what makes it special, written to excite a child",
  "tags": ["up to 8 short discovery tags like dragons, friendship, funny, adventure"],
  "book_type": "one of: Picture Book, Early Reader, Chapter Book, Illustrated Book, Graphic Novel, Novel, Flap Book — or null",
  "reading_levels": ["subset of: 3-5, 5-7, 8-10 — pick all that apply"],
  "categories": ["subset of the available library categories listed above — only include exact matches"],
  "series_name": "main series name or null",
  "sub_series_name": "sub-series name or null",
  "book_number": 1,
  "age_min": 7,
  "age_max": 10
}`,
      }],
    })
    const raw = ((msg.content[0] as any).text as string).trim()
    const text = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '')
    return { result: JSON.parse(text) }
  } catch (e: any) {
    return { result: null, error: e?.message || String(e) }
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    query?: string; isIsbn?: boolean; volumeId?: string; bookData?: any; categoryNames?: string[]
  }
  const { query, isIsbn, volumeId, bookData, categoryNames } = body
  const apiKey = process.env.ANTHROPIC_API_KEY || null

  // User picked a result — bookData already parsed from the list
  if (volumeId && bookData) {
    const book = { ...bookData, description: '', categoryNames: categoryNames || [] }
    book.description = await fetchDescription(volumeId)
    const coverBase64 = book.coverId ? await fetchCoverBase64(book.coverId) : null
    const { result: enrichment, error: claudeError } = apiKey ? await enrichWithClaude(book, apiKey) : { result: null, error: undefined }
    return NextResponse.json({ book: { ...book, coverBase64 }, enrichment, claudeError })
  }

  if (!query) return NextResponse.json({ error: 'query required' }, { status: 400 })

  const params = isIsbn
    ? `isbn=${encodeURIComponent(query)}`
    : `title=${encodeURIComponent(query)}&limit=6`
  const fields = 'key,title,author_name,isbn,number_of_pages_median,subject,cover_i'
  const res = await fetch(`${OL_SEARCH}?${params}&fields=${fields}`, { signal: AbortSignal.timeout(10000) })
  const data = await res.json()
  const docs: any[] = data.docs || []

  if (docs.length === 0) return NextResponse.json({ results: [] })

  // ISBN or single result → enrich immediately
  if (isIsbn || docs.length === 1) {
    const book = { ...parseDoc(docs[0]), categoryNames: categoryNames || [] }
    book.description = await fetchDescription(book.volumeId)
    const coverBase64 = book.coverId ? await fetchCoverBase64(book.coverId) : null
    const { result: enrichment, error: claudeError } = apiKey ? await enrichWithClaude(book, apiKey) : { result: null, error: undefined }
    return NextResponse.json({ book: { ...book, coverBase64 }, enrichment, claudeError })
  }

  // Multiple results → return list for user to pick
  return NextResponse.json({ results: docs.map(parseDoc) })
}
