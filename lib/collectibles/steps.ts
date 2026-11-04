// Server-only. Collectibles in 3 steps:
//   1. research — look the book up properly and write a Book Fact Sheet (what actually happens in it)
//   2. ideas    — 3 short collectible concepts from the fact sheet, for the curator to choose from
//   3. draw     — (in the generate-collectible route) the chosen concept becomes the image
import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'
import { BONKERS_BIBLE } from '@/lib/bonkers-bible'

export const CREATIVE_MODEL = process.env.OPENAI_CREATIVE_MODEL || 'gpt-5.5'          // ideas: where the cleverness matters
export const RESEARCH_MODEL = process.env.OPENAI_RESEARCH_MODEL || 'gpt-5.4-mini'   // research: fast and cheap, finding facts

export const supabaseAdmin = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
export function openai() {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not set')
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

export type Idea = { collectible_name: string; concept: string; lore: string; source_moment: string }

// everything we know about the book, as text for the model
export async function bookDetails(bookId: string) {
  const sb = supabaseAdmin()
  const { data: b } = await sb.from('books')
    .select('id, title, author, illustrator, publisher, publication_date, isbn, description, cover_image_url, book_type, is_non_fiction, age_min, age_max, page_count, search_tags, series_id, series_number, collectible_fact_sheet, collectible_notes, collectible_options, collectible_research, collectible_version')
    .eq('id', bookId).single()
  if (!b) return null
  const { data: cats } = await sb.from('book_categories').select('categories(name)').eq('book_id', bookId)
  let series: string | null = null
  if (b.series_id) {
    const { data: s } = await sb.from('series').select('name, parent_series_id, series_number').eq('id', b.series_id).single()
    series = s?.name || null
  }
  const lines = [
    `Title: ${b.title}`,
    `Author: ${b.author}`,
    b.illustrator && `Illustrator: ${b.illustrator}`,
    b.publisher && `Publisher: ${b.publisher}`,
    b.publication_date && `Published: ${b.publication_date}`,
    b.isbn && `ISBN: ${b.isbn} (use this to make sure you have exactly this book / volume)`,
    series && `Series: ${series}${b.series_number ? `, book ${b.series_number}` : ''}`,
    `Format: ${b.book_type || 'not set'}${b.is_non_fiction ? ' (non-fiction)' : ''}`,
    (b.age_min || b.age_max) && `Ages: ${b.age_min ?? '?'}–${b.age_max ?? '?'}`,
    b.page_count && `Pages: ${b.page_count}`,
    (cats || []).length && `Curious Library categories: ${(cats || []).map((c: any) => c.categories?.name).filter(Boolean).join(', ')}`,
    b.search_tags?.length && `Tags: ${b.search_tags.join(', ')}`,
    b.description && `Our short blurb (written for children — not a full summary): ${b.description}`,
  ].filter(Boolean).join('\n')
  return { book: b, details: lines }
}

const parseJson = (text: string) => {
  const fenced = text.match(/```json\s*([\s\S]*?)\s*```/)
  try { return JSON.parse(fenced ? fenced[1] : text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)) } catch { return null }
}

function outputText(response: any): { text: string; urls: string[] } {
  let text = ''
  const urls: string[] = []
  for (const item of response.output || []) {
    if (item.type !== 'message') continue
    for (const part of item.content || []) {
      if (part.type !== 'output_text') continue
      text += part.text
      for (const a of part.annotations || []) if (a.type === 'url_citation' && a.url && !urls.includes(a.url)) urls.push(a.url)
    }
  }
  return { text: text || response.output_text || '', urls }
}

const RESEARCH_INSTRUCTIONS = `You research children's books for The Curious Library, so that our collectible designers know what really happens in a book.

You MUST use web search before answering: publisher pages, author pages, reputable reviews, library catalogues, reading guides, detailed summaries. Use the ISBN, illustrator and series number to be sure you are describing EXACTLY this book (for a series, only this volume). Any photos supplied are of the actual book (back-cover blurb or pages): read them carefully, they are the most reliable source. The curator's notes come from someone holding the book: trust them.

Never invent details. If you can't verify something, leave it out. Be concrete: real events, objects, jokes, places and creatures — not themes.

Reply with ONLY this JSON (in a \`\`\`json block):
{
  "summary": "3–5 plain sentences: what happens in this specific book",
  "key_moments": ["concrete scenes or events, in story order"],
  "memorable_objects": ["specific objects, machines, foods, gadgets that appear"],
  "running_jokes": ["recurring jokes, catchphrases, absurd situations"],
  "settings": ["places where it happens"],
  "characters": ["main characters, with a few words each"],
  "what_kids_love": "the bit children remember and talk about most",
  "confidence": "high | medium | low — how sure you are that this is accurate for THIS book",
  "sources": ["urls you used"]
}`

const list = (title: string, items?: string[]) => items?.length ? `${title}:\n${items.map(i => `- ${i}`).join('\n')}` : ''

