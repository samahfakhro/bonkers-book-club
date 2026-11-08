import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { cleanTitle } from '@/lib/book-titles'

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

// Publisher, publication date and illustrator for this exact edition (admin-only details).
// Google Books first (uses the server key GOOGLE_GEOCODING_KEY, which also has the Books API), then Open Library.
// Anything not found stays empty — never guessed.
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
function prettyDate(d: string | undefined | null): string {
  if (!d) return ''
  const m = d.match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/)
  if (!m) return d
  const [, y, mo, day] = m
  return [day ? String(Number(day)) : '', mo ? MONTHS[Number(mo) - 1] : '', y].filter(Boolean).join(' ')
}
const flipName = (n: string) => { const p = n.replace(/,?\s*ill(ustrator)?\.?$/i, '').split(',').map(x => x.trim()).filter(Boolean); return p.length === 2 ? `${p[1]} ${p[0]}` : p.join(' ') }

async function editionDetails(isbn: string): Promise<{ publisher: string; publicationDate: string; illustrator: string; googleAuthors: string[]; byStatement: string; publisherBlurb: string; googleCoverUrl: string; googleTitle: string; googlePageCount: number | null; googleCategories: string[]; olSeries: string[]; googleSeriesNumber: number | null }> {
  const out = { publisher: '', publicationDate: '', illustrator: '', googleAuthors: [] as string[], byStatement: '', publisherBlurb: '', googleCoverUrl: '', googleTitle: '', googlePageCount: null as number | null, googleCategories: [] as string[], olSeries: [] as string[], googleSeriesNumber: null as number | null }
  const clean = (isbn || '').replace(/[^0-9X]/gi, '')
  if (!clean) return out
  const key = process.env.GOOGLE_GEOCODING_KEY
  const [g, ol] = await Promise.all([
    key ? fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${clean}&key=${key}`, { signal: AbortSignal.timeout(6000) }).then(r => r.json()).catch(() => null) : null,
    fetch(`https://openlibrary.org/isbn/${clean}.json`, { signal: AbortSignal.timeout(6000) }).then(r => r.ok ? r.json() : null).catch(() => null),
  ])
  const v = g?.items?.[0]?.volumeInfo
  out.publisher = v?.publisher || ol?.publishers?.[0] || ''
  out.publicationDate = prettyDate(v?.publishedDate || ol?.publish_date)
  out.googleAuthors = ((v?.authors || []) as string[]).filter(a => !/fictitious character/i.test(a))
  // Google's title for this edition is usually the full one (e.g. "Dog Man 5: Lord of the Fleas"); Open Library often has just the series name
  out.googleTitle = v?.title ? [v.title, v.subtitle].filter(Boolean).join(': ').replace(/\s+(PB|HB)$/i, '') : ''
  out.googlePageCount = v?.pageCount || null
  out.googleCategories = v?.categories || []
  out.olSeries = Array.isArray(ol?.series) ? ol.series : []                       // e.g. ["Goosebumps ; 27"]
  const gNum = Number(v?.seriesInfo?.bookDisplayNumber)
  out.googleSeriesNumber = Number.isInteger(gNum) && gNum > 0 && gNum < 1000 ? gNum : null
  // Google's description is usually the publisher's back-cover blurb — the most reliable description we can get
  out.publisherBlurb = (v?.description || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  // the cover of THIS edition from Google, and only when Google lists the edition as English
  out.googleCoverUrl = v?.imageLinks && g?.items?.[0]?.id && (!v.language || v.language === 'en') ? `https://books.google.com/books/content?id=${g.items[0].id}&printsec=frontcover&img=1&zoom=3` : ''
  out.byStatement = ol?.by_statement || ''
  const ill = (ol?.contributions || []).find((c: string) => /\bill(ustrator)?\b/i.test(c))
  const byIll = out.byStatement.match(/illustrated by ([^;.]+)/i)?.[1]
  out.illustrator = ill ? flipName(ill) : byIll ? byIll.trim() : ''
  return out
}

// any image URL → data URL (null if missing or a tiny "image not available" placeholder)
async function fetchImageBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length < 15000) return null
    return `data:${res.headers.get('content-type') || 'image/jpeg'};base64,${buf.toString('base64')}`
  } catch { return null }
}

