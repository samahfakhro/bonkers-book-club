'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { setOptions, importLibrary } from '@googlemaps/js-api-loader'
import booleanPointInPolygon from '@turf/boolean-point-in-polygon'
import simplify from '@turf/simplify'
import area from '@turf/area'
import { point } from '@turf/helpers'
import { supabase } from '@/lib/supabase'
import { findZoneProblems, toPolygon, type ZoneProblems } from '@/lib/zones/validate'
import draftV1 from '@/lib/zones/draft-v1.json'
import draftV3 from '@/lib/zones/draft-v3-editable.json' // v3 with ~100–180 corners per zone; neighbours share exact corners

// Zone drawing tool: draw / reshape the delivery zones on the map, see overlaps and gaps live,
// set each zone's delivery day + cutoff, and save straight to the database.

const CODES = ['Z1', 'Z2', 'Z3', 'Z4', 'Z5', 'Z6']
const DEFAULT_NAMES: Record<string, string> = Object.fromEntries(
  (draftV1 as any).features.map((f: any) => [f.properties.zone_id, f.properties.name]))
const COLOURS: Record<string, string> = {
  Z1: '#2a78d6', Z2: '#e8833a', Z3: '#2e9e5b', Z4: '#c93c8f', Z5: '#7b55d6', Z6: '#d4a514',
}
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
const DUBAI_CENTER = { lat: 25.12, lng: 55.27 }

type LngLat = [number, number]
type EditZone = { code: string; name: string; bonkers_day: string | null; cutoff_time: string; ring: LngLat[] }
type Source = 'saved' | 'draft-v1' | 'draft-v3' | 'blank'

const blankZones = (): EditZone[] => CODES.map(code => ({ code, name: DEFAULT_NAMES[code] || code, bonkers_day: null, cutoff_time: '20:00', ring: [] }))

function outerRing(geometry: any): LngLat[] {
  // take the largest piece's outer ring, without the repeated closing corner
  const parts = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
  const biggest = parts.map((p: any) => [p, area({ type: 'Polygon', coordinates: p } as any)]).sort((a: any, b: any) => b[1] - a[1])[0][0]
  return biggest[0].slice(0, -1).map((c: number[]) => [c[0], c[1]] as LngLat)
}

function fromDraft(draft: any, simplifyTolerance = 0): EditZone[] {
  return blankZones().map(z => {
    const f = draft.features.find((x: any) => x.properties.zone_id === z.code)
    if (!f) return z
    const shaped = simplifyTolerance ? simplify(f, { tolerance: simplifyTolerance, highQuality: true }) : f
    return { ...z, ring: outerRing(shaped.geometry) }
  })
}

let mapsConfigured = false

