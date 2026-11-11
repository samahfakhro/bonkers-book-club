import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { cleanTitle } from '@/lib/book-titles'
import { BOOK_FORMATS, BOOK_FORMAT_RULES } from '@/lib/book-formats'

const OL_SEARCH = 'https://openlibrary.org/search.json'
const OL_COVERS = 'https://covers.openlibrary.org/b/id'

// What each lookup costs: every AI call adds its usage to book.aiCost (US$, list prices per million tokens).
const PRICES: Record<string, [number, number]> = { 'claude-opus-5-5': [4, 20], 'claude-sonnet-5-5': [2, 10], 'claude-haiku-5-5': [0.1, 0.5] }
function addCost(book: any, model: string, usage: any) {
  if (!book || !usage) return
  const [inP, outP] = PRICES[model] || [4, 20]
  const input = (usage.input_tokens || 0) + (usage.cache_creation_input_tokens || 0) * 1.25 + (usage.cache_read_input_tokens || 0) * 0.1
  const searches = usage.server_tool_use?.web_search_requests || 0
  book.aiCost = (book.aiCost || 0) + (input * inP + (usage.output_tokens || 0) * outP) / 1e6 + searches * 0.01
}

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
async function coverIsEnglish(dataUrl: string, apiKey: string | null, book?: any): Promise<boolean> {
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
    addCost(book, 'claude-haiku-5-5', msg.usage)
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
  return await coverIsEnglish(cover, apiKey, book) ? { coverBase64: cover, coverNotEnglish: false } : { coverBase64: null, coverNotEnglish: true }
}

// ── Penguin Random House: free publisher blurb (and series number) by ISBN, no AI ──
// Their sites can be read directly (Scholastic and HarperCollins block it). Only tried for Penguin imprints, or when
// the publisher is unknown; anything unexpected → null and the normal lookup carries on.
const PENGUIN_IMPRINTS = /penguin|puffin|ladybird|transworld|\btbs\b|random house|corgi|doubleday|bantam|vintage|viking|\bdial\b|putnam|grosset|price stern|knopf|delacorte|frederick warne|dorling|\bdk\b|red fox|jonathan cape|hamish hamilton|rhcb/i
const BROWSER_UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36' }
const decodeHtml = (t: string) => t
  .replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<[^>]+>/g, ' ')
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
  .replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').replace(/\n{2,}/g, '\n').trim()
const getPage = (url: string) => fetch(url, { headers: BROWSER_UA, signal: AbortSignal.timeout(7000) }).then(async r => r.ok ? { url: r.url, html: await r.text() } : null).catch(() => null)

async function penguinBlurb(isbn: string): Promise<{ text: string; label: string; url: string; series: string | null; number: number | null } | null> {
  const clean = (isbn || '').replace(/[^0-9X]/gi, '')
  if (clean.length !== 13) return null
  // penguin.co.uk: the search page links to the book page, which has the full synopsis and the series number
  const search = await getPage(`https://www.penguin.co.uk/search-results?q=${clean}`)
  const path = search?.html.match(new RegExp(`/books/\\d+/[^"'\\s]*/${clean}`))?.[0]
  if (path) {
    const page = await getPage('https://www.penguin.co.uk' + path)
    const synopsis = page?.html.match(/<meta name="synopsis" content="([^"]*)"/)?.[1]
    if (page && synopsis && synopsis.length > 60) {
      const series = page.html.match(/<meta name="seriesName" content="([^"]*)"/)?.[1] || null
      // the page also lists other books in the series, so only the number in THIS book's own record (next to its slug)
      const slug = path.split('/')[3] || ''
      const n = slug ? Number(page.html.match(new RegExp(`"seriesNumber":(\\d{1,3})\\},"slug":"${slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`))?.[1]) : NaN
      return { text: decodeHtml(synopsis), label: 'penguin.co.uk', url: page.url, series: series ? decodeHtml(series) : null, number: series && Number.isInteger(n) && n > 0 ? n : null }
    }
  }
  // penguinrandomhouse.com: searching an ISBN goes straight to the book page
  const us = await getPage(`https://www.penguinrandomhouse.com/search/site?q=${clean}`)
  if (us && us.url.includes(clean)) {
    const raw = us.html.match(/"aboutTheBook":("(?:[^"\\]|\\.)*")/)?.[1]
    let about = ''
    try { about = raw ? JSON.parse(raw) : '' } catch { about = '' }
    if (about.length > 60) return { text: decodeHtml(about), label: 'penguinrandomhouse.com', url: us.url, series: null, number: null }
  }
  return null
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