// Is the writing on this cover in English? Covers in another language must never be added.
// Anything other than a clear "yes" (another language, or the check failing) rejects the cover.
async function coverIsEnglish(dataUrl: string, apiKey: string | null): Promise<boolean> {
  if (!apiKey) return false
  const m = dataUrl.match(/^data:(image\/(?:jpeg|png|gif|webp));base64,(.+)$/)
  if (!m) return false
  try {
    const client = new Anthropic({ apiKey })
    const msg: any = await client.messages.create({
      model: 'claude-haiku-5-5',
      max_tokens: 1500,
      messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: m[1] as any, data: m[2] } },
        { type: 'text', text: 'This is a children\'s book cover. Is the title and other writing on it in English? Reply with exactly one word: ENGLISH, OTHER (another language, even partly), or NOTEXT (no writing at all).' },
      ] }],
    })
    const answer = ((msg.content.find((b: any) => b.type === 'text')?.text || '') as string).toUpperCase()
    return answer.includes('ENGLISH') || answer.includes('NOTEXT')
  } catch { return false }
}

// The cover of THIS edition only (Google, then Open Library by ISBN). Open Library's general cover is never used:
// it can belong to any edition in any language. No cover found → the team photographs their own copy.
async function findCover(book: any, apiKey: string | null): Promise<{ coverBase64: string | null; coverNotEnglish: boolean }> {
  const cover = (book.googleCoverUrl ? await fetchImageBase64(book.googleCoverUrl) : null)
    ?? (book.isbn ? await fetchImageBase64(`https://covers.openlibrary.org/b/isbn/${String(book.isbn).replace(/[^0-9X]/gi, '')}-L.jpg?default=false`) : null)
  if (!cover) return { coverBase64: null, coverNotEnglish: false }
  return await coverIsEnglish(cover, apiKey) ? { coverBase64: cover, coverNotEnglish: false } : { coverBase64: null, coverNotEnglish: true }
}

// The number of a book in its series, read from the title only (e.g. "(Dog Man #1)", "Dog Man 13: Big Jim Begins", "Book 3").
// Never guessed: if the title doesn't say, it stays empty for the team to fill in.
function numberFromTitle(title: string, seriesName?: string | null): number | null {
  const t = title || ''
  const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const patterns = [
    /#\s*(\d{1,3})\b/,
    /\b(?:book|volume|vol\.?|no\.?|number|part|episode)\s*(\d{1,3})\b/i,
    ...(seriesName ? [new RegExp('^' + esc(seriesName) + '\\s+(\\d{1,3})\\b', 'i')] : []),
  ]
  for (const p of patterns) { const m = t.match(p); if (m) return Number(m[1]) }
  return null
}

type SeriesFound = { series: string | null; sub_series: string | null; number: number; source: string; url: string | null }

