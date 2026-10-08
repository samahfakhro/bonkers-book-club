'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { setOptions, importLibrary } from '@googlemaps/js-api-loader'

// Routes: pick a delivery date → each zone delivering that day → generate, review/reorder, lock.
// The locked route is the single source of truth for packing order, boxes, labels and the driver.

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const dubaiToday = () => new Date(Date.now() + 4 * 3600_000).toISOString().slice(0, 10)
const addDays = (date: string, n: number) => new Date(new Date(`${date}T12:00:00Z`).getTime() + n * 86400_000).toISOString().slice(0, 10)
const weekday = (date: string) => DAYS[new Date(`${date}T12:00:00Z`).getUTCDay()]
const prettyDate = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })

type ZoneDay = {
  zone: { id: string; code: string | null; name: string; bonkers_day: string }
  waiting: { families: number; deliveries: number; collections: number; noPin: string[] }
  route: { id: string; status: string; optimised_with: string | null; total_distance_m: number | null; stops: number } | null
}
type Stop = {
  id: string; ref: string; box: string; visit_ref: string; stop_order: number; stop_type: string; status: string
  latitude: number | null; longitude: number | null
  expected_deliveries_count: number; expected_collections_count: number
  households: { first_name: string | null; last_name: string | null; villa_flat: string | null; street: string | null; area: string | null; property_type: string | null; building: string | null } | null
}
type Route = { id: string; route_date: string; status: string; optimised_with: string | null; total_distance_m: number | null; start_lat: number; start_lng: number; zones: { code: string; name: string } | null; stops: Stop[] }

const TYPE_LABEL: Record<string, string> = { delivery: 'Delivery', collection: 'Collection', both: 'Delivery + Collection' }
const TYPE_COLOUR: Record<string, string> = { delivery: '#2a78d6', collection: '#b45309', both: '#7b55d6' }

let mapsConfigured = false

