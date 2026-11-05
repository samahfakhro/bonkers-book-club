import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 300   // research with web search can take a couple of minutes
export const dynamic = 'force-dynamic'
import OpenAI, { toFile } from 'openai'
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { BONKERS_BIBLE } from '@/lib/bonkers-bible'
import { pickFromCover, bookForCollectible, type Idea } from '@/lib/collectibles/steps'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Model identifiers — change here only
const CREATIVE_MODEL = process.env.OPENAI_CREATIVE_MODEL || 'gpt-5.5'
const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1.5'   // gpt-image-2 can't make transparent backgrounds

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set')
  return new OpenAI({ apiKey })
}

// Load a reference asset from public/reference-assets/ as base64 data URL
function loadReferenceAsset(filename: string): string | null {
  try {
    const filePath = path.join(process.cwd(), 'public', 'reference-assets', filename)
    if (!fs.existsSync(filePath)) return null
    const buffer = fs.readFileSync(filePath)
    const ext = path.extname(filename).slice(1).toLowerCase()
    const mime = (ext === 'jpg' || ext === 'jpeg') ? 'image/jpeg' : 'image/png'
    return `data:${mime};base64,${buffer.toString('base64')}`
  } catch { return null }
}

// Ensure the collectibles storage bucket exists
async function ensureBucket() {
  const { error } = await getSupabaseAdmin().storage.createBucket('collectibles', { public: true })
  // Ignore error if bucket already exists
  if (error && !error.message.includes('already exists')) {
    console.warn('Could not create collectibles bucket:', error.message)
  }
}

// Upload a base64 PNG to Supabase and return the public URL
async function uploadCollectible(bookId: string, version: number, base64Data: string): Promise<string | null> {
  try {
    await ensureBucket()
    const buffer = Buffer.from(base64Data, 'base64')
    const storagePath = `${bookId}/v${version}.png`
    const sb = getSupabaseAdmin()
    const { error } = await sb.storage
      .from('collectibles')
      .upload(storagePath, buffer, { contentType: 'image/png', upsert: true })
    if (error) { console.error('Storage upload error:', error.message); return null }
    const { data } = sb.storage.from('collectibles').getPublicUrl(storagePath)
    return data.publicUrl
  } catch (e) { console.error('Upload error:', e); return null }
}

type CollectibleMetadata = {
  collectible_name?: string
  concept?: string
  lore?: string
  source_moment?: string
  research?: string[]
  status?: string
}

// Extract JSON metadata block from OpenAI text output
function parseMetadata(text: string): CollectibleMetadata | null {
  try {
    const match = text.match(/```json\s*([\s\S]*?)\s*```/)
    if (match) return JSON.parse(match[1])
    const objMatch = text.match(/\{\s*"(?:collectible_name|status)"[\s\S]*?\}/)
    if (objMatch) return JSON.parse(objMatch[0])
  } catch { /* ignore parse errors */ }
  return null
}

// Step 3: draw the idea the curator chose — straight to the image model with a short brief and the style pictures
// (medium quality by default; "Polish" redraws at high quality). The book cover is deliberately not sent, so nothing gets copied.
const DRAW_STYLE = `Create ONE collectible object for "Bonky's Universe", a children's library world. Match the style of the reference images: richly dimensional modern 3D storybook fantasy, tactile handcrafted materials (wood grain, creased cardboard, fluffy feathers, soft fabric, subtle wear and tiny imperfections), whimsical proportions, soft depth and shadows. Not flat, not cartoon clipart, not plastic CGI, not Pixar/Disney style, not photoreal, not anime.`
const DRAW_RULES = `Rules:
- One standalone object, with no decorative base.
- Magical, dimensional, beautifully textured 3D storybook aesthetic.
- Warm, balanced lighting that works across different planets.
- Transparent background with preserved alpha.
- No environmental scenery, unless the object itself is a building or location.
- Consistent framing: the whole object visible, with sensible transparent padding.
- No writing unless essential to the object.
- Never a recognisable copyrighted character.`