// Web lookups only find facts and their sources, with the cheaper, faster Sonnet model and at most 2 searches
// (every page read is paid for). The descriptions are written by Opus (WRITE_MODEL, enrichWithClaude): it costs a few
// cents more per book than Sonnet but gets the details right more often.
const WEB_MODEL = 'claude-sonnet-5-5'
const WRITE_MODEL = 'claude-opus-5-5'
async function webSearchJson(prompt: string, apiKey: string, book?: any): Promise<any | null> {
  try {
    const client = new Anthropic({ apiKey })
    const messages: any[] = [{ role: 'user', content: prompt }]
    let msg: any
    for (let i = 0; i < 3; i++) {
      msg = await client.messages.create({
        model: WEB_MODEL, max_tokens: 4000, output_config: { effort: 'low' },
        tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 2 }],
        messages,
      } as any)
      addCost(book, WEB_MODEL, msg.usage)
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


// No blurb from Google, Open Library or Penguin: ONE web lookup finds what the book is about, in its own words, with
// the page used. (Series numbers are NOT searched for on the web: too costly and unreliable; the team types them in.)
async function blurbFromWeb(book: any, apiKey: string): Promise<{ facts: string; source: string; url: string } | null> {
  const r = await webSearchJson(`Find out what this children's book is about.

Book: "${book.title}" by ${book.author}${book.isbn ? ` (ISBN ${book.isbn})` : ''}${book.publisher ? `, published by ${book.publisher}` : ''}

Search for the publisher's description (blurb) of THIS book: the publisher's site, the author's official site, or a library catalogue. Make sure the page is about this exact book (same title and author), not another book in the series. Summarise it in your own words, 3–4 sentences: the main characters, what happens at the start, the kind of book it is. Do not copy sentences from the page, do not add anything it doesn't say, no spoilers.

Reply with ONLY JSON, no other text:
{"summary": "... or null", "summary_source_url": "the page you used, or null"}`, apiKey, book)
  if (!r?.summary || String(r.summary).length < 40 || !isUrl(r.summary_source_url)) return null
  return { facts: String(r.summary), source: host(r.summary_source_url), url: r.summary_source_url }
}

// The book's number in its series, from real sources in this order: the title, Open Library's record for this barcode,
// Google's series details, Penguin's page. Free sources only, no web search. Nothing found → null (the team fills it in).
function findSeriesNumber(book: any, aiSeries: string | null, aiSub: string | null): SeriesFound | null {
  const fromTitle = numberFromTitle(book.fullTitle || book.title, aiSub || aiSeries)
  if (fromTitle) return { series: aiSeries, sub_series: aiSub, number: fromTitle, source: 'the title', url: null }
  for (const line of (book.olSeries || []) as string[]) {
    const p = parseSeriesLine(line)
    if (p) return { series: aiSeries || p.name, sub_series: aiSub, number: p.number, source: 'Open Library', url: book.isbn ? `https://openlibrary.org/isbn/${book.isbn}` : null }
  }
  if (book.googleSeriesNumber && (aiSeries || aiSub)) return { series: aiSeries, sub_series: aiSub, number: book.googleSeriesNumber, source: 'Google Books', url: null }
  if (book.penguin?.number) return { series: aiSeries || book.penguin.series, sub_series: aiSub, number: book.penguin.number, source: book.penguin.label, url: book.penguin.url }
  return null
}

async function enrichWithClaude(book: ReturnType<typeof parseDoc> & { categoryNames?: string[]; googleAuthors?: string[]; byStatement?: string }, apiKey: string): Promise<{ result: any; error?: string }> {
  try {
    const client = new Anthropic({ apiKey })
    // Claude Opus 5.5 at low effort: richer, more accurate descriptions; thinking is always on, so leave room in max_tokens.
    // If a safety check ever declines the request, "fallbacks: default" lets the API retry it on a suitable model.
    const msg: any = await (client.beta.messages.create as any)({
      model: WRITE_MODEL,
      max_tokens: 8000,
      output_config: { effort: 'low' },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      messages: [{
        role: 'user',
        content: `You are cataloguing children's books for a library called The Curious Library.

Book: "${book.title}" by ${book.author}
${book.description ? `Publisher's blurb: ${book.description.slice(0, 1200)}` : "Publisher's blurb: none found."}
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

Format rules for book_type (pick by what the book IS, not by how many pictures it has):
${BOOK_FORMAT_RULES}

Return ONLY valid JSON (no markdown, no other text):
{
  "description": "what the book is about and what makes it fun. FACTS: use ONLY facts from the publisher's blurb above. Make it fun through your wording, but never add names, events or details that are not in the blurb, even ones you think you know. If there is no blurb, write one short, safe sentence about the kind of book it is and set description_needs_check to true. NO SPOILERS: never say how it ends, a twist, who is rescued or who wins, even if the blurb does ('a happy ending' is fine). VOICE follows the FORMAT you choose (who reads the description): Board Book or Picture Book, written for the PARENT choosing and reading aloud, 2 short warm sentences on what happens and why little ones love it; Early Reader or Chapter Book, written for a CHILD just reading alone, 2 short sentences with simple everyday words, exciting, speaking to them; Graphic Novel, Novel or Non-fiction, written for a CONFIDENT young reader, 2–3 sentences with richer words and a hook or question, a little cheeky humour (but if the youngest age is 5 or 6, keep it short and simple). British spelling.",
  "description_needs_check": false,
  "tags": ["up to 8 short, lowercase discovery tags for what is IN the story — ONLY things the publisher's blurb mentions, or that you are certain are in this exact book — that a child might search for (e.g. dragons, space, bedtime, siblings, pirates, football). NEVER repeat information the library already has: no category names (Adventure, Magic, Friendship, Funny, Science, Facts, Mystery, Animals, Spooky), no words from the title, series or author, no ages, no formats (picture book, graphic novel…), no shop words (bestseller, classic edition)"],
  "book_type": "the FORMAT, exactly one of: ${BOOK_FORMATS.join(', ')} (see the format rules above), or null",
  "reading_levels": ["subset of: 3-5, 5-7, 8-10 — pick all that apply"],
  "categories": ["subset of the available library categories listed above, chosen from what the publisher's blurb says (or what you are certain of about this exact book), never a guess from the title or cover — only include exact matches; always include Facts for a non-fiction book"],
  "non_fiction": false,
  "series_name": "main series name or null",
  "sub_series_name": "sub-series name or null",
  "age_min": 7,
  "age_max": 10,
  "illustrator": "the illustrator's name if the credits above name one; if not, the illustrator of this book when it is a well-known, certain pairing (e.g. David Walliams → Tony Ross, Roald Dahl → Quentin Blake, Julia Donaldson picture books → Axel Scheffler or whoever illustrated this title). Null if you are not certain"
}`,
      }],
    } as any)
    addCost(book, WRITE_MODEL, msg.usage)
    if (msg.stop_reason === 'refusal') return { result: null, error: 'The AI declined this book — fill the details in by hand' }
    const raw = ((msg.content.find((b: any) => b.type === 'text')?.text || '') as string).trim()
    const text = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '')
    const result = JSON.parse(text)
    result.book_number = null   // filled in from real sources by findSeriesNumber, never the AI's guess
    // tags only add what the library doesn't already know: drop category names, words from the title / series /
    // author, ages and formats, even if the AI added them anyway
    {
      const norm = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
      const sing = (w: string) => w.replace(/ies$/, 'y').replace(/(s|es)$/, '')
      const known = [book.title, book.author, result.series_name, result.sub_series_name].filter(Boolean).map(norm)
      const knownWords = new Set(known.flatMap(k => k.split(' ')).filter(Boolean).map(sing))
      const cats = new Set(['adventure', 'magic', 'friendship', 'funny', 'science', 'fact', 'mystery', 'animal', 'spooky', ...(book.categoryNames || []).map((c: string) => sing(norm(c)))])
      const formats = /^(picture books?|board books?|graphic novels?|chapter books?|early readers?|novels?|non ?fiction|illustrated|comics? style|bestseller|classic edition)$/
      const ages = /^(ages? ?\d|\d+ ?\d* ?year olds?|toddlers?|preschool|kids?|children)$/
      result.tags = [...new Set(((result.tags || []) as string[]).map(norm).filter(Boolean))].filter(t => {
        const words = t.split(' ').map(sing)
        return !cats.has(sing(t)) && !formats.test(t) && !ages.test(t) && !known.some(k => k.includes(t)) && !words.every(w => knownWords.has(w))
      })
    }
    // only one of the 7 formats (an old name like "Illustrated Book" is mapped, anything else left for the team)
    const oldFormat: Record<string, string> = { 'Illustrated Book': 'Non-fiction', 'Flap Book': 'Board Book' }
    result.book_type = oldFormat[result.book_type] ?? ((BOOK_FORMATS as readonly string[]).includes(result.book_type) ? result.book_type : null)
    return { result }
  } catch (e: any) {
    return { result: null, error: e?.message || String(e) }
  }
}

// The description check (Sonnet, about 1 cent): compares the written description with the publisher's blurb.
// Returns plain-English problems for the team, or [] when it's fine. Never changes the description itself.
const CHECK_MODEL = 'claude-sonnet-5-5'
async function checkDescription(book: any, enrichment: any, apiKey: string): Promise<string[]> {
  try {
    const client = new Anthropic({ apiKey })
    const blurb = book.publisherBlurb || (book.descriptionSource ? book.description : '')
    const youngest = Number(enrichment.age_min) || null
    const msg: any = await client.messages.create({
      model: CHECK_MODEL, max_tokens: 3000,
      messages: [{ role: 'user', content: `You are checking a children's library's book description before it is saved.

Book: "${book.title}" by ${book.author}. Ages ${enrichment.age_min ?? '?'}–${enrichment.age_max ?? '?'}.
Our description: "${enrichment.description}"
${blurb ? `Publisher's blurb: "${String(blurb).slice(0, 1500)}"` : 'NO publisher blurb was found.'}

Format: ${enrichment.book_type || 'unknown'}. Voice rule (follows the format): Board Book / Picture Book, written for the parent choosing and reading aloud; Early Reader / Chapter Book, written for a child just reading alone, short sentences and simple words; Graphic Novel / Novel / Non-fiction, written for a confident young reader with richer words and a hook (but short and simple if the youngest age is 5 or 6).

Flag only REAL problems:
1. ${blurb ? 'Specific names, events or details that contradict the blurb, or are not in it and you are not certain are true of this exact book.' : 'Anything you KNOW is wrong about this exact book (with no blurb, do not flag details just because you cannot confirm them).'}
2. Spoilers: a specific ending, twist or reveal ("a happy ending" is fine).
3. Clearly the wrong voice for this format (youngest age ${youngest ?? '?'}); one extra sentence or one richer word is fine.

Reply with ONLY JSON: {"problems": ["short plain-English problem", ...]} (an empty list when it is fine)` }],
    })
    addCost(book, CHECK_MODEL, msg.usage)
    const raw = (msg.content.find((c: any) => c.type === 'text')?.text || '') as string
    const json = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1))
    return Array.isArray(json.problems) ? json.problems.map(String).slice(0, 5) : []
  } catch { return [] }   // the check is a helper: if it fails, the lookup still works
}

// Everything after the book is identified: edition details, a web lookup if there's no blurb, then the AI's details
// and the cover check side by side, then the series number.
async function enrichBook(book: any, editionIsbn: string, workKey: string, apiKey: string | null, editionEarly?: ReturnType<typeof editionDetails>) {
  // the description comes only from the publisher's blurb (Google Books, then Penguin, then a web lookup) — never
  // Open Library, whose descriptions can belong to another edition or book
  const edition = await (editionEarly || editionDetails(editionIsbn))
  book.description = ''
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
  // a Penguin book: the publisher's own blurb, free, before any paid web search
  if (!book.publisherBlurb && (!book.publisher || PENGUIN_IMPRINTS.test(book.publisher))) {
    const p = await penguinBlurb(book.isbn || editionIsbn)
    if (p) {
      book.penguin = p
      book.publisherBlurb = p.text
      book.description = p.text
      book.descriptionSource = { label: p.label, url: p.url }
    }
  }
  if (!book.publisherBlurb && apiKey) {
    const web = await blurbFromWeb(book, apiKey)
    if (web?.facts) { book.description = web.facts; book.descriptionSource = { label: web.source, url: web.url } }
  }
  const [{ coverBase64, coverNotEnglish }, { result: enrichment, error: claudeError }] = await Promise.all([
    coverP,
    apiKey ? enrichWithClaude(book, apiKey) : Promise.resolve({ result: null, error: undefined } as { result: any; error?: string }),
  ])
  book.coverMayBeOtherEdition = false
  if (enrichment) {
    const found = findSeriesNumber(book, enrichment.series_name || null, enrichment.sub_series_name || null)
    if (found) {
      enrichment.book_number = found.number
      enrichment.book_number_source = { label: found.source, url: found.url }
      if (found.series && !enrichment.series_name) enrichment.series_name = found.series
      if (found.sub_series && found.source !== 'the title') enrichment.sub_series_name = found.sub_series
    }
    // a second pair of eyes on the description: invented details, spoilers, wrong reading level (shown in admin)
    if (apiKey && enrichment.description) enrichment.description_issues = await checkDescription(book, enrichment, apiKey)
  }
  delete book.penguin
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
