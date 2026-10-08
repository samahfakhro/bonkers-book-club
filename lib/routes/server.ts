// Server-only route logic. One source of truth:
//   Zone + delivery date → Route → Stops (one per family visit) → book choices delivered + books collected
// Packing order, boxes of 25, labels and the driver's order all come from route_stops.stop_order.
import { supabaseAdmin } from '@/lib/supabase-admin'
import { builtInOrder, routeLengthKm, type LatLng } from '@/lib/routing/builtin'

export const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
export const BOX_SIZE = 25

// YYYY-MM-DD → weekday name. Uses midday UTC so the calendar date never shifts with time zones.
export function weekdayOf(date: string): string {
  return DAYS[new Date(`${date}T12:00:00Z`).getUTCDay()]
}

// Today's date in Dubai (UTC+4, no daylight saving), as YYYY-MM-DD
export function dubaiToday(): string {
  return new Date(Date.now() + 4 * 3600_000).toISOString().slice(0, 10)
}

export const stopRef = (zoneCode: string | null, stopOrder: number) => `${zoneCode || 'Z?'}-${String(stopOrder).padStart(3, '0')}`
export const boxLetter = (stopOrder: number) => String.fromCharCode(65 + Math.floor((stopOrder - 1) / BOX_SIZE))

export async function getWarehouse(): Promise<LatLng & { address: string }> {
  const { data } = await supabaseAdmin.from('system_settings').select('key, value').in('key', ['warehouse_lat', 'warehouse_lng', 'warehouse_address'])
  const get = (k: string) => data?.find(r => r.key === k)?.value
  return {
    lat: Number(get('warehouse_lat') ?? 25.052733),
    lng: Number(get('warehouse_lng') ?? 55.256031),
    address: get('warehouse_address') ?? 'Villa 29, Street 12, Saheel, Arabian Ranches 1',
  }
}

export type Candidate = {
  householdId: string
  name: string
  lat: number | null
  lng: number | null
  deliveries: number          // locked book choices (one per child) waiting for a visit
  collections: number         // books marked "returning" waiting for a visit
  requestIds: string[]
  loanIds: string[]
}

// Every family in the zone that needs a visit: new books to deliver, books to collect, or both
export async function candidatesForZone(zoneId: string): Promise<Candidate[]> {
  const { data: households, error } = await supabaseAdmin
    .from('households')
    .select('id, first_name, last_name, latitude, longitude, account_status')
    .eq('signup_zone_id', zoneId)
    .eq('account_status', 'active')
  if (error) throw error
  const ids = (households || []).map(h => h.id)
  if (!ids.length) return []

  const [{ data: requests, error: rErr }, { data: loans, error: lErr }] = await Promise.all([
    supabaseAdmin.from('swap_requests').select('id, household_id').in('household_id', ids).eq('status', 'locked').is('route_stop_id', null),
    supabaseAdmin.from('loans').select('id, household_id').in('household_id', ids).eq('return_requested', true).is('collection_stop_id', null).is('returned_at', null),
  ])
  if (rErr) throw rErr
  if (lErr) throw lErr

  // a locked choice with no books in it is nothing to deliver
  const reqIds = (requests || []).map(r => r.id)
  const { data: items, error: iErr } = reqIds.length
    ? await supabaseAdmin.from('swap_request_items').select('swap_request_id').in('swap_request_id', reqIds)
    : { data: [] as { swap_request_id: string }[], error: null }
  if (iErr) throw iErr
  const withBooks = new Set((items || []).map(i => i.swap_request_id))

  return (households || []).map(h => {
    const reqs = (requests || []).filter(r => r.household_id === h.id && withBooks.has(r.id))
    const lns = (loans || []).filter(l => l.household_id === h.id)
    return {
      householdId: h.id,
      name: [h.first_name, h.last_name].filter(Boolean).join(' ') || 'Unnamed family',
      lat: h.latitude, lng: h.longitude,
      deliveries: reqs.length, collections: lns.length,
      requestIds: reqs.map(r => r.id), loanIds: lns.map(l => l.id),
    }
  }).filter(c => c.deliveries > 0 || c.collections > 0)
}