async function drawIdea(bookId: string, idea: Idea, direction: string, quality: 'medium' | 'high' = 'medium') {
  const sb = getSupabaseAdmin()
  const book = await bookForCollectible(bookId)
  if (!book) throw new Error('Book not found')
  const statusBefore = (await sb.from('books').select('collectible_status').eq('id', bookId).single()).data?.collectible_status
  await sb.from('books').update({ collectible_status: 'generating' }).eq('id', bookId)
  try {
    const prompt = [
      DRAW_STYLE,
      `THE OBJECT: ${idea.collectible_name} — ${idea.concept}`,
      direction.trim() && `Extra direction: ${direction.trim()}`,
      DRAW_RULES,
    ].filter(Boolean).join('\n\n')
    const references = await Promise.all(['bonkys-home.png', 'my-collection.png', 'penguin-parcel.png']
      .filter(f => fs.existsSync(path.join(process.cwd(), 'public', 'reference-assets', f)))
      .map(f => toFile(fs.readFileSync(path.join(process.cwd(), 'public', 'reference-assets', f)), f, { type: 'image/png' })))
    const result: any = await getOpenAIClient().images.edit({
      model: IMAGE_MODEL, image: references, prompt, quality, size: '1024x1024', background: 'transparent', output_format: 'png',
    } as any)
    const imageBase64 = result.data?.[0]?.b64_json
    if (!imageBase64) throw new Error('No image came back — try drawing it again.')
    const version = (book.collectible_version || 0) + 1
    const imageUrl = await uploadCollectible(bookId, version, imageBase64)
    const update = {
      collectible_status: 'awaiting_approval', collectible_version: version,
      collectible_openai_response_id: null, collectible_generated_at: new Date().toISOString(),
      collectible_name: idea.collectible_name, collectible_concept: idea.concept, collectible_lore: idea.lore || null,
      collectible_source_moment: idea.source_moment || null, collectible_image_url: imageUrl,
      ...(idea.kind ? { collectible_kind: idea.kind } : {}),   // egg (creature) or parcel (thing) when a child unlocks it
      collectible_prompt: prompt.slice(0, 2000),
    }
    await sb.from('books').update(update).eq('id', bookId)
    return {
      ok: true, collectible_name: idea.collectible_name, collectible_concept: idea.concept, collectible_lore: idea.lore,
      collectible_source_moment: idea.source_moment, collectible_image_url: imageUrl, collectible_version: version,
      collectible_openai_response_id: null,
    }
  } catch (e) {
    await sb.from('books').update({ collectible_status: statusBefore === 'generating' ? null : statusBefore }).eq('id', bookId)
    throw e
  }
}

