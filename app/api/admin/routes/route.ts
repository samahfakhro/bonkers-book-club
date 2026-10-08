import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { candidatesForZone, generateRoute, weekdayOf, dubaiToday } from '@/lib/routes/server'

// GET ?date=YYYY-MM-DD → the zones that deliver that day, how many families need a visit, and any route already made
export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get('date') || dubaiToday()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: 'Bad date' }, { status: 400 })
  const weekday = weekdayOf(date)
  try {
    const { data: zones, error } = await supabaseAdmin.from('zones').select('id, code, name, bonkers_day').order('code')
    if (error) throw error
    const todays = (zones || []).filter(z => z.bonkers_day === weekday)
    const result = []
    for (const z of todays) {
      const [{ data: routes }, candidates] = await Promise.all([
        supabaseAdmin.from('routes').select('id, status, optimised_with, total_distance_m, locked_at').eq('zone_id', z.id).eq('route_date', date),
        candidatesForZone(z.id),
      ])
      const route = routes?.[0] || null
      let stopCount = 0
      if (route) {
        const { count } = await supabaseAdmin.from('route_stops').select('id', { count: 'exact', head: true }).eq('route_id', route.id)
        stopCount = count ?? 0
      }
      result.push({
        zone: z,
        waiting: {
          families: candidates.length,
          deliveries: candidates.filter(c => c.deliveries).length,
          collections: candidates.filter(c => c.collections).length,
          noPin: candidates.filter(c => typeof c.lat !== 'number' || typeof c.lng !== 'number').map(c => c.name),
        },
        route: route ? { ...route, stops: stopCount } : null,
      })
    }
    const unscheduled = (zones || []).filter(z => !z.bonkers_day).map(z => z.name)
    return NextResponse.json({ date, weekday, zones: result, unscheduled })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Could not load routes' }, { status: 500 })
  }
}

// POST { action: 'generate', zoneId, date } → build / rebuild the draft route
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  if (body.action !== 'generate' || !body.zoneId || !/^\d{4}-\d{2}-\d{2}$/.test(body.date || '')) {
    return NextResponse.json({ error: 'Send action "generate" with zoneId and date' }, { status: 400 })
  }
  try {
    return NextResponse.json(await generateRoute(body.zoneId, body.date))
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Could not generate route' }, { status: 400 })
  }
}