export default function RoutesPage() {
  const router = useRouter()
  const [date, setDate] = useState(dubaiToday())
  const [zoneDays, setZoneDays] = useState<ZoneDay[]>([])
  const [unscheduled, setUnscheduled] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [route, setRoute] = useState<Route | null>(null)

  const mapDiv = useRef<HTMLDivElement>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const drawn = useRef<(google.maps.Marker | google.maps.Polyline)[]>([])
  const saveQueue = useRef<Promise<unknown>>(Promise.resolve())

  const load = useCallback(async (d: string) => {
    setLoading(true)
    const res = await fetch(`/api/admin/routes?date=${d}`)
    const body = await res.json().catch(() => ({}))
    setLoading(false)
    if (!res.ok) { setMsg({ ok: false, text: body.error || 'Could not load routes' }); setZoneDays([]); return }
    setZoneDays(body.zones)
    setUnscheduled(body.unscheduled || [])
  }, [])

  useEffect(() => { load(date); setRoute(null); setMsg(null) }, [date, load])

  const openRoute = async (id: string) => {
    const res = await fetch(`/api/admin/routes/${id}`)
    const body = await res.json().catch(() => ({}))
    if (!res.ok) { setMsg({ ok: false, text: body.error || 'Could not open route' }); return }
    setRoute(body)
  }

  const generate = async (zd: ZoneDay) => {
    if (zd.route && !confirm(`Rebuild the ${zd.zone.name} route? Any manual reordering will be lost.`)) return
    setBusy(zd.zone.id)
    setMsg(null)
    const res = await fetch('/api/admin/routes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'generate', zoneId: zd.zone.id, date }) })
    const body = await res.json().catch(() => ({}))
    setBusy(null)
    if (!res.ok) { setMsg({ ok: false, text: body.error || 'Could not generate route' }); return }
    setMsg({ ok: true, text: `${zd.zone.name}: ${body.stops} stop${body.stops === 1 ? '' : 's'} in order.${body.noPin?.length ? ` Not included (no map pin): ${body.noPin.join(', ')}.` : ''}` })
    await Promise.all([load(date), openRoute(body.routeId)])
  }

  const act = async (action: 'lock' | 'unlock' | 'reorder', stopIds?: string[]) => {
    if (!route) return
    if (action === 'unlock' && !confirm('Unlock this route? If packing has started, stop numbers on bags and labels may no longer match once you change the order.')) return
    setBusy(route.id)
    const res = await fetch(`/api/admin/routes/${route.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, stopIds }) })
    const body = await res.json().catch(() => ({}))
    setBusy(null)
    if (!res.ok) { setMsg({ ok: false, text: body.error || 'Could not update the route' }); return }
    setRoute(body)
    load(date)
  }

  // Reorder instantly on screen (list, stop numbers, boxes and map), then save in the background
  const move = (index: number, dir: -1 | 1) => {
    if (!route) return
    const j = index + dir
    if (j < 0 || j >= route.stops.length) return
    const before = route
    const stops = [...route.stops]
    ;[stops[index], stops[j]] = [stops[j], stops[index]]
    const code = route.zones?.code || 'Z?'
    const renumbered = stops.map((s, k) => ({
      ...s, stop_order: k + 1,
      ref: `${code}-${String(k + 1).padStart(3, '0')}`,
      box: String.fromCharCode(65 + Math.floor(k / 25)),
    }))
    setRoute({ ...route, stops: renumbered, optimised_with: 'manual' })
    // saves queue one after another, so quick clicks can't arrive out of order
    saveQueue.current = saveQueue.current.then(() => fetch(`/api/admin/routes/${route.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'reorder', stopIds: renumbered.map(s => s.id) }) }))
      .then(async res => {
        if (res.ok) return
        const body = await res.json().catch(() => ({}))
        setRoute(before)
        setMsg({ ok: false, text: `That move wasn’t saved: ${body.error || 'please try again'}` })
      })
      .catch(() => { setRoute(before); setMsg({ ok: false, text: 'That move wasn’t saved — check your connection and try again.' }) })
  }

  // ── Map of the open route ────────────────────────────────────────────────
  useEffect(() => {
    if (!route || !mapDiv.current) return
    let cancelled = false
    ;(async () => {
      if (!mapsConfigured) { setOptions({ key: process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || '', version: 'weekly' } as any); mapsConfigured = true }
      const { Map, Polyline } = await importLibrary('maps') as google.maps.MapsLibrary
      const { Marker } = await importLibrary('marker') as google.maps.MarkerLibrary
      if (cancelled || !mapDiv.current) return
      if (!mapRef.current) mapRef.current = new Map(mapDiv.current, { center: { lat: route.start_lat, lng: route.start_lng }, zoom: 13, streetViewControl: false, fullscreenControl: false, mapTypeControl: false })
      const map = mapRef.current
      drawn.current.forEach(d => d.setMap(null))
      drawn.current = []
      const start = { lat: route.start_lat, lng: route.start_lng }
      const pts = route.stops.filter(s => s.latitude != null && s.longitude != null).map(s => ({ s, p: { lat: s.latitude as number, lng: s.longitude as number } }))
      drawn.current.push(new Marker({ map, position: start, title: 'Warehouse', label: { text: 'W', color: '#fff', fontWeight: '700' }, icon: { path: google.maps.SymbolPath.CIRCLE, scale: 12, fillColor: '#1a1a1a', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2 } }))
      drawn.current.push(new Polyline({ map, path: [start, ...pts.map(x => x.p)], strokeColor: '#1a2f51', strokeOpacity: 0.6, strokeWeight: 3 }))
      for (const { s, p } of pts) drawn.current.push(new Marker({
        map, position: p, title: `${s.ref} ${[s.households?.first_name, s.households?.last_name].filter(Boolean).join(' ')}`,
        label: { text: String(s.stop_order), color: '#fff', fontSize: '11px', fontWeight: '700' },
        icon: { path: google.maps.SymbolPath.CIRCLE, scale: 11, fillColor: TYPE_COLOUR[s.stop_type] || '#555', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2 },
      }))
      if (process.env.NODE_ENV === 'development') (window as any).__routeMap = { markers: () => drawn.current.filter(d => d instanceof google.maps.Marker).map(m => (m as google.maps.Marker).getTitle()) } // for automated testing only
      const b = new google.maps.LatLngBounds(start)
      pts.forEach(x => b.extend(x.p))
      if (pts.length) map.fitBounds(b, 50)
    })().catch(console.error)
    return () => { cancelled = true }
  }, [route])

  // ── UI ───────────────────────────────────────────────────────────────────
  const btn = (primary = false, disabled = false): React.CSSProperties => ({
    padding: '7px 13px', borderRadius: '6px', fontSize: '12px', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.45 : 1,
    border: `1px solid ${primary ? '#1a1a1a' : '#ccc'}`, background: primary ? '#1a1a1a' : '#fff', color: primary ? '#fff' : '#1a1a1a',
  })
  const days = Array.from({ length: 8 }, (_, i) => addDays(dubaiToday(), i))
  const locked = route?.status === 'locked'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', color: '#1a1a1a' }}>
      <div style={{ padding: '18px 24px 12px', borderBottom: '1px solid #e5e5e5' }}>
        <button onClick={() => router.push('/admin/operations')} style={{ background: 'none', border: 'none', padding: 0, fontSize: '12px', color: '#9b9b9b', cursor: 'pointer' }}>← Operations</button>
        <h1 style={{ fontSize: '15px', fontWeight: 700, margin: '6px 0 12px' }}>Routes</h1>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
          {days.map(d => (
            <button key={d} onClick={() => setDate(d)} style={btn(d === date)}>{prettyDate(d)}</button>
          ))}
          <input type="date" value={date} onChange={e => e.target.value && setDate(e.target.value)} style={{ padding: '6px', border: '1px solid #ccc', borderRadius: '6px', fontSize: '12px' }} />
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* Zones delivering that day */}
        <div style={{ width: '340px', flexShrink: 0, borderRight: '1px solid #e5e5e5', padding: '14px 16px', overflowY: 'auto', fontSize: '13px' }}>
          {msg && <p style={{ margin: '0 0 12px', padding: '8px 10px', borderRadius: '6px', lineHeight: 1.45, background: msg.ok ? '#eef8f1' : '#fdecea', border: `1px solid ${msg.ok ? '#b9e2c6' : '#f3b8b1'}` }}>{msg.text}</p>}
          <p style={{ margin: '0 0 10px', fontSize: '11px', fontWeight: 700, color: '#9b9b9b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{weekday(date)} {prettyDate(date)}</p>
          {loading ? <p style={{ color: '#9b9b9b' }}>Loading…</p> : zoneDays.length === 0 ? (
            <p style={{ color: '#9b9b9b', lineHeight: 1.5 }}>No zone delivers on {weekday(date)}s.{unscheduled.length ? ` (Still without a delivery day: ${unscheduled.join(', ')}.)` : ''}</p>
          ) : zoneDays.map(zd => (
            <div key={zd.zone.id} style={{ border: `1px solid ${route && zd.route?.id === route.id ? '#1a1a1a' : '#e5e5e5'}`, borderRadius: '8px', padding: '11px 12px', marginBottom: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <strong>{zd.zone.code} {zd.zone.name}</strong>
                <span style={{ fontSize: '11px', color: zd.route?.status === 'locked' ? '#2e7d32' : '#9b9b9b' }}>{zd.route ? (zd.route.status === 'locked' ? '🔒 Locked' : 'Draft') : 'No route yet'}</span>
              </div>
              <p style={{ margin: '6px 0 0', color: '#555', lineHeight: 1.5 }}>
                {zd.route ? `${zd.route.stops} stop${zd.route.stops === 1 ? '' : 's'} on the route` : `${zd.waiting.families} famil${zd.waiting.families === 1 ? 'y needs' : 'ies need'} a visit`}
                {zd.waiting.families > 0 && <> · waiting: {zd.waiting.deliveries} with books to deliver, {zd.waiting.collections} with books to collect</>}
              </p>
              {zd.waiting.noPin.length > 0 && <p style={{ margin: '4px 0 0', color: '#b45309', fontSize: '12px' }}>⚠ No map pin (can’t be routed): {zd.waiting.noPin.join(', ')}</p>}
              <div style={{ display: 'flex', gap: '6px', marginTop: '9px' }}>
                {zd.route && <button style={btn()} onClick={() => openRoute(zd.route!.id)}>Open</button>}
                {zd.route?.status !== 'locked' && (
                  <button style={btn(!zd.route, busy === zd.zone.id || (!zd.route && zd.waiting.families === 0))} disabled={busy === zd.zone.id || (!zd.route && zd.waiting.families === 0)} onClick={() => generate(zd)}>
                    {busy === zd.zone.id ? 'Working…' : zd.route ? 'Rebuild' : 'Generate route'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Open route: map + stops */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {!route ? (
            <p style={{ padding: '24px', color: '#9b9b9b' }}>Generate or open a route to see it here.</p>
          ) : (
            <>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e5e5', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <strong style={{ fontSize: '14px' }}>{route.zones?.code} {route.zones?.name} · {prettyDate(route.route_date)}</strong>
                <span style={{ fontSize: '12px', color: '#9b9b9b' }}>
                  {[
                    `${route.stops.length} stop${route.stops.length === 1 ? '' : 's'}`,
                    route.total_distance_m ? `about ${(route.total_distance_m / 1000).toFixed(1)} km${route.optimised_with === 'google' ? '' : ' as the crow flies'}` : null,
                    `order by ${route.optimised_with === 'google' ? 'Google' : route.optimised_with === 'manual' ? 'hand' : 'built-in calculation'}`,
                  ].filter(Boolean).join(' · ')}
                </span>
                <span style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
                  {locked
                    ? <button style={btn(false, busy === route.id)} disabled={busy === route.id} onClick={() => act('unlock')}>Unlock</button>
                    : <button style={btn(true, busy === route.id || !route.stops.length)} disabled={busy === route.id || !route.stops.length} onClick={() => act('lock')}>🔒 Lock route</button>}
                </span>
              </div>
              <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
                <div style={{ width: '380px', flexShrink: 0, overflowY: 'auto', borderRight: '1px solid #e5e5e5', fontSize: '12.5px' }}>
                  {locked && <p style={{ margin: 0, padding: '8px 14px', background: '#eef8f1', color: '#2e7d32' }}>Locked — stop numbers are fixed for packing and the driver.</p>}
                  {route.stops.map((s, i) => (
                    <div key={s.id} style={{ display: 'flex', gap: '10px', alignItems: 'center', padding: '9px 14px', borderBottom: '1px solid #f0f0f0', background: i > 0 && s.box !== route.stops[i - 1].box ? 'linear-gradient(#ddd, #ddd) top / 100% 2px no-repeat' : undefined }}>
                      <div style={{ width: '58px', flexShrink: 0 }}>
                        <div style={{ fontWeight: 800, fontSize: '13px' }}>{s.ref}</div>
                        <div style={{ fontSize: '10.5px', color: '#9b9b9b' }}>Box {route.zones?.code}-{s.box}</div>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600 }}>{[s.households?.first_name, s.households?.last_name].filter(Boolean).join(' ')}</div>
                        <div style={{ color: '#777', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {[s.households?.villa_flat && (s.households?.property_type === 'apartment' ? `Flat ${s.households.villa_flat}` : `Villa ${s.households.villa_flat}`), s.households?.building, s.households?.street && `St ${s.households.street}`, s.households?.area].filter(Boolean).join(', ')}
                        </div>
                        <div style={{ marginTop: '2px' }}>
                          <span style={{ color: TYPE_COLOUR[s.stop_type], fontWeight: 600 }}>{TYPE_LABEL[s.stop_type] || s.stop_type}</span>
                          <span style={{ color: '#9b9b9b' }}> · {s.expected_deliveries_count ? `${s.expected_deliveries_count} child order${s.expected_deliveries_count === 1 ? '' : 's'}` : ''}{s.expected_deliveries_count && s.expected_collections_count ? ', ' : ''}{s.expected_collections_count ? `${s.expected_collections_count} book${s.expected_collections_count === 1 ? '' : 's'} back` : ''} · {s.visit_ref}</span>
                        </div>
                      </div>
                      {!locked && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <button title="Move earlier" style={{ ...btn(false, i === 0 || !!busy), padding: '1px 7px' }} disabled={i === 0 || !!busy} onClick={() => move(i, -1)}>↑</button>
                          <button title="Move later" style={{ ...btn(false, i === route.stops.length - 1 || !!busy), padding: '1px 7px' }} disabled={i === route.stops.length - 1 || !!busy} onClick={() => move(i, 1)}>↓</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div ref={mapDiv} style={{ flex: 1 }} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