// Step 1: research → a plain-text fact sheet the curator can read and edit
export async function researchBook(bookId: string, notes: string, photos: string[]) {
  const found = await bookDetails(bookId)
  if (!found) throw new Error('Book not found')
  const { book, details } = found
  const content: any[] = [
    ...(book.cover_image_url ? [{ type: 'input_image', image_url: book.cover_image_url }] : []),
    ...photos.slice(0, 3).map(p => ({ type: 'input_image', image_url: p })),
    { type: 'input_text', text: `Research this book:\n\n${details}${notes.trim() ? `\n\nCurator's notes (from someone holding the book):\n${notes.trim()}` : ''}${photos.length ? `\n\n${photos.length} photo(s) of the actual book are attached after the cover.` : ''}` },
  ]
  const response = await (openai().responses as any).create({
    model: RESEARCH_MODEL,
    reasoning: { effort: 'low' },
    instructions: RESEARCH_INSTRUCTIONS,
    tools: [{ type: 'web_search_preview' }],
    input: [{ role: 'user', content }],
  })
  const { text, urls } = outputText(response)
  const j = parseJson(text)
  if (!j?.summary) throw new Error('The research came back empty — add notes or a photo of the back cover and try again.')
  const sources = [...new Set([...urls, ...(j.sources || [])])].filter((u: string) => /^https?:\/\//.test(u))
  const sheet = [
    `SUMMARY:\n${j.summary}`,
    list('KEY MOMENTS', j.key_moments),
    list('MEMORABLE OBJECTS', j.memorable_objects),
    list('RUNNING JOKES', j.running_jokes),
    list('SETTINGS', j.settings),
    list('CHARACTERS', j.characters),
    j.what_kids_love ? `WHAT KIDS LOVE:\n${j.what_kids_love}` : '',
    `CONFIDENCE: ${j.confidence || 'unknown'}`,
  ].filter(Boolean).join('\n\n')
  await supabaseAdmin().from('books').update({
    collectible_fact_sheet: sheet, collectible_notes: notes.trim() || null,
    collectible_research: sources.length ? JSON.stringify(sources) : null,
    collectible_status: 'fact_sheet', collectible_options: null,
  }).eq('id', bookId)
  return { fact_sheet: sheet, sources }
}

// Step 2: three ideas from the (possibly edited) fact sheet
export async function suggestIdeas(bookId: string, factSheet: string, notes: string, direction: string, more: boolean) {
  const found = await bookDetails(bookId)
  if (!found) throw new Error('Book not found')
  const { book, details } = found
  const sb = supabaseAdmin()
  const { data: existing } = await sb.from('books').select('collectible_name, collectible_concept')
    .eq('collectible_status', 'approved').not('collectible_name', 'is', null).limit(80)
  const earlier: Idea[] = more && Array.isArray(book.collectible_options) ? book.collectible_options : []
  const text = [
    `BOOK:\n${details}`,
    `BOOK FACT SHEET (researched and checked by the curator — base every idea on this):\n${factSheet}`,
    notes.trim() && `CURATOR'S NOTES:\n${notes.trim()}`,
    direction.trim() && `CURATOR'S DIRECTION FOR THESE IDEAS:\n${direction.trim()}`,
    (existing || []).length && `EXISTING COLLECTIBLES (don't repeat these object types or jokes):\n${(existing || []).map((c: any) => `• ${c.collectible_name}: ${(c.collectible_concept || '').slice(0, 80)}`).join('\n')}`,
    earlier.length && `IDEAS ALREADY SHOWN FOR THIS BOOK (give 3 NEW, substantially different ones):\n${earlier.map(i => `• ${i.collectible_name}: ${i.concept}`).join('\n')}`,
    `THIS STEP IS IDEAS ONLY — do not draw anything. Following the Curious Collectible Bible, give the 3 strongest, clearly DIFFERENT collectible ideas, each traceable to a concrete moment in the fact sheet. Never a copy of a character or the cover.
Reply with ONLY this JSON (in a \`\`\`json block):
{ "options": [ { "collectible_name": "...", "concept": "what it is and why it works, 2–3 sentences", "lore": "one deadpan line", "source_moment": "the concrete detail from the fact sheet it comes from" } ] }`,
  ].filter(Boolean).join('\n\n')
  const response = await (openai().responses as any).create({
    model: CREATIVE_MODEL,
    instructions: BONKERS_BIBLE,
    input: [{ role: 'user', content: [
      ...(book.cover_image_url ? [{ type: 'input_image', image_url: book.cover_image_url }] : []),
      { type: 'input_text', text },
    ] }],
  })
  const j = parseJson(outputText(response).text)
  const options: Idea[] = (j?.options || []).filter((o: any) => o?.collectible_name && o?.concept).slice(0, 3)
  if (!options.length) throw new Error('No ideas came back — try again.')
  await sb.from('books').update({
    collectible_fact_sheet: factSheet, collectible_notes: notes.trim() || null,
    collectible_options: options, collectible_status: 'options',
  }).eq('id', bookId)
  return { options }
}
