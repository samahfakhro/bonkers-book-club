import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function uploadBase64ToStorage(bucket: string, path: string, base64: string): Promise<string | null> {
  const matches = base64.match(/^data:(.+);base64,(.+)$/)
  if (!matches) return null
  const contentType = matches[1]
  const buffer = Buffer.from(matches[2], 'base64')
  const { error } = await supabaseAdmin.storage.from(bucket).upload(path, buffer, { contentType, upsert: true })
  if (error) return null
  const { data } = supabaseAdmin.storage.from(bucket).getPublicUrl(path)
  return data.publicUrl
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { book, internalId, coverBase64 } = body

  const { data: newBook, error: bookErr } = await supabaseAdmin
    .from('books')
    .insert(book)
    .select('id, title, author, cover_image_url, discovery_asset_url, isbn, page_count, book_type, series_id, series_number, reading_level_id, search_tags, description, age_min, age_max')
    .single()

  if (bookErr || !newBook) {
    return NextResponse.json({ error: bookErr?.message || 'Insert failed' }, { status: 400 })
  }

  // Upload cover server-side if provided as base64
  if (coverBase64) {
    const ext = coverBase64.startsWith('data:image/png') ? 'png' : 'jpg'
    const path = `${newBook.id}-${Date.now()}.${ext}`
    const publicUrl = await uploadBase64ToStorage('book-covers', path, coverBase64)
    if (publicUrl) {
      await supabaseAdmin.from('books').update({ cover_image_url: publicUrl }).eq('id', newBook.id)
      newBook.cover_image_url = publicUrl
    }
  }

  const { data: newCopy, error: copyErr } = await supabaseAdmin
    .from('book_copies')
    .insert({ book_id: newBook.id, internal_id: internalId, status: 'available' })
    .select('id, book_id, internal_id, status')
    .single()

  return NextResponse.json({ book: newBook, copy: newCopy || null, copyError: copyErr?.message || null })
}

export async function PUT(req: NextRequest) {
  const { id, bucket, base64, field } = await req.json()
  if (!id || !bucket || !base64 || !field) return NextResponse.json({ error: 'missing fields' }, { status: 400 })
  const ext = base64.startsWith('data:image/png') ? 'png' : 'jpg'
  const path = `${id}-${Date.now()}.${ext}`
  const publicUrl = await uploadBase64ToStorage(bucket, path, base64)
  if (!publicUrl) return NextResponse.json({ error: 'storage upload failed' }, { status: 500 })
  await supabaseAdmin.from('books').update({ [field]: publicUrl }).eq('id', id)
  return NextResponse.json({ publicUrl })
}

export async function PATCH(req: NextRequest) {
  const { id, ...fields } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error } = await supabaseAdmin.from('books').update(fields).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  // Fetch book for storage + series cleanup
  const { data: book } = await supabaseAdmin.from('books').select('cover_image_url, discovery_asset_url, series_id').eq('id', id).single()

  // Delete related records
  await supabaseAdmin.from('book_reading_levels').delete().eq('book_id', id)
  await supabaseAdmin.from('book_categories').delete().eq('book_id', id)
  await supabaseAdmin.from('book_copies').delete().eq('book_id', id)

  // Delete the book
  const { error } = await supabaseAdmin.from('books').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Clean up storage files
  if (book?.cover_image_url) {
    const path = book.cover_image_url.split('/book-covers/')[1]
    if (path) await supabaseAdmin.storage.from('book-covers').remove([path])
  }
  if (book?.discovery_asset_url) {
    const path = book.discovery_asset_url.split('/book-assets/')[1]
    if (path) await supabaseAdmin.storage.from('book-assets').remove([path])
  }

  // Delete orphaned series (series with no remaining books)
  if (book?.series_id) {
    const { count } = await supabaseAdmin.from('books').select('id', { count: 'exact', head: true }).eq('series_id', book.series_id)
    if (count === 0) {
      await supabaseAdmin.from('series').delete().eq('id', book.series_id)
      // Also clean up any sub-series of that series
      await supabaseAdmin.from('series').delete().eq('parent_series_id', book.series_id)
    }
  }

  return NextResponse.json({ ok: true })
}