// "Goosebumps ; 27", "Dog Man -- 5", "Goosebumps HorrorLand ; #4" → { name, number }
function parseSeriesLine(line: string): { name: string; number: number } | null {
  const m = (line || '').trim().match(/^(.*?)[\s,;:–—-]*(?:#|no\.?|vol\.?|volume|book|bk\.?|episode|part)?\s*#?\s*(\d{1,3})\s*\.?\s*$/i)
  if (!m || !m[1].trim()) return null
  return { name: m[1].replace(/[\s,;:–—-]+$/, '').trim(), number: Number(m[2]) }
}

// Web lookups only find facts and their sources, so they use the faster Sonnet model; the descriptions themselves
// are still written by Opus (enrichWithClaude).
const WEB_MODEL = 'claude-sonnet-5-5'
async function webSearchJson(prompt: string, apiKey: string): Promise<any | null> {
  try {
    const client = new Anthropic({ apiKey })
    const messages: any[] = [{ role: 'user', content: prompt }]
    let msg: any
    for (let i = 0; i < 3; i++) {
      msg = await client.messages.create({
        model: WEB_MODEL, max_tokens: 4000, output_config: { effort: 'low' },
        tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 3 }],
        messages,
      } as any)
      if (msg.stop_reason !== 'pause_turn') break
      messages.push({ role: 'assistant', content: msg.content })   // let the search finish
    }
    const text = ((msg.content || []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('') as string).trim()
    const json = text.match(/\{[\s\S]*\}/)?.[0]
    return json ? JSON.parse(json) : null
  } catch { return null }
}
const host = (url: string) => new URL(url).hostname.replace(/^www\./, '')
const isUrl = (u: any) => typeof u === 'string' && /^https?:\/\//.test(u)

// a sourced series number from the lookup's answer, or null (never worked out, counted or assumed)
function sourcedNumber(r: any): SeriesFound | null {
  const n = Number(r?.number)
  if (!Number.isInteger(n) || n < 1 || n > 999 || !isUrl(r?.number_source_url) || !r?.number_quote) return null
  return { series: r.series || null, sub_series: r.sub_series || null, number: n, source: host(r.number_source_url), url: r.number_source_url }
}

const NUMBER_RULES = `Series number: use only a reliable source that explicitly states it (the publisher, the author's official site, Wikipedia, or a library catalogue). If the series has sub-series (e.g. Goosebumps → Goosebumps HorrorLand), give the sub-series the number belongs to. Never work the number out yourself, count, or assume: if no source states it, use null.`

// Only the series number is missing (the book has a blurb): look it up, with its source.
async function seriesFromWeb(book: any, seriesHint: string | null, apiKey: string): Promise<SeriesFound | null> {
  const r = await webSearchJson(`Find which series this children's book belongs to and its number in that series.

Book: "${book.title}" by ${book.author}${book.isbn ? ` (ISBN ${book.isbn})` : ''}${seriesHint ? `\nPossibly part of: ${seriesHint}` : ''}

Search the web. ${NUMBER_RULES}

Reply with ONLY JSON, no other text:
{"series": "main series name", "sub_series": "sub-series name or null", "number": 5, "number_source_url": "the page that states it", "number_quote": "the exact words on that page that give the number"}
or
null`, apiKey)
  return sourcedNumber(r)
}

// No blurb from Google or Open Library: ONE web lookup finds what the book is about (in its own words, with the page
// used) and, if it's part of a series, its number (with the page that states it).
async function blurbAndSeriesFromWeb(book: any, apiKey: string): Promise<{ facts: string; source: string; url: string; series: SeriesFound | null } | null> {
  const r = await webSearchJson(`Find out about this children's book.

Book: "${book.title}" by ${book.author}${book.isbn ? ` (ISBN ${book.isbn})` : ''}${book.publisher ? `, published by ${book.publisher}` : ''}

1. Description: search for the publisher's description (blurb) of THIS book: the publisher's site, the author's official site, or a library catalogue. Make sure the page is about this exact book (same title and author), not another book in the series. Summarise it in your own words, 3–4 sentences: the main characters, what happens at the start, the kind of book it is. Do not copy sentences from the page, do not add anything it doesn't say, no spoilers.
2. If the book is part of a series: the series name and the book's number in it. ${NUMBER_RULES}

Reply with ONLY JSON, no other text:
{"summary": "... or null", "summary_source_url": "the page you used, or null", "series": "main series name or null", "sub_series": "sub-series name or null", "number": 5, "number_source_url": "the page that states the number, or null", "number_quote": "the exact words on that page that give the number, or null"}`, apiKey)
  if (!r) return null
  const series = sourcedNumber(r)
  if (!r.summary || String(r.summary).length < 40 || !isUrl(r.summary_source_url)) return series ? { facts: '', source: '', url: '', series } : null
  return { facts: String(r.summary), source: host(r.summary_source_url), url: r.summary_source_url, series }
}

// The book's number in its series, from real sources in this order: the title, Open Library's record for this barcode,
// Google's series details, then a sourced web lookup. Nothing found → null (the team fills it in).
async function findSeriesNumber(book: any, aiSeries: string | null, aiSub: string | null, apiKey: string | null): Promise<SeriesFound | null> {
  const fromTitle = numberFromTitle(book.fullTitle || book.title, aiSub || aiSeries)
  if (fromTitle) return { series: aiSeries, sub_series: aiSub, number: fromTitle, source: 'the title', url: null }
  for (const line of (book.olSeries || []) as string[]) {
    const p = parseSeriesLine(line)
    if (p) return { series: aiSeries || p.name, sub_series: aiSub, number: p.number, source: 'Open Library', url: book.isbn ? `https://openlibrary.org/isbn/${book.isbn}` : null }
  }
  if (book.googleSeriesNumber && (aiSeries || aiSub)) return { series: aiSeries, sub_series: aiSub, number: book.googleSeriesNumber, source: 'Google Books', url: null }
  if (book.webLookupDone) return book.webSeries || null   // the description lookup already searched the web for it
  if (!apiKey || !(aiSeries || (book.olSeries || []).length)) return null   // not part of a series
  return seriesFromWeb(book, aiSub || aiSeries || (book.olSeries || [])[0] || null, apiKey)
}

async function enrichWithClaude(book: ReturnType<typeof parseDoc> & { categoryNames?: string[]; googleAuthors?: string[]; byStatement?: string }, apiKey: string): Promise<{ result: any; error?: string }> {
  try {
    const client = new Anthropic({ apiKey })
    // Claude Opus 5.5 at low effort: richer, more accurate descriptions; thinking is always on, so leave room in max_tokens.
    // If a safety check ever declines the request, "fallbacks: default" lets the API retry it on a suitable model.
    const msg: any = await (client.beta.messages.create as any)({
      model: 'claude-opus-5-5',
      max_tokens: 8000,
      output_config: { effort: 'low' },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      messages: [{
        role: 'user',
        content: `You are cataloguing children's books for a library called The Curious Library.

Book: "${book.title}" by ${book.author}
${book.description ? `Description (from the publisher or a library catalogue): ${book.description.slice(0, 1200)}` : 'Description: none found.'}
${book.subjects.length ? `Subjects: ${book.subjects.slice(0, 10).join(', ')}` : ''}
${book.pageCount ? `Pages: ${book.pageCount}` : ''}
${book.googleAuthors?.length ? `People credited on this edition: ${book.googleAuthors.join(', ')}` : ''}
${book.byStatement ? `Title page credit: ${book.byStatement}` : ''}
${book.categoryNames?.length ? `\nAvailable library categories (pick all that apply): ${book.categoryNames.join(', ')}` : ''}
${book.categoryNames?.length ? `How to use some of them (a book can have several):
- Animals: animals are at the heart of the book, as a story about animals or as animal facts. Not just because the characters happen to be animals (e.g. Dog Man is Funny/Adventure, not Animals).
- Science: how the world works, e.g. space, the human body, inventions, experiments, weather, the Earth, dinosaurs. NOT books about animals (those go in Animals), unless the book is really about a scientific idea (e.g. food chains, how animals breathe).
- Facts: any non-fiction book, whatever the topic.
Examples: a shark facts book = Animals + Facts. A planets book = Science + Facts. A story about a bear = Animals (plus any others that fit).` : ''}

Return ONLY valid JSON (no markdown, no other text):
{
  "description": "what the book is about and what makes it fun, in a voice that matches the age range you choose below. Ages up to 5: written for the PARENT choosing and reading aloud, 2 short warm sentences on what happens and why little ones love it (rhymes, flaps, bedtime, a cosy ending). Ages 5–7: written for the CHILD, 2 short sentences with simple everyday words, exciting, speaking to them. Ages 8 and up: written for the CHILD, 2–3 sentences with richer words and a hook or question that makes them want to read it, a little cheeky humour, characters named where certain. Base it on the description and subjects above; you may add a fun, specific detail (e.g. a character's name or a funny situation) ONLY if you are certain it is true of this exact book. Never invent characters, names, events or endings, and no spoilers. If there is too little information, write one short, safe sentence instead and set description_needs_check to true",
  "description_needs_check": false,
  "tags": ["up to 8 short discovery tags like dragons, friendship, funny, adventure"],
  "book_type": "one of: Picture Book, Board Book, Flap Book, Early Reader, Chapter Book, Illustrated Book, Graphic Novel, Novel — the FORMAT only, or null",
  "reading_levels": ["subset of: 3-5, 5-7, 8-10 — pick all that apply"],
  "categories": ["subset of the available library categories listed above — only include exact matches; always include Facts for a non-fiction book"],
  "non_fiction": false,
  "series_name": "main series name or null",
  "sub_series_name": "sub-series name or null",
  "age_min": 7,
  "age_max": 10,
  "illustrator": "the illustrator's name if the credits above name one; if not, the illustrator of this book when it is a well-known, certain pairing (e.g. David Walliams → Tony Ross, Roald Dahl → Quentin Blake, Julia Donaldson picture books → Axel Scheffler or whoever illustrated this title). Null if you are not certain"
}`,
      }],
    })
    if (msg.stop_reason === 'refusal') return { result: null, error: 'The AI declined this book — fill the details in by hand' }
    const raw = ((msg.content.find((b: any) => b.type === 'text')?.text || '') as string).trim()
    const text = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '')
    const result = JSON.parse(text)
    result.book_number = null   // filled in from real sources by findSeriesNumber, never the AI's guess
    return { result }
  } catch (e: any) {
    return { result: null, error: e?.message || String(e) }
  }
}

