import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('series')
    .select('id, name, parent_series_id, series_number, name_in_title')
    .order('name')
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    name?: string | null
    parent_series_id?: string | null
    series_number?: number | null
  }
  const name = body.name?.trim() || null
  const parentId = body.parent_series_id || null

  // Return existing match instead of creating a duplicate
  if (name) {
    let q = supabaseAdmin.from('series').select('id, name, parent_series_id, series_number').ilike('name', name)
    if (parentId) q = q.eq('parent_series_id', parentId)
    else q = q.is('parent_series_id', null)
    const { data: existing } = await q.limit(1).single()
    if (existing) return NextResponse.json({ data: existing })
  }

  const { data, error } = await supabaseAdmin
    .from('series')
    .insert({ name, parent_series_id: parentId, series_number: body.series_number ?? null })
    .select('id, name, parent_series_id, series_number')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data })
}

// tick-box "put the series name in front of titles": the database renames the books in the series (and its sub-series)
export async function PATCH(req: NextRequest) {
  const { id, name_in_title } = await req.json() as { id?: string; name_in_title?: boolean }
  if (!id || typeof name_in_title !== 'boolean') return NextResponse.json({ error: 'id and name_in_title required' }, { status: 400 })
  const { error } = await supabaseAdmin.from('series').update({ name_in_title }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