export async function POST(req: NextRequest) {
  let bookId: string | undefined
  try {
    const body = await req.json()
    bookId = body.bookId
    const mode: 'new' | 'retry' | 'revise' = body.mode || 'new'
    const previousResponseId: string | undefined = body.previousResponseId
    const feedback: string | undefined = body.feedback
    const customPrompt: string | undefined = body.customPrompt

    if (!bookId) return NextResponse.json({ error: 'bookId required' }, { status: 400 })

    // ── Simple collectibles: one thing from the cover, redrawn ───────────
    const step: 'generate' | 'draw' | 'polish' | undefined = body.step
    if (step === 'generate') {
      // the AI picks one simple subject from the cover / title (or uses the curator's suggestion), then it's drawn
      const idea = await pickFromCover(bookId, String(body.suggestion || ''))
      return NextResponse.json(await drawIdea(bookId, idea, ''))
    }
    if (step === 'draw') {
      const idea: Idea | undefined = body.idea
      if (!idea?.collectible_name || !idea?.concept) return NextResponse.json({ error: 'Choose an idea first' }, { status: 400 })
      return NextResponse.json(await drawIdea(bookId, idea, String(body.direction || '')))
    }
    if (step === 'polish') {
      // redraw the current collectible at high quality
      const { data: cur } = await getSupabaseAdmin().from('books').select('collectible_name, collectible_concept, collectible_lore, collectible_source_moment').eq('id', bookId).single()
      if (!cur?.collectible_name || !cur?.collectible_concept) return NextResponse.json({ error: 'Nothing to polish yet' }, { status: 400 })
      return NextResponse.json(await drawIdea(bookId, { collectible_name: cur.collectible_name, concept: cur.collectible_concept, lore: cur.collectible_lore || '', source_moment: cur.collectible_source_moment || '' }, String(body.direction || ''), 'high'))
    }

    const supabaseAdmin = getSupabaseAdmin()

    // Mark as generating
    await supabaseAdmin.from('books').update({ collectible_status: 'generating' }).eq('id', bookId)

    // ── Fetch book data ──────────────────────────────────────────────────
    const { data: book, error: bookErr } = await supabaseAdmin
      .from('books')
      .select('id, title, author, description, cover_image_url, book_type, age_min, age_max, series_id, collectible_version')
      .eq('id', bookId)
      .single()

    if (bookErr || !book) {
      await supabaseAdmin.from('books').update({ collectible_status: 'generation_failed' }).eq('id', bookId)
      return NextResponse.json({ error: 'Book not found' }, { status: 404 })
    }

    // Fetch categories
    const { data: bookCats } = await supabaseAdmin
      .from('book_categories')
      .select('category_id, categories(name)')
      .eq('book_id', bookId)
    const categoryNames = (bookCats || []).map((bc: any) => bc.categories?.name).filter(Boolean)

    // Fetch series name
    let seriesName: string | null = null
    if ((book as any).series_id) {
      const { data: seriesData } = await supabaseAdmin.from('series').select('name').eq('id', (book as any).series_id).single()
      seriesName = seriesData?.name || null
    }

    // ── Fetch existing approved collectibles (compact list) ──────────────
    const { data: existingCollectibles } = await supabaseAdmin
      .from('books')
      .select('collectible_name, collectible_concept, book_type')
      .eq('collectible_status', 'approved')
      .not('collectible_name', 'is', null)
      .limit(60)

    const existingList = (existingCollectibles || [])
      .map((c: any) => `• ${c.collectible_name}: ${(c.collectible_concept || '').slice(0, 80)}`)
      .join('\n')

    // ── Build reference image content parts ────────────────────────────
    const REFERENCE_FILES = ['bonkys-home.png', 'my-collection.png', 'penguin-parcel.png']
    const referenceImageParts: any[] = []
    for (const file of REFERENCE_FILES) {
      const dataUrl = loadReferenceAsset(file)
      if (dataUrl) {
        referenceImageParts.push({
          type: 'input_image',
          image_url: dataUrl,
        })
      }
    }

    // ── Build the user message text ────────────────────────────────────
    const b = book as any
    let userText = `BOOK TO CREATE A COLLECTIBLE FOR:\n\n`
    userText += `Title: ${b.title}\n`
    userText += `Author: ${b.author}\n`
    userText += `Book Type: ${b.book_type || 'Not specified'}\n`
    userText += `Age Range: ${b.age_min ?? '?'}–${b.age_max ?? '?'}\n`
    if (seriesName) userText += `Series: ${seriesName}\n`
    if (categoryNames.length) userText += `Curious Library Categories: ${categoryNames.join(', ')}\n`
    if (b.description) userText += `\nDescription:\n${b.description}\n`
    if (b.cover_image_url) userText += `\nThe book cover image is included above for visual context.\n`

    if (existingList) {
      userText += `\nEXISTING COLLECTIBLES IN THE CURIOUS UNIVERSE (avoid repetition of object types and concepts):\n${existingList}\n`
    }

    if (mode === 'retry') {
      userText += `\nIMPORTANT: The previous concept was REJECTED. You must create a SUBSTANTIALLY DIFFERENT concept for the same book. Do not repeat themes, object types, or visual approaches from your previous attempt. Think differently about what makes this book special.\n`
    } else if (mode === 'revise' && feedback) {
      userText += `\nFEEDBACK ON PREVIOUS CONCEPT:\n"${feedback}"\n\nPlease incorporate this feedback in your revised concept and image. The creative direction above comes from The Curious Library team — follow it precisely.\n`
    }

    if (customPrompt && customPrompt.trim()) {
      userText += `\nADMIN DIRECTION:\n"${customPrompt.trim()}"\n`
    }

    userText += `\nNow apply the Curious Collectible Bible. Think carefully about the best concept, then output your JSON metadata block, then call the image_generation tool.`

    // ── Build the input messages ───────────────────────────────────────
    const contentParts: any[] = [
      // Cover image first (if available)
      ...(b.cover_image_url ? [{ type: 'input_image', image_url: b.cover_image_url }] : []),
      // Reference style assets
      ...referenceImageParts,
      // Text prompt
      { type: 'input_text', text: userText },
    ]

    const openai = getOpenAIClient()

    // ── Call OpenAI Responses API ──────────────────────────────────────
    const requestParams: any = {
      model: CREATIVE_MODEL,
      instructions: BONKERS_BIBLE,
      tools: [
        { type: 'web_search_preview' },
        {
          type: 'image_generation',
          model: IMAGE_MODEL,
          quality: 'high',
          size: '1024x1024',
          output_format: 'png',
          background: 'transparent',
        },
      ],
      input: [
        {
          role: 'user',
          content: contentParts,
        },
      ],
    }

    // For retry/revise: chain onto previous response for multi-turn context
    if ((mode === 'retry' || mode === 'revise') && previousResponseId) {
      requestParams.previous_response_id = previousResponseId
    }

    const response = await (openai.responses as any).create(requestParams)

    // ── Parse response ────────────────────────────────────────────────
    let textOutput = ''
    let imageBase64: string | null = null
    const citationUrls: string[] = []

    for (const item of (response.output || [])) {
      if (item.type === 'message') {
        for (const part of (item.content || [])) {
          if (part.type === 'output_text') {
            textOutput += part.text
            // Extract URL citations from web search annotations
            for (const ann of (part.annotations || [])) {
              if (ann.type === 'url_citation' && ann.url && !citationUrls.includes(ann.url)) {
                citationUrls.push(ann.url)
              }
            }
          }
        }
      } else if (item.type === 'image_generation_call') {
        imageBase64 = item.result || null
      }
    }

    // Fallback: response.output_text
    if (!textOutput && response.output_text) textOutput = response.output_text

    const metadata = parseMetadata(textOutput)
    const responseId: string = response.id

    // Merge citations: annotation URLs take priority, supplement with model-provided research
    const researchUrls: string[] = citationUrls.length > 0
      ? citationUrls
      : (metadata?.research || [])

    // ── Handle needs_book_context ─────────────────────────────────────
    if (metadata?.status === 'needs_book_context') {
      await supabaseAdmin.from('books').update({ collectible_status: 'needs_book_context' }).eq('id', bookId)
      return NextResponse.json({ error: 'Insufficient book information — add more metadata and try again.', status: 'needs_book_context' }, { status: 422 })
    }

    const newVersion = ((b.collectible_version || 0) as number) + 1

    // ── Upload image ──────────────────────────────────────────────────
    let imageUrl: string | null = null
    if (imageBase64) {
      imageUrl = await uploadCollectible(bookId, newVersion, imageBase64)
    }

    // ── Update book record ────────────────────────────────────────────
    const updatePayload: Record<string, any> = {
      collectible_status: 'awaiting_approval',
      collectible_version: newVersion,
      collectible_openai_response_id: responseId,
      collectible_generated_at: new Date().toISOString(),
      collectible_name: metadata?.collectible_name || null,
      collectible_concept: metadata?.concept || null,
      collectible_lore: metadata?.lore || null,
      collectible_source_moment: metadata?.source_moment || null,
      collectible_research: researchUrls.length > 0 ? JSON.stringify(researchUrls) : null,
      collectible_prompt: textOutput.slice(0, 2000),
    }
    if (imageUrl) updatePayload.collectible_image_url = imageUrl

    await supabaseAdmin.from('books').update(updatePayload).eq('id', bookId)

    return NextResponse.json({
      ok: true,
      collectible_name: metadata?.collectible_name,
      collectible_concept: metadata?.concept,
      collectible_lore: metadata?.lore,
      collectible_source_moment: metadata?.source_moment,
      collectible_research: researchUrls,
      collectible_image_url: imageUrl,
      collectible_version: newVersion,
      collectible_openai_response_id: responseId,
    })

  } catch (err: any) {
    console.error('Collectible generation error:', err)
    if (bookId) {
      try { await getSupabaseAdmin().from('books').update({ collectible_status: 'generation_failed' }).eq('id', bookId) } catch { /* ignore */ }
    }
    return NextResponse.json({ error: err?.message || 'Generation failed' }, { status: 500 })
  }
}

// Approve or reject a collectible
export async function PATCH(req: NextRequest) {
  const { bookId, action } = await req.json()
  if (!bookId) return NextResponse.json({ error: 'bookId required' }, { status: 400 })

  let backToIdeas = false
  if (action === 'reject') {
    const { data } = await getSupabaseAdmin().from('books').select('collectible_options').eq('id', bookId).single()
    backToIdeas = Array.isArray(data?.collectible_options) && data.collectible_options.length > 0
  }
  const payload = action === 'reject'
    ? { collectible_status: backToIdeas ? 'options' : null, collectible_name: null, collectible_concept: null, collectible_lore: null, collectible_image_url: null, collectible_openai_response_id: null, collectible_prompt: null }
    : { collectible_status: 'approved', collectible_approved_at: new Date().toISOString() }

  const { error } = await getSupabaseAdmin().from('books').update(payload).eq('id', bookId)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true, status: action === 'reject' ? (backToIdeas ? 'options' : null) : 'approved' })
}
