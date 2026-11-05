// Server-only. Simple collectibles: the AI looks at the book's cover and title, picks ONE simple, iconic thing
// (a star, a mad penguin, a nose-picking child) and describes its own Curious-world version of it.
// The generate-collectible route then draws it.
import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'

export const CREATIVE_MODEL = process.env.OPENAI_CREATIVE_MODEL || 'gpt-5.5'

export const supabaseAdmin = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
export function openai() {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not set')
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

export type Idea = { collectible_name: string; concept: string; lore: string; source_moment: string }

export async function bookForCollectible(bookId: string) {
  const { data } = await supabaseAdmin().from('books')
    .select('id, title, author, description, cover_image_url, collectible_version, collectible_name, collectible_concept, collectible_lore, collectible_source_moment')
    .eq('id', bookId).single()
  return data
}

const PICK_INSTRUCTIONS = `You choose collectibles for The Curious Library, a children's library. Each book gets ONE collectible: a single, simple, iconic thing taken from the book's cover or title, redrawn as an original object in the Curious Universe (a magical 3D storybook world).

Good examples:
- How to Catch a Star → a glowing little star
- 365 Penguins → a mad, flustered penguin
- The World's Worst Children → a spoilt child picking its nose, or a comically screaming baby

Rules:
- ONE simple subject a child instantly recognises from the cover or title. Keep it simple: no scenes, no clever concepts.
- Take the IDEA, never the exact character: never reproduce the illustrator's character design, a named copyrighted character or the cover artwork. A generic version is perfect (a penguin, a naughty child, a dragon), with its own personality.
- Give it a touch of humour or personality in pose and expression.
- If the curator gives a suggestion, use it as the subject.

Reply with ONLY this JSON:
{ "collectible_name": "short fun name, 2–4 words", "concept": "one or two sentences describing exactly what to draw: the subject, its pose, expression and a detail or two", "lore": "one short deadpan line", "source_moment": "what on the cover or in the title it comes from" }`

// pick the subject from the cover + title (or the curator's own suggestion)
export async function pickFromCover(bookId: string, suggestion: string): Promise<Idea> {
  const book = await bookForCollectible(bookId)
  if (!book) throw new Error('Book not found')
  const text = [
    `Title: ${book.title}`,
    `Author: ${book.author}`,
    book.description && `About the book: ${book.description}`,
    suggestion.trim() && `Curator's suggestion: ${suggestion.trim()}`,
    book.collectible_name && !suggestion.trim() && `The last idea was "${book.collectible_name}". Choose something different.`,
  ].filter(Boolean).join('\n')
  const response = await (openai().responses as any).create({
    model: CREATIVE_MODEL,
    reasoning: { effort: 'low' },
    instructions: PICK_INSTRUCTIONS,
    input: [{ role: 'user', content: [
      ...(book.cover_image_url ? [{ type: 'input_image', image_url: book.cover_image_url }] : []),
      { type: 'input_text', text },
    ] }],
  })
  const out: string = response.output_text || ''
  let idea: any = null
  try { idea = JSON.parse(out.slice(out.indexOf('{'), out.lastIndexOf('}') + 1)) } catch { /* handled below */ }
  if (!idea?.collectible_name || !idea?.concept) throw new Error('No idea came back. Try again.')
  return { collectible_name: idea.collectible_name, concept: idea.concept, lore: idea.lore || '', source_moment: idea.source_moment || '' }
}
