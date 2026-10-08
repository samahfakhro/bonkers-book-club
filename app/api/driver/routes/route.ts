import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { dubaiToday } from '@/lib/routes/server'

// GET ?date=YYYY-MM-DD (default: today in Dubai) → that day's locked/completed routes with progress
// TODO: driver logins — once they exist, only show routes assigned to the signed-in driver
export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get('date') || dubaiToday()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: 'Bad date' }, { status: 400 })
  try {
    const { data: routes, error } = await supabaseAdmin
      .from('routes').select('id, route_date, status, zones(code, name)')
      .eq('route_date', date).in('status', ['locked', 'completed'])
    if (error) throw error
    const out = []
    for (const r of routes || []) {
      const { data: stops } = await supabaseAdmin.from('route_stops').select('status').eq('route_id', r.id)
      out.push({ ...r, stops: stops?.length ?? 0, done: (stops || []).filter(s => s.status === 'done' || s.status === 'cancelled').length })
    }
    return NextResponse.json({ date, routes: out })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Could not load routes' }, { status: 500 })
  }
}
