import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getRoute, weekdayOf } from '@/lib/routes/server'
import { envelopeCode, familyCode } from '@/lib/routes/codes'

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

    const route = await getRoute(routeId)
    const stopIds = route.stops.map(s => s.id)
    const hhIds = route.stops.map(s => s.household_id)

    const [{ data: requests }, { data: children }, { data: loans }] = await Promise.all([
      stopIds.length ? supabaseAdmin.from('swap_requests').select('id, child_id, route_stop_id').in('route_stop_id', stopIds) : Promise.resolve({ data: [] as any[] }),
      hhIds.length ? supabaseAdmin.from('child_profiles').select('id, household_id, name, last_name, created_at').in('household_id', hhIds).order('created_at') : Promise.resolve({ data: [] as any[] }),
      stopIds.length ? supabaseAdmin.from('loans').select('id, collection_stop_id').in('collection_stop_id', stopIds) : Promise.resolve({ data: [] as any[] }),
    ])
    const requestIds = (requests || []).map(r => r.id)
    const { data: items } = requestIds.length
      ? await supabaseAdmin.from('swap_request_items').select('id, swap_request_id, book_id, books(id, title, author, cover_image_url)').in('swap_request_id', requestIds)
      : { data: [] as any[] }

    const bookIds = [...new Set((items || []).map(i => i.book_id).filter(Boolean))]
    const shelf = new Map<string, string>()
    if (bookIds.length) {
      const { data: copies } = await supabaseAdmin.from('book_copies').select('book_id, shelf_location').in('book_id', bookIds).eq('status', 'available')
      for (const c of copies || []) if (c.book_id && c.shelf_location && !shelf.has(c.book_id)) shelf.set(c.book_id, c.shelf_location)
    }

    // A child's number in the family is fixed by when they were added (1, 2, 3…)
    const childNumber = new Map<string, number>()
    for (const hhId of hhIds) (children || []).filter(c => c.household_id === hhId).forEach((c, i) => childNumber.set(c.id, i + 1))

    const stops = route.stops.map(s => {
      const reqs = (requests || []).filter(r => r.route_stop_id === s.id)
      return {
        ...s,
        familyCode: familyCode(s.household_id),
        collectCount: (loans || []).filter(l => l.collection_stop_id === s.id).length,
        children: reqs.map(r => {
          const child = (children || []).find(c => c.id === r.child_id)
          const n = childNumber.get(r.child_id) ?? 1
          return {
            childId: r.child_id, requestId: r.id, number: n, envelopeCode: envelopeCode(s.household_id, n),
            name: child?.name || 'Child', lastName: child?.last_name || '',
            books: (items || []).filter(i => i.swap_request_id === r.id).map(i => ({
              itemId: i.id, bookId: i.book_id, title: (i as any).books?.title || 'Unknown', author: (i as any).books?.author || null,
              coverUrl: (i as any).books?.cover_image_url || null, shelfLocation: shelf.get(i.book_id) || null,
            })),
          }
        }).filter(c => c.books.length > 0).sort((a, b) => a.number - b.number),
      }
    })
    return NextResponse.json({ ...route, weekday: weekdayOf(route.route_date), stops })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Could not load packing' }, { status: 500 })
  }
}

// POST { action: 'scan', code }                       → which book copy this barcode is
// POST { action: 'packed', stopId, copyIds }          → mark the visit packed (copies → packed)
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
      const copyIds: string[] = Array.isArray(body.copyIds) ? body.copyIds : []
      if (copyIds.length) await supabaseAdmin.from('book_copies').update({ status: 'packed' }).in('id', copyIds)
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
