import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60
export const dynamic = 'force-dynamic'
import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { BONKERS_BIBLE } from '@/lib/bonkers-bible'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Model identifiers — change here only
const CREATIVE_MODEL = process.env.OPENAI_CREATIVE_MODEL || 'gpt-4o'
const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1'

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

export async function POST(req: NextRequest) {
  let bookId: string | undefined
  try {
    const body = await req.json()
    bookId = body.bookId
    const mode: 'new' | 'retry' | 'revise' = body.mode || 'new'
    const previousResponseId: string | undefined = body.previousResponseId
    const feedback: string | undefined = body.feedback

    if (!bookId) return NextResponse.json({ error: 'bookId required' }, { status: 400 })

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
    if (categoryNames.length) userText += `Bonkers Categories: ${categoryNames.join(', ')}\n`
    if (b.description) userText += `\nDescription:\n${b.description}\n`
    if (b.cover_image_url) userText += `\nThe book cover image is included above for visual context.\n`

    if (existingList) {
      userText += `\nEXISTING COLLECTIBLES IN THE BONKERS UNIVERSE (avoid repetition of object types and concepts):\n${existingList}\n`
    }

    if (mode === 'retry') {
      userText += `\nIMPORTANT: The previous concept was REJECTED. You must create a SUBSTANTIALLY DIFFERENT concept for the same book. Do not repeat themes, object types, or visual approaches from your previous attempt. Think differently about what makes this book special.\n`
    } else if (mode === 'revise' && feedback) {
      userText += `\nFEEDBACK ON PREVIOUS CONCEPT:\n"${feedback}"\n\nPlease incorporate this feedback in your revised concept and image. The creative direction above comes from the Bonkers team — follow it precisely.\n`
    }

    userText += `\nNow apply the Bonkers Collectible Bible. Think carefully about the best concept, then output your JSON metadata block, then call the image_generation tool.`

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
      tools: [{
        type: 'image_generation',
        quality: 'high',
        size: '1024x1024',
        output_format: 'png',
        background: 'transparent',
      }],
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

    for (const item of (response.output || [])) {
      if (item.type === 'message') {
        for (const part of (item.content || [])) {
          if (part.type === 'output_text') textOutput += part.text
        }
      } else if (item.type === 'image_generation_call') {
        imageBase64 = item.result || null
      }
    }

    // Fallback: response.output_text
    if (!textOutput && response.output_text) textOutput = response.output_text

    const metadata = parseMetadata(textOutput)
    const responseId: string = response.id

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
      collectible_research: metadata?.research ? JSON.stringify(metadata.research) : null,
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
      collectible_research: metadata?.research,
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

  const payload = action === 'reject'
    ? { collectible_status: null, collectible_name: null, collectible_concept: null, collectible_lore: null, collectible_image_url: null, collectible_openai_response_id: null, collectible_prompt: null }
    : { collectible_status: 'approved', collectible_approved_at: new Date().toISOString() }

  const { error } = await getSupabaseAdmin().from('books').update(payload).eq('id', bookId)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