// Build (or rebuild) the draft route for a zone + date. Locked routes are never touched.
export async function generateRoute(zoneId: string, date: string) {
  const { data: zone, error: zErr } = await supabaseAdmin.from('zones').select('id, code, name, bonkers_day').eq('id', zoneId).single()
  if (zErr || !zone) throw new Error('Zone not found')
  if (zone.bonkers_day && zone.bonkers_day !== weekdayOf(date)) throw new Error(`${zone.name} delivers on ${zone.bonkers_day}s, not ${weekdayOf(date)}s`)

  const { data: existing } = await supabaseAdmin.from('routes').select('id, status').eq('zone_id', zoneId).eq('route_date', date)
  if ((existing || []).some(r => r.status !== 'draft')) throw new Error('This route is already locked — unlock it before regenerating')

  // remove the old draft: its stops go, and the book choices / collections they had claimed are released
  for (const r of existing || []) {
    await supabaseAdmin.from('route_stops').delete().eq('route_id', r.id)
    await supabaseAdmin.from('routes').delete().eq('id', r.id)
  }

  const candidates = await candidatesForZone(zoneId)
  const placeable = candidates.filter(c => typeof c.lat === 'number' && typeof c.lng === 'number')
  const noPin = candidates.filter(c => !placeable.includes(c))

  const warehouse = await getWarehouse()
  const points = placeable.map(c => ({ lat: c.lat as number, lng: c.lng as number }))
  // TODO (Phase D): try Google Route Optimization first; this built-in order is the backup
  const order = builtInOrder(warehouse, points)
  const ordered = order.map(i => placeable[i])

  const { data: route, error: rtErr } = await supabaseAdmin.from('routes').insert({
    zone_id: zoneId, route_date: date, status: 'draft',
    start_lat: warehouse.lat, start_lng: warehouse.lng, optimised_with: 'built_in',
    total_distance_m: Math.round(routeLengthKm(warehouse, order.map(i => points[i])) * 1000),
  }).select('id').single()
  if (rtErr || !route) throw rtErr || new Error('Could not create route')

  if (ordered.length) {
    const { data: hhRows } = await supabaseAdmin.from('households').select('id, delivery_notes').in('id', ordered.map(c => c.householdId))
    const { data: stops, error: sErr } = await supabaseAdmin.from('route_stops').insert(ordered.map((c, k) => ({
      route_id: route.id, household_id: c.householdId, stop_order: k + 1, status: 'to_pick',
      stop_type: c.deliveries && c.collections ? 'both' : c.deliveries ? 'delivery' : 'collection',
      expected_deliveries_count: c.deliveries, expected_collections_count: c.collections,
      latitude: c.lat, longitude: c.lng,
      delivery_notes: hhRows?.find(h => h.id === c.householdId)?.delivery_notes ?? null,
    }))).select('id, household_id')
    if (sErr) throw sErr
    // claim what each visit carries, so it can't land on another route too
    for (const s of stops || []) {
      const c = ordered.find(x => x.householdId === s.household_id)!
      if (c.requestIds.length) await supabaseAdmin.from('swap_requests').update({ route_stop_id: s.id }).in('id', c.requestIds)
      if (c.loanIds.length) await supabaseAdmin.from('loans').update({ collection_stop_id: s.id }).in('id', c.loanIds)
    }
  }
  return { routeId: route.id, stops: ordered.length, noPin: noPin.map(c => c.name) }
}

export async function getRoute(routeId: string) {
  const { data: route, error } = await supabaseAdmin
    .from('routes')
    .select('id, route_date, status, locked_at, completed_at, start_lat, start_lng, optimised_with, total_distance_m, total_duration_s, zone_id, zones(code, name, bonkers_day)')
    .eq('id', routeId).single()
  if (error || !route) throw error || new Error('Route not found')
  const { data: stops, error: sErr } = await supabaseAdmin
    .from('route_stops')
    .select('id, visit_ref, stop_order, stop_type, status, outcome, outcome_notes, latitude, longitude, delivery_notes, expected_deliveries_count, expected_collections_count, packed_at, completed_at, household_id, households(first_name, last_name, villa_flat, building, street, sub_community, area, property_type, mobile_phone, delivery_preference, safe_spot_description)')
    .eq('route_id', routeId)
    .order('stop_order')
  if (sErr) throw sErr
  const zoneCode = (route.zones as any)?.code ?? null
  return {
    ...route,
    stops: (stops || []).map(s => ({ ...s, ref: stopRef(zoneCode, s.stop_order), box: boxLetter(s.stop_order) })),
  }
}

export async function reorderRoute(routeId: string, stopIds: string[]) {
  const { data: route } = await supabaseAdmin.from('routes').select('status').eq('id', routeId).single()
  if (route?.status !== 'draft') throw new Error('Only a draft route can be reordered — unlock it first')
  for (let k = 0; k < stopIds.length; k++) {
    const { error } = await supabaseAdmin.from('route_stops').update({ stop_order: k + 1 }).eq('id', stopIds[k]).eq('route_id', routeId)
    if (error) throw error
  }
  await supabaseAdmin.from('routes').update({ optimised_with: 'manual', updated_at: new Date().toISOString() }).eq('id', routeId)
}

export async function setRouteLocked(routeId: string, locked: boolean) {
  const { data: route } = await supabaseAdmin.from('routes').select('status').eq('id', routeId).single()
  if (!route) throw new Error('Route not found')
  if (route.status === 'completed') throw new Error('This route is completed')
  const { error } = await supabaseAdmin.from('routes').update(
    locked ? { status: 'locked', locked_at: new Date().toISOString() } : { status: 'draft', locked_at: null }
  ).eq('id', routeId)
  if (error) throw error
}
