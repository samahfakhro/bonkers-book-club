import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  const ids = req.nextUrl.searchParams.get('ids')

  if (ids) {
    const idList = ids.split(',').filter(Boolean)
    const { data, error } = await supabaseAdmin
      .from('series')
      .select('id, name, series_number, parent_series_id, parent:parent_series_id ( id, name )')
      .in('id', idList)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ data })
  }

  if (!id) return NextResponse.json({ error: 'id or ids required' }, { status: 400 })
  const { data, error } = await supabaseAdmin
    .from('series')
    .select('id, name, series_number, parent_series_id, parent:parent_series_id ( id, name )')
    .eq('id', id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data })
}
