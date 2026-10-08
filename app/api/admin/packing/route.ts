import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { weekdayOf } from '@/lib/routes/server'
import { routeWithEnvelopes } from '@/lib/routes/envelopes'

// GET ?routeId=…  → the route's stops in stop order, each with the children whose books go in this visit
// GET (no routeId) → upcoming routes to choose from
export async function GET(req: NextRequest) {
  const routeId = req.nextUrl.searchParams.get('routeId')
  try {
    if (!routeId) {
      const today = new Date(Date.now() + 4 * 3600_000).toISOString().slice(0, 10)
      const { data, error } = await supabaseAdmin
        .from('routes').select('id, route_date, status, zones(code, name)')
        .gte('route_date', today).order('route_date').limit(30)
      if (error) throw error
      return NextResponse.json({ routes: data })
    }

    const route = await routeWithEnvelopes(routeId)
    return NextResponse.json({ ...route, weekday: weekdayOf(route.route_date) })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Could not load packing' }, { status: 500 })
  }
}

// POST { action: 'scan', code }                       → which book copy this barcode is
// POST { action: 'packed', stopId, packed: [{ itemId, copyId }] } → mark the visit packed; remember each envelope's copies
// POST { action: 'unpack', stopId }                   → undo, back to "to pick"
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  try {
    if (body.action === 'scan') {
      const code = String(body.code || '').trim()
      if (!code) return NextResponse.json({ error: 'Nothing scanned' }, { status: 400 })
      const { data } = await supabaseAdmin.from('book_copies').select('id, book_id, internal_id, shelf_location, status').or(`internal_id.eq.${code.replace(/[,()]/g, '')},barcode.eq.${code.replace(/[,()]/g, '')}`).limit(1)
      if (!data?.length) return NextResponse.json({ error: `No book copy found for “${code}”` }, { status: 404 })
      return NextResponse.json({ copy: data[0] })
    }

    const { data: stop } = await supabaseAdmin.from('route_stops').select('id, route_id, routes(status)').eq('id', body.stopId).single()
    if (!stop) return NextResponse.json({ error: 'Stop not found' }, { status: 404 })
    if ((stop.routes as any)?.status !== 'locked') return NextResponse.json({ error: 'Lock the route before packing, so stop numbers can’t change' }, { status: 400 })

    if (body.action === 'packed') {
      const packed: { itemId: string; copyId: string }[] = Array.isArray(body.packed) ? body.packed : []
      if (packed.length) {
        await supabaseAdmin.from('book_copies').update({ status: 'packed' }).in('id', packed.map(p => p.copyId))
        await Promise.all(packed.map(p => supabaseAdmin.from('swap_request_items').update({ packed_copy_id: p.copyId }).eq('id', p.itemId)))
      }
      await supabaseAdmin.from('route_stops').update({ status: 'packed', packed_at: new Date().toISOString() }).eq('id', body.stopId)
      return NextResponse.json({ ok: true })
    }
    if (body.action === 'unpack') {
      await supabaseAdmin.from('route_stops').update({ status: 'to_pick', packed_at: null }).eq('id', body.stopId)
      return NextResponse.json({ ok: true })
    }
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Something went wrong' }, { status: 500 })
  }
}