export default function AdminZonesPage() {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const polysRef = useRef<Record<string, google.maps.Polygon>>({})
  const overlaysRef = useRef<google.maps.Polygon[]>([])
  const markerRef = useRef<google.maps.Marker | null>(null)
  const sessionTokenRef = useRef<any>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [mapReady, setMapReady] = useState(false)
  const [zones, setZones] = useState<EditZone[]>(blankZones())
  const zonesRef = useRef(zones)
  zonesRef.current = zones
  const [rebuildKey, setRebuildKey] = useState(0)       // bump to redraw every polygon from state
  const [source, setSource] = useState<Source>('saved')
  const [savedJson, setSavedJson] = useState<string | null>(null)
  const [savedVersion, setSavedVersion] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const selectedRef = useRef(selected)
  selectedRef.current = selected
  const [drawing, setDrawing] = useState(false)
  const drawingRef = useRef(drawing)
  drawingRef.current = drawing
  const [history, setHistory] = useState<EditZone[][]>([])
  const [problems, setProblems] = useState<ZoneProblems>({ overlaps: [], gaps: [], crossed: [], tooSmall: [] })
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [tap, setTap] = useState<{ lat: number; lng: number; codes: string[] } | null>(null)
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<any[]>([])

  const unsaved = useMemo(() => savedJson !== null && JSON.stringify(zones) !== savedJson, [zones, savedJson])

  // ── Autosave: keep unsaved drawing in this browser so a crash / tab reload never loses work ──
  const DRAFT_KEY = 'bonkers-zone-editor-draft'
  const [restoreOffer, setRestoreOffer] = useState<{ savedAt: number; zones: EditZone[] } | null>(null)
  const draftReadyRef = useRef(false) // don't overwrite a stored draft until we've offered to restore it

  useEffect(() => {
    if (savedJson === null || draftReadyRef.current) return
    try {
      const raw = localStorage.getItem(DRAFT_KEY)
      const draft = raw ? JSON.parse(raw) : null
      if (draft?.zones && JSON.stringify(draft.zones) !== JSON.stringify(zonesRef.current)) { setRestoreOffer(draft); return }
    } catch { /* storage unavailable — nothing to restore */ }
    draftReadyRef.current = true
  }, [savedJson])

  useEffect(() => {
    if (!draftReadyRef.current) return
    const t = setTimeout(() => {
      try {
        if (unsaved) localStorage.setItem(DRAFT_KEY, JSON.stringify({ savedAt: Date.now(), zones }))
        else localStorage.removeItem(DRAFT_KEY)
      } catch { /* storage full or blocked — the page still works, just without the safety copy */ }
    }, 400)
    return () => clearTimeout(t)
  }, [zones, unsaved])

  // Warn before leaving the page with unsaved changes
  useEffect(() => {
    if (!unsaved) return
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [unsaved])

  const resolveRestore = (restore: boolean) => {
    if (restore && restoreOffer) {
      setHistory(h => [...h, zonesRef.current])
      setZones(restoreOffer.zones)
      setRebuildKey(k => k + 1)
    }
    if (!restore) { try { localStorage.removeItem(DRAFT_KEY) } catch {} }
    setRestoreOffer(null)
    draftReadyRef.current = true
  }

  // ── Load ────────────────────────────────────────────────────────────────
  const loadSource = useCallback(async (requested: Source) => {
    let src = requested
    setNotice(null)
    let next: EditZone[]
    if (src === 'saved') {
      const { data, error } = await supabase.from('zones').select('code, name, bonkers_day, cutoff_time, polygon, version')
      const rows = (data || []).filter((r: any) => r.code && r.polygon)
      if (error || !rows.length) {
        next = fromDraft(draftV3)
        src = 'draft-v3'
        setNotice(error
          ? 'Couldn’t read saved zones (has the database update been run?). Showing Claude’s v3 as a starting point.'
          : 'No zones saved yet. Showing Claude’s v3 as a starting point — reshape it and press Save.')
        setSavedVersion(null)
        setSavedJson(JSON.stringify(blankZones()))
      } else {
        next = blankZones().map(z => {
          const r: any = rows.find((x: any) => x.code === z.code)
          return r ? { code: z.code, name: r.name, bonkers_day: r.bonkers_day, cutoff_time: r.cutoff_time || '20:00', ring: outerRing(r.polygon.geometry || r.polygon) } : z
        })
        setSavedVersion((rows[0] as any).version || null)
        setSavedJson(JSON.stringify(next))
      }
    } else {
      // keep names/days/cutoffs, swap only the shapes
      const shapes = src === 'draft-v1' ? fromDraft(draftV1) : src === 'draft-v3' ? fromDraft(draftV3) : blankZones()
      next = zonesRef.current.map(z => ({ ...z, ring: shapes.find(s => s.code === z.code)!.ring }))
    }
    setHistory(h => (zonesRef.current.some(z => z.ring.length) ? [...h, zonesRef.current] : h))
    setZones(next)
    setSource(src)
    setSelected(null)
    setDrawing(false)
    setRebuildKey(k => k + 1)
  }, [])

  useEffect(() => { loadSource('saved') }, [loadSource])

  // ── Map setup ───────────────────────────────────────────────────────────
  const checkPoint = useCallback((lat: number, lng: number) => {
    const pt = point([lng, lat])
    const codes = zonesRef.current.filter(z => { const p = toPolygon(z); return p && booleanPointInPolygon(pt, p) }).map(z => z.code)
    markerRef.current?.setPosition({ lat, lng })
    markerRef.current?.setMap(mapRef.current)
    setTap({ lat, lng, codes })
  }, [])

  const handleMapClick = useCallback((latLng: google.maps.LatLng) => {
    const code = selectedRef.current
    // while drawing, clicks near another zone's corner land exactly on it, so borders join up
    if (drawingRef.current && code) polysRef.current[code]?.getPath().push(nearestOtherCornerRef.current(code, latLng) || latLng)
    else if (!code) checkPoint(latLng.lat(), latLng.lng()) // no address-check dot while reshaping a zone
  }, [checkPoint])
  const nearestOtherCornerRef = useRef<(code: string, ll: google.maps.LatLng) => google.maps.LatLng | null>(() => null)

  useEffect(() => {
    if (!containerRef.current) return
    let cancelled = false
    async function init() {
      if (!mapsConfigured) {
        setOptions({ key: process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || '', version: 'weekly' } as any)
        mapsConfigured = true
      }
      const { Map } = await importLibrary('maps') as google.maps.MapsLibrary
      const { Marker } = await importLibrary('marker') as google.maps.MarkerLibrary
      if (cancelled) return
      const map = new Map(containerRef.current!, {
        center: DUBAI_CENTER, zoom: 11, mapTypeControl: true, fullscreenControl: false,
        streetViewControl: false, clickableIcons: false, draggableCursor: 'crosshair',
      })
      mapRef.current = map
      markerRef.current = new Marker({
        map: null, zIndex: 999,
        icon: { path: google.maps.SymbolPath.CIRCLE, scale: 7, fillColor: '#111', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2 },
      })
      map.addListener('click', (e: google.maps.MapMouseEvent) => { if (e.latLng) handleMapClick(e.latLng) })
      setMapReady(true)
    }
    init().catch(console.error)
    return () => { cancelled = true }
  }, [handleMapClick])

  // ── Polygons: rebuild from state when the shapes are replaced wholesale ─────
  // ── Shared-corner helpers ───────────────────────────────────────────────
  const unlinkedRef = useRef(false) // true while clearing a zone to redraw it: don't touch neighbours
  const linkingRef = useRef(false)  // true while applying a linked change to neighbours
  const same = (a: google.maps.LatLng, b: google.maps.LatLng) =>
    Math.abs(a.lat() - b.lat()) < 1e-7 && Math.abs(a.lng() - b.lng()) < 1e-7
  const metres = (a: google.maps.LatLng, b: google.maps.LatLng) =>
    Math.hypot((a.lat() - b.lat()) * 111_320, (a.lng() - b.lng()) * 111_320 * Math.cos(a.lat() * Math.PI / 180))
  const SNAP_M = 25

  function forOtherCornersAt(code: string, at: google.maps.LatLng, fn: (path: google.maps.MVCArray<google.maps.LatLng>, j: number) => void) {
    if (unlinkedRef.current) return
    for (const [c, poly] of Object.entries(polysRef.current)) {
      if (c === code) continue
      const p = poly.getPath()
      for (let j = p.getLength() - 1; j >= 0; j--) if (same(p.getAt(j), at)) fn(p, j)
    }
  }

  function nearestOtherCorner(code: string, moved: google.maps.LatLng, old?: google.maps.LatLng): google.maps.LatLng | null {
    let best: google.maps.LatLng | null = null, bestD = SNAP_M
    for (const [c, poly] of Object.entries(polysRef.current)) {
      if (c === code) continue
      poly.getPath().forEach(ll => {
        if (same(ll, moved) || (old && same(ll, old))) return
        const d = metres(ll, moved)
        if (d < bestD) { bestD = d; best = ll }
      })
    }
    return best
  }

  nearestOtherCornerRef.current = (code, ll) => nearestOtherCorner(code, ll)

  const readRing = (poly: google.maps.Polygon): LngLat[] =>
    poly.getPath().getArray().map(ll => [Number(ll.lng().toFixed(6)), Number(ll.lat().toFixed(6))] as LngLat)

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    Object.values(polysRef.current).forEach(p => p.setMap(null))
    polysRef.current = {}
    for (const z of zonesRef.current) {
      const poly = new google.maps.Polygon({
        // always one (possibly empty) path, so a blank zone still has a path to draw into
        map, paths: [z.ring.map(([lng, lat]) => ({ lat, lng }))],
        strokeColor: COLOURS[z.code], strokeWeight: 2, fillColor: COLOURS[z.code], fillOpacity: 0.2,
        editable: false, clickable: false, zIndex: 1,
      })
      const path = poly.getPath()
      const sync = () => {
        const ring = readRing(poly)
        setZones(prev => prev.map(x => x.code === z.code ? { ...x, ring } : x))
      }
      // Corners on a shared border belong to both zones: move / add / remove them together.
      // A corner that ISN'T shared snaps onto a nearby corner of another zone so borders meet exactly.
      // linkingRef stops the follow-on events (the neighbour updating) from linking/snapping again —
      // without it two zones could keep nudging each other forever and freeze the page.
      const guarded = (what: string, fn: () => void) => {
        if (linkingRef.current) { sync(); return }
        const before = zonesRef.current // one undo step per user action, however many zones it touches
        setHistory(h => [...h.slice(-49), before])
        linkingRef.current = true
        try { fn() } catch (err) {
          console.error(`Zone editor: ${what} failed`, err)
          setNotice('Something went wrong joining that corner to the neighbouring zone. Your drawing is kept — press Undo if the shape looks wrong.')
        } finally { linkingRef.current = false }
        sync()
      }
      path.addListener('set_at', (i: number, old: google.maps.LatLng) => guarded('moving a corner', () => {
        const moved = path.getAt(i)
        let shared = false
        forOtherCornersAt(z.code, old, () => { shared = true })
        if (shared) {
          forOtherCornersAt(z.code, old, (p, j) => p.setAt(j, moved))
        } else {
          const snap = nearestOtherCorner(z.code, moved, old)
          if (snap) path.setAt(i, snap)
        }
      }))
      path.addListener('insert_at', (i: number) => guarded('adding a corner', () => {
        const n = path.getLength()
        if (drawingRef.current || n <= 3) return
        const before = path.getAt((i - 1 + n) % n), after = path.getAt((i + 1) % n), added = path.getAt(i)
        for (const [code, other] of Object.entries(polysRef.current)) {
          if (code === z.code) continue
          const op = other.getPath(), m = op.getLength()
          for (let j = 0; j < m; j++) {
            const a = op.getAt(j), b = op.getAt((j + 1) % m)
            if ((same(a, before) && same(b, after)) || (same(a, after) && same(b, before))) { op.insertAt(j + 1, added); break }
          }
        }
      }))
      path.addListener('remove_at', (_i: number, removed: google.maps.LatLng) => guarded('removing a corner', () => {
        if (removed) forOtherCornersAt(z.code, removed, (p, j) => { if (p.getLength() > 3) p.removeAt(j) })
      }))
      // right-click a corner to remove it
      poly.addListener('contextmenu', (e: any) => {
        if (selectedRef.current === z.code && e.vertex != null && poly.getPath().getLength() > 3) poly.getPath().removeAt(e.vertex)
      })
      poly.addListener('click', (e: google.maps.PolyMouseEvent) => { if (e.latLng) handleMapClick(e.latLng) })
      polysRef.current[z.code] = poly
    }
    if (process.env.NODE_ENV === 'development') (window as any).__zoneEditor = { polys: polysRef.current } // for automated testing only
  }, [rebuildKey, mapReady, handleMapClick])

  // Only the selected zone is editable; the others are faint and let clicks through
  useEffect(() => {
    for (const [code, poly] of Object.entries(polysRef.current)) {
      const isSel = code === selected
      poly.setOptions({
        editable: isSel && !drawing, clickable: isSel,
        fillOpacity: selected && !isSel ? 0.1 : isSel ? 0.3 : 0.2,
        strokeWeight: isSel ? 3 : 2, zIndex: isSel ? 5 : 1,
      })
    }
  }, [selected, drawing, rebuildKey, mapReady])

  // ── Live checks ─────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setProblems(findZoneProblems(zones)), 350)
    return () => clearTimeout(t)
  }, [zones])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    overlaysRef.current.forEach(o => o.setMap(null))
    overlaysRef.current = []
    const draw = (shape: any, colour: string) => {
      const parts = shape.geometry.type === 'Polygon' ? [shape.geometry.coordinates] : shape.geometry.coordinates
      for (const p of parts) overlaysRef.current.push(new google.maps.Polygon({
        map, paths: p.map((ring: number[][]) => ring.map(([lng, lat]) => ({ lat, lng }))),
        fillColor: colour, fillOpacity: 0.6, strokeColor: colour, strokeWeight: 2, clickable: false, zIndex: 10,
      }))
    }
    problems.overlaps.forEach(o => draw(o.shape, '#e0221b'))
    problems.gaps.forEach(g => draw(g.shape, '#ff9800'))
  }, [problems, mapReady])

  const zoomTo = (shape: any) => {
    const b = new google.maps.LatLngBounds()
    const parts = shape.geometry.type === 'Polygon' ? [shape.geometry.coordinates] : shape.geometry.coordinates
    parts.forEach((p: number[][][]) => p[0].forEach(([lng, lat]) => b.extend({ lat, lng })))
    mapRef.current?.fitBounds(b, 80)
  }

  // ── Actions ─────────────────────────────────────────────────────────────
  const selectZone = (code: string) => {
    setDrawing(false)
    setSelected(s => (s === code ? null : code))
  }

  const startDrawing = (code: string) => {
    const z = zones.find(x => x.code === code)!
    if (z.ring.length && !confirm(`Clear ${code}'s current shape and draw a new one?`)) return
    setSelected(code)
    setHistory(h => [...h.slice(-49), zonesRef.current])
    unlinkedRef.current = true
    linkingRef.current = true // clearing is one action: no per-corner undo steps, no touching neighbours
    try { polysRef.current[code]?.getPath().clear() } finally { linkingRef.current = false; unlinkedRef.current = false }
    setDrawing(true)
  }

  const undo = () => {
    const prev = history[history.length - 1]
    if (!prev) return
    setHistory(h => h.slice(0, -1))
    setZones(prev)
    setRebuildKey(k => k + 1)
  }

  const updateField = (code: string, field: 'name' | 'bonkers_day' | 'cutoff_time', value: string) =>
    setZones(prev => prev.map(z => z.code === code ? { ...z, [field]: field === 'bonkers_day' ? (value || null) : value } : z))

  const save = async () => {
    if (problems.gaps.length && !confirm(`There ${problems.gaps.length === 1 ? 'is 1 gap' : `are ${problems.gaps.length} gaps`} between zones (orange). Homes there would go to the waitlist. Save anyway?`)) return
    setSaving(true)
    setSaveMsg(null)
    const res = await fetch('/api/admin/zones', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ zones }) })
    const body = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) {
      const dbMissing = /column|schema cache|does not exist|no unique|ON CONFLICT/i.test(body.error || '')
      setSaveMsg({ ok: false, text: dbMissing
        ? 'Not saved: the database update for zones hasn’t been run yet. Your drawing is safe in this browser — run the update, then press Save again.'
        : `Not saved: ${body.error || 'something went wrong'}. Your drawing is safe in this browser — try Save again.` })
      return
    }
    setSavedJson(JSON.stringify(zones))
    setSavedVersion(body.version)
    setSaveMsg({ ok: true, text: `Saved ${body.saved} zones — live for new signups now.` })
  }

  // ── Address search ──────────────────────────────────────────────────────
  const fetchSuggestions = useCallback(async (input: string) => {
    if (input.length < 3) { setSuggestions([]); return }
    try {
      const { AutocompleteSuggestion, AutocompleteSessionToken } = await importLibrary('places') as any
      if (!sessionTokenRef.current) sessionTokenRef.current = new AutocompleteSessionToken()
      const { suggestions: s } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({ input, sessionToken: sessionTokenRef.current, includedRegionCodes: ['ae'] })
      setSuggestions(s || [])
    } catch { setSuggestions([]) }
  }, [])

  const selectSuggestion = async (s: any) => {
    setSuggestions([])
    try {
      const place = s.placePrediction.toPlace()
      await place.fetchFields({ fields: ['location', 'formattedAddress'] })
      const lat = place.location.lat(), lng = place.location.lng()
      setQuery(place.formattedAddress || '')
      sessionTokenRef.current = null
      mapRef.current?.panTo({ lat, lng })
      mapRef.current?.setZoom(15)
      checkPoint(lat, lng)
    } catch (e) { console.error(e) }
  }

  // ── UI ──────────────────────────────────────────────────────────────────
  const blocking = problems.overlaps.length + problems.crossed.length + problems.tooSmall.length
  const btn = (primary = false): React.CSSProperties => ({
    padding: '6px 11px', borderRadius: '6px', fontSize: '0.78rem', cursor: 'pointer',
    border: `1px solid ${primary ? '#1a1a1a' : '#ccc'}`, background: primary ? '#1a1a1a' : '#fff', color: primary ? '#fff' : '#1a1a1a',
  })
  const label: React.CSSProperties = { margin: '0 0 6px', fontSize: '0.68rem', fontWeight: 700, color: '#9b9b9b', textTransform: 'uppercase', letterSpacing: '0.08em' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', color: '#1a1a1a' }}>
      <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid #e5e5e5', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '240px' }}>
          <h1 style={{ fontWeight: 700, fontSize: '1.1rem', margin: '0 0 2px' }}>Delivery Zones</h1>
          <p style={{ color: '#9b9b9b', fontSize: '0.78rem', margin: 0 }}>
            {savedVersion ? `Live version: ${savedVersion}` : 'Nothing saved yet'}{unsaved && <strong style={{ color: '#b45309' }}> · unsaved changes</strong>}
          </p>
        </div>
        <button style={btn()} onClick={undo} disabled={!history.length}>↶ Undo</button>
        <button style={{ ...btn(true), opacity: blocking || saving ? 0.4 : 1, cursor: blocking || saving ? 'not-allowed' : 'pointer' }} disabled={!!blocking || saving} onClick={save}>
          {saving ? 'Saving…' : 'Save zones'}
        </button>
      </div>

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <div style={{ width: '330px', flexShrink: 0, borderRight: '1px solid #e5e5e5', padding: '14px 16px', overflowY: 'auto', fontSize: '0.83rem' }}>
          {restoreOffer && (
            <div style={{ margin: '0 0 12px', padding: '10px 11px', background: '#e8f1fd', border: '1px solid #9cc0f0', borderRadius: '6px', lineHeight: 1.45 }}>
              <strong>You have unsaved drawing</strong> from {new Date(restoreOffer.savedAt).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })}. Restore it?
              <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                <button style={btn(true)} onClick={() => resolveRestore(true)}>Restore my drawing</button>
                <button style={btn()} onClick={() => { if (confirm('Throw away the unsaved drawing for good?')) resolveRestore(false) }}>Discard it</button>
              </div>
            </div>
          )}
          {notice && <p style={{ margin: '0 0 12px', padding: '8px 10px', background: '#fff8e1', border: '1px solid #f3d57a', borderRadius: '6px', lineHeight: 1.45 }}>{notice}</p>}
          {saveMsg && <p style={{ margin: '0 0 12px', padding: '8px 10px', borderRadius: '6px', lineHeight: 1.45, background: saveMsg.ok ? '#eef8f1' : '#fdecea', border: `1px solid ${saveMsg.ok ? '#b9e2c6' : '#f3b8b1'}` }}>{saveMsg.text}</p>}

          {/* Checks */}
          <p style={label}>Checks</p>
          <div style={{ marginBottom: '16px', lineHeight: 1.6 }}>
            {problems.overlaps.length === 0 ? <div style={{ color: '#2e7d32' }}>✓ No overlaps</div> : problems.overlaps.map((o, i) => (
              <div key={i} style={{ color: '#c62828' }}>✕ {o.codes.join(' + ')} overlap ({(o.areaM2 / 1e6).toFixed(2)} km²) <button style={{ ...btn(), padding: '1px 7px' }} onClick={() => zoomTo(o.shape)}>Show</button></div>
            ))}
            {problems.gaps.length === 0 ? <div style={{ color: '#2e7d32' }}>✓ No gaps between zones</div> : problems.gaps.map((g, i) => (
              <div key={i} style={{ color: '#b45309' }}>⚠ Gap between {g.codes.join(' + ')} ({(g.areaM2 / 1e6).toFixed(2)} km²) <button style={{ ...btn(), padding: '1px 7px' }} onClick={() => zoomTo(g.shape)}>Show</button></div>
            ))}
            {problems.crossed.map(c => <div key={c} style={{ color: '#c62828' }}>✕ {c}’s outline crosses over itself</div>)}
            {problems.tooSmall.map(c => <div key={c} style={{ color: '#c62828' }}>✕ {c} needs at least 3 corners</div>)}
          </div>

          {/* Zones */}
          <p style={label}>Zones</p>
          {zones.map(z => {
            const isSel = selected === z.code
            return (
              <div key={z.code} style={{ border: `1px solid ${isSel ? COLOURS[z.code] : '#e5e5e5'}`, borderLeft: `5px solid ${COLOURS[z.code]}`, borderRadius: '8px', padding: '9px 10px', marginBottom: '8px', background: isSel ? '#fafafa' : '#fff' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                  <strong style={{ width: '24px' }}>{z.code}</strong>
                  <input value={z.name} onChange={e => updateField(z.code, 'name', e.target.value)} style={{ flex: 1, minWidth: 0, padding: '4px 6px', border: '1px solid #ddd', borderRadius: '5px', fontSize: '0.8rem' }} />
                </div>
                <div style={{ display: 'flex', gap: '6px', marginBottom: '7px' }}>
                  <select value={z.bonkers_day || ''} onChange={e => updateField(z.code, 'bonkers_day', e.target.value)} style={{ flex: 1, padding: '4px', border: '1px solid #ddd', borderRadius: '5px', fontSize: '0.78rem' }}>
                    <option value="">Day not set</option>
                    {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                  <input type="time" value={z.cutoff_time} onChange={e => updateField(z.code, 'cutoff_time', e.target.value)} title="Order cutoff time" style={{ width: '92px', padding: '4px', border: '1px solid #ddd', borderRadius: '5px', fontSize: '0.78rem' }} />
                </div>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <button style={btn(isSel && !drawing)} onClick={() => selectZone(z.code)}>{isSel && !drawing ? 'Done' : 'Reshape'}</button>
                  {isSel && drawing
                    ? <button style={btn(true)} onClick={() => setDrawing(false)}>Finish drawing</button>
                    : <button style={btn()} onClick={() => startDrawing(z.code)}>Draw new</button>}
                  <span style={{ marginLeft: 'auto', color: '#9b9b9b', fontSize: '0.72rem' }}>{z.ring.length} corners</span>
                </div>
              </div>
            )
          })}

          <div style={{ margin: '6px 0 16px', padding: '9px 10px', background: '#f7f7f7', borderRadius: '6px', fontSize: '0.76rem', lineHeight: 1.55, color: '#555' }}>
            <strong>Reshape:</strong> drag the white corner dots; drag the faint in-between dots to add a corner; right-click a corner to remove it.<br />
            <strong>Draw new:</strong> click around the zone’s edge on the map, then “Finish drawing”.<br />
            Corners on a shared border move for both zones; a corner dropped near another zone’s corner snaps onto it.<br />
            Red = overlap (must fix before saving), orange = gap. Your drawing is kept in this browser until you save.
          </div>

          {/* Check an address */}
          <p style={label}>Check an address</p>
          <div style={{ position: 'relative', marginBottom: '10px' }}>
            <input type="text" value={query} placeholder="Search an address…"
              onChange={e => { const v = e.target.value; setQuery(v); if (debounceRef.current) clearTimeout(debounceRef.current); debounceRef.current = setTimeout(() => fetchSuggestions(v), 300) }}
              style={{ width: '100%', padding: '7px 9px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '0.82rem', boxSizing: 'border-box' }} />
            {suggestions.length > 0 && (
              <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: '#fff', border: '1px solid #ddd', borderRadius: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', zIndex: 10 }}>
                {suggestions.map((s: any, i: number) => (
                  <div key={i} onMouseDown={() => selectSuggestion(s)} style={{ padding: '7px 9px', cursor: 'pointer', borderTop: i ? '1px solid #f0f0f0' : 'none' }}>{s.placePrediction?.text?.text}</div>
                ))}
              </div>
            )}
          </div>
          {tap && (
            <p style={{ margin: '0 0 16px', padding: '8px 10px', borderRadius: '6px', background: tap.codes.length === 1 ? '#eef8f1' : tap.codes.length ? '#fdecea' : '#f5f5f5' }}>
              {tap.codes.length === 1 ? <strong>{tap.codes[0]} — {zones.find(z => z.code === tap.codes[0])?.name}</strong>
                : tap.codes.length ? <strong style={{ color: '#c62828' }}>In {tap.codes.join(' + ')} — overlap</strong>
                : <strong>Outside all zones → waitlist</strong>}
              <span style={{ display: 'block', color: '#9b9b9b', fontSize: '0.72rem' }}>{tap.lat.toFixed(5)}, {tap.lng.toFixed(5)}</span>
              <button style={{ ...btn(), marginTop: '6px', padding: '2px 8px' }} onClick={() => { setTap(null); markerRef.current?.setMap(null) }}>✕ Clear</button>
            </p>
          )}

          {/* Starting point */}
          <p style={label}>Start again from</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {([['saved', 'Saved zones'], ['draft-v1', 'ChatGPT draft'], ['draft-v3', 'Claude v3'], ['blank', 'Blank']] as [Source, string][]).map(([s, l]) => (
              <button key={s} style={btn(source === s)} onClick={() => { if (!unsaved || confirm('Replace the shapes on the map? (Undo can bring them back.)')) loadSource(s) }}>{l}</button>
            ))}
          </div>
        </div>

        <div ref={containerRef} style={{ flex: 1 }} />
      </div>
    </div>
  )
}
