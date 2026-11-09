import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { seriesLine } from '@/lib/book-titles'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET ?ids=bookId,bookId → { lines: { [bookId]: "Dog Man · Book 5" | null } }
// (the series table isn't readable by families directly, so the line is built here)
export async function GET(req: NextRequest) {
  const ids = (req.nextUrl.searchParams.get('ids') || '').split(',').filter(x => /^[0-9a-f-]{36}$/i.test(x)).slice(0, 200)
  if (!ids.length) return NextResponse.json({ lines: {} })
  const { data, error } = await supabaseAdmin
    .from('books')
    .select('id, series_number, series:series_id(name, series_number, parent_series_id, parent:parent_series_id(name))')
    .in('id', ids)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  const lines: Record<string, string | null> = {}
  for (const b of (data || []) as any[]) lines[b.id] = seriesLine(b.series, b.series_number)
  return NextResponse.json({ lines })
}