// Everything after the book is identified: edition details, a web lookup if there's no blurb, then the AI's details
// and the cover check side by side, then the series number.
async function enrichBook(book: any, editionIsbn: string, workKey: string, apiKey: string | null, editionEarly?: ReturnType<typeof editionDetails>) {
  const [desc, edition] = await Promise.all([workKey ? fetchDescription(workKey) : Promise.resolve(''), editionEarly || editionDetails(editionIsbn)])
  book.description = desc
  Object.assign(book, edition)
  if (!book.title && !book.googleTitle) return null
  if (!book.subjects.length && book.googleCategories?.length) book.subjects = book.googleCategories
  if (book.publisherBlurb) book.description = book.publisherBlurb
  if (book.googleTitle) { book.fullTitle = book.googleTitle; book.title = cleanTitle(book.googleTitle) || book.googleTitle }
  if (!book.author && book.googleAuthors?.length) book.author = book.googleAuthors.slice(0, 2).join(', ')
  if (!book.pageCount && book.googlePageCount) book.pageCount = book.googlePageCount

  // no publisher blurb from Google / Open Library → one web lookup for the description and series number
  // (the cover check runs at the same time, since it doesn't need either)
  const coverP = findCover(book, apiKey)
  if (!book.publisherBlurb && apiKey) {
    const web = await blurbAndSeriesFromWeb(book, apiKey)
    book.webLookupDone = true
    book.webSeries = web?.series || null
    if (web?.facts) { book.description = web.facts; book.descriptionSource = { label: web.source, url: web.url } }
  }
  const [{ coverBase64, coverNotEnglish }, { result: enrichment, error: claudeError }] = await Promise.all([
    coverP,
    apiKey ? enrichWithClaude(book, apiKey) : Promise.resolve({ result: null, error: undefined } as { result: any; error?: string }),
  ])
  book.coverMayBeOtherEdition = false
  if (enrichment) {
    const found = await findSeriesNumber(book, enrichment.series_name || null, enrichment.sub_series_name || null, apiKey)
    if (found) {
      enrichment.book_number = found.number
      enrichment.book_number_source = { label: found.source, url: found.url }
      if (found.series && !enrichment.series_name) enrichment.series_name = found.series
      if (found.sub_series && found.source !== 'the title') enrichment.sub_series_name = found.sub_series
    }
  }
  delete book.webSeries
  return { book: { ...book, coverBase64, coverNotEnglish }, enrichment, claudeError }
}

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    query?: string; isIsbn?: boolean; volumeId?: string; bookData?: any; categoryNames?: string[]
  }
  const { query, isIsbn, volumeId, bookData, categoryNames } = body
  const apiKey = process.env.ANTHROPIC_API_KEY || null

  // User picked a result — bookData already parsed from the list
  if (volumeId && bookData) {
    const out = await enrichBook({ ...bookData, description: '', categoryNames: categoryNames || [] }, bookData.isbn, volumeId, apiKey)
    return NextResponse.json(out || { results: [] })
  }

  if (!query) return NextResponse.json({ error: 'query required' }, { status: 400 })

  const params = isIsbn
    ? `isbn=${encodeURIComponent(query)}`
    : `title=${encodeURIComponent(query)}&limit=6`
  const fields = 'key,title,author_name,isbn,number_of_pages_median,subject,cover_i'
  const editionEarly = isIsbn ? editionDetails(query) : undefined   // a barcode: start the edition lookup alongside the search
  const res = await fetch(`${OL_SEARCH}?${params}&fields=${fields}`, { signal: AbortSignal.timeout(10000) })
  const data = await res.json()
  const docs: any[] = data.docs || []

  if (docs.length === 0 && isIsbn) docs.push({ key: '', title: '', author_name: [], isbn: [String(query).replace(/[^0-9X]/gi, '')], subject: [] })
  if (docs.length === 0) return NextResponse.json({ results: [] })

  // ISBN or single result → enrich immediately
  if (isIsbn || docs.length === 1) {
    const book: any = { ...parseDoc(docs[0]), categoryNames: categoryNames || [] }
    if (isIsbn) book.isbn = String(query).replace(/[^0-9X]/gi, '')
    const out = await enrichBook(book, isIsbn ? query : book.isbn, book.volumeId, apiKey, editionEarly)
    return NextResponse.json(out || { results: [] })
  }

  // Multiple results → return list for user to pick
  return NextResponse.json({ results: docs.map(parseDoc) })
}
