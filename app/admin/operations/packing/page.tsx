'use client'

import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

// Packing follows the LOCKED route: stops in stop order (Z3-001, Z3-002…), grouped into boxes of 25.
// Scan each book into its child's envelope, print labels, mark the visit packed (saved, survives refresh).

// ─── Types ─────────────────────────────────────────────────────────────────

type PackingBook = { itemId: string; bookId: string; title: string; author: string | null; coverUrl: string | null; shelfLocation: string | null }
type PackingChild = { childId: string; requestId: string; number: number; envelopeCode: string; name: string; lastName: string; books: PackingBook[] }
type Household = { first_name: string | null; last_name: string | null; villa_flat: string | null; building: string | null; street: string | null; sub_community: string | null; area: string | null; property_type: string | null; mobile_phone: string | null }
type Stop = {
  id: string; ref: string; box: string; visit_ref: string; stop_order: number; stop_type: string; status: string
  household_id: string; familyCode: string; collectCount: number; households: Household | null; children: PackingChild[]
}
type PackingRoute = { id: string; route_date: string; weekday: string; status: string; zones: { code: string; name: string } | null; stops: Stop[] }
type RouteChoice = { id: string; route_date: string; status: string; zones: { code: string; name: string } | null }
type Scanned = { copyId: string; internalId: string }

// ─── Shared styles ──────────────────────────────────────────────────────────

const font: React.CSSProperties = { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }
const inp: React.CSSProperties = { ...font, padding: '7px 10px', borderRadius: '6px', backgroundColor: '#fff', border: '1px solid #d4d4d4', color: '#1a1a1a', fontSize: '13px', outline: 'none' }
const secHead: React.CSSProperties = { ...font, fontSize: '11px', fontWeight: 700, color: '#9b9b9b', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 8px' }

function Btn({ variant = 'primary', disabled, onClick, children, style }: { variant?: 'primary' | 'secondary' | 'success'; disabled?: boolean; onClick?: () => void; children: React.ReactNode; style?: React.CSSProperties }) {
  const bg = variant === 'primary' ? '#1a1a1a' : variant === 'success' ? '#16a34a' : '#f0f0f0'
  const color = variant === 'secondary' ? '#1a1a1a' : '#ffffff'
  return (
    <button onClick={onClick} disabled={disabled} style={{ ...font, padding: '7px 14px', borderRadius: '6px', border: 'none', cursor: disabled ? 'default' : 'pointer', fontSize: '13px', fontWeight: 600, backgroundColor: bg, color, opacity: disabled ? 0.5 : 1, ...style }}>
      {children}
    </button>
  )
}

const prettyDate = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
const familyName = (h: Household | null) => [h?.first_name, h?.last_name].filter(Boolean).join(' ') || 'Family'

function addressLines(h: Household | null): { label: string; value: string }[] {
  if (!h) return []
  const isApartment = h.property_type === 'apartment'
  return [
    { label: 'Type', value: h.property_type ? h.property_type.charAt(0).toUpperCase() + h.property_type.slice(1) : '' },
    { label: isApartment ? 'Flat' : 'Villa', value: h.villa_flat || '' },
    ...(isApartment && h.building ? [{ label: 'Building', value: h.building }] : []),
    { label: 'Street', value: h.street || '' },
    { label: 'Sub-Community', value: h.sub_community || '' },
    { label: 'Community', value: h.area || '' },
    { label: 'City', value: 'Dubai' },
  ].filter(l => l.value)
}

// One-line address for lists: "Villa 29, Street 12, Saheel, Arabian Ranches 1"
function shortAddress(h: Household | null): string {
  if (!h) return ''
  const isApartment = h.property_type === 'apartment'
  return [
    h.villa_flat && `${isApartment ? 'Flat' : 'Villa'} ${h.villa_flat}`,
    isApartment && h.building, h.street && `Street ${h.street}`, h.sub_community, h.area,
  ].filter(Boolean).join(', ')
}

// ─── Label printing (layout unchanged; stop number added big, visit ref small, barcode = envelope code) ───

type Label = { childName: string; addressLines: { label: string; value: string }[]; phone: string; code: string; bonkersDay: string; stopRef: string; box: string; visitRef: string }
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function buildLabelHtml(labels: Label[]) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Packing Labels</title>
  <style>
    @page { size: 4in 6in; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #fff; }
    .label { width: 4in; height: 6in; padding: 0.25in; page-break-after: always; display: flex; flex-direction: column; overflow: hidden; }
    .label:last-child { page-break-after: avoid; }
    .top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.2in; }
    .brand { font-size: 9pt; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: #888; }
    .stop { text-align: right; line-height: 1; }
    .stop-ref { font-size: 30pt; font-weight: 900; color: #111; letter-spacing: 0.02em; }
    .stop-box { font-size: 9pt; font-weight: 700; color: #666; margin-top: 2pt; }
    .child-name { font-size: 26pt; font-weight: 800; line-height: 1.15; color: #111; margin-bottom: 0.15in; }
    .divider { border: none; border-top: 1px solid #ccc; margin-bottom: 0.15in; }
    .addr-table { width: 100%; border-collapse: collapse; margin-bottom: 0.1in; flex: 1; }
    .addr-table td { font-size: 10pt; line-height: 1.6; vertical-align: top; }
    .addr-label { color: #888; width: 1.1in; padding-right: 0.06in; white-space: nowrap; }
    .addr-value { color: #111; font-weight: 600; }
    .footer { margin-top: 0.15in; display: flex; justify-content: space-between; align-items: flex-end; }
    .swap-label { font-size: 9pt; color: #666; }
    .swap-day { font-size: 10pt; font-weight: 700; color: #111; text-transform: capitalize; }
    .visit-ref { font-size: 8pt; color: #888; margin-top: 4pt; }
    .barcode-block { text-align: right; }
    svg { display: block; }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
</head>
<body>
  ${labels.map((l, i) => `
  <div class="label">
    <div class="top">
      <div class="brand">Bonkers — The Children's Library</div>
      <div class="stop"><div class="stop-ref">${esc(l.stopRef)}</div><div class="stop-box">Box ${esc(l.box)}</div></div>
    </div>
    <div class="child-name">${esc(l.childName)}</div>
    <hr class="divider">
    <table class="addr-table">
      ${l.addressLines.map(row => `<tr><td class="addr-label">${esc(row.label)}</td><td class="addr-value">${esc(row.value)}</td></tr>`).join('')}
      ${l.phone ? `<tr><td class="addr-label">Phone</td><td class="addr-value">${esc(l.phone)}</td></tr>` : ''}
    </table>
    <div class="footer">
      <div>
        <div class="swap-label">Bonkers Day</div>
        <div class="swap-day">${esc(l.bonkersDay || '—')}</div>
        <div class="visit-ref">${esc(l.visitRef)}</div>
      </div>
      <div class="barcode-block"><svg id="bc${i}"></svg></div>
    </div>
  </div>`).join('')}
  <script>
    window.addEventListener('load', function() {
      var labels = ${JSON.stringify(labels.map(l => l.code))};
      labels.forEach(function(code, i) {
        try { JsBarcode('#bc' + i, code, { format: 'CODE128', width: 1.5, height: 40, displayValue: true, fontSize: 9, margin: 0 }); } catch(e) {}
      });
      setTimeout(function() { window.print(); }, 300);
    });
  </script>
</body>
</html>`
}

function openLabelWindow(html: string) {
  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const win = window.open(url, '_blank')
  if (!win) { alert('Pop-up blocked — please allow pop-ups and try again.'); URL.revokeObjectURL(url); return }
  setTimeout(() => URL.revokeObjectURL(url), 60000)
  win.focus()
}

function labelsFor(stops: Stop[], route: PackingRoute): Label[] {
  const day = `${route.weekday} ${prettyDate(route.route_date).split(' ').slice(1).join(' ')}`
  return stops.flatMap(s => s.children.map(c => ({
    childName: [c.name, c.lastName].filter(Boolean).join(' '),
    addressLines: addressLines(s.households), phone: s.households?.mobile_phone || '',
    code: c.envelopeCode, bonkersDay: day, stopRef: s.ref, box: `${route.zones?.code}-${s.box}`, visitRef: s.visit_ref,
  })))
}

// ─── Main component ─────────────────────────────────────────────────────────

export default function PackingPage() {
  return <Suspense fallback={null}><Packing /></Suspense>
}

function Packing() {
  const router = useRouter()
  const params = useSearchParams()
  const [routes, setRoutes] = useState<RouteChoice[]>([])
  const [routeId, setRouteId] = useState<string | null>(params.get('route'))
  const [route, setRoute] = useState<PackingRoute | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // per-stop scan state: itemId → scanned copy
  const [scans, setScans] = useState<Record<string, Scanned>>({})
  const [scanInput, setScanInput] = useState<Record<string, string>>({})
  const [scanError, setScanError] = useState<Record<string, string | null>>({})
  const [scanning, setScanning] = useState<Record<string, boolean>>({})
  const [marking, setMarking] = useState<Record<string, boolean>>({})
  const scanRef = useRef<Record<string, HTMLInputElement | null>>({})

  useEffect(() => {
    fetch('/api/admin/packing').then(r => r.json()).then(b => {
      setRoutes(b.routes || [])
      if (!routeId) { const firstLocked = (b.routes || []).find((r: RouteChoice) => r.status === 'locked'); if (firstLocked) setRouteId(firstLocked.id) }
    }).catch(() => setError('Could not load routes'))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const loadRoute = useCallback(async (id: string) => {
    setLoading(true)
    setError(null)
    const res = await fetch(`/api/admin/packing?routeId=${id}`)
    const body = await res.json().catch(() => ({}))
    setLoading(false)
    if (!res.ok) { setError(body.error || 'Could not load this route'); setRoute(null); return }
    setRoute(body)
  }, [])

  useEffect(() => { if (routeId) { loadRoute(routeId); router.replace(`/admin/operations/packing?route=${routeId}`) } }, [routeId, loadRoute, router])

  async function handleScan(stop: Stop) {
    const value = (scanInput[stop.id] || '').trim()
    if (!value) return
    setScanning(p => ({ ...p, [stop.id]: true }))
    setScanError(p => ({ ...p, [stop.id]: null }))
    const res = await fetch('/api/admin/packing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'scan', code: value }) })
    const body = await res.json().catch(() => ({}))
    setScanInput(p => ({ ...p, [stop.id]: '' }))
    setScanning(p => ({ ...p, [stop.id]: false }))
    setTimeout(() => scanRef.current[stop.id]?.focus(), 50)
    if (!res.ok) { setScanError(p => ({ ...p, [stop.id]: body.error || 'Scan failed' })); return }
    const copy = body.copy
    if (Object.values(scans).some(s => s.copyId === copy.id)) { setScanError(p => ({ ...p, [stop.id]: `${copy.internal_id} has already been scanned` })); return }
    const target = stop.children.flatMap(c => c.books).find(b => b.bookId === copy.book_id && !scans[b.itemId])
    if (!target) { setScanError(p => ({ ...p, [stop.id]: copy.book_id ? `This book isn’t one of ${familyName(stop.households)}’s choices` : 'Copy found but has no book linked' })); return }
    setScans(p => ({ ...p, [target.itemId]: { copyId: copy.id, internalId: copy.internal_id } }))
  }

  async function setPacked(stop: Stop, packed: boolean) {
    setMarking(p => ({ ...p, [stop.id]: true }))
    const copyIds = stop.children.flatMap(c => c.books.map(b => scans[b.itemId]?.copyId)).filter(Boolean)
    const res = await fetch('/api/admin/packing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: packed ? 'packed' : 'unpack', stopId: stop.id, copyIds }) })
    const body = await res.json().catch(() => ({}))
    setMarking(p => ({ ...p, [stop.id]: false }))
    if (!res.ok) { setScanError(p => ({ ...p, [stop.id]: body.error || 'Could not save' })); return }
    setRoute(r => r ? { ...r, stops: r.stops.map(s => s.id === stop.id ? { ...s, status: packed ? 'packed' : 'to_pick' } : s) } : r)
    if (packed) setExpandedId(null)
  }

  const books = (s: Stop) => s.children.flatMap(c => c.books)
  const scannedCount = (s: Stop) => books(s).filter(b => scans[b.itemId]).length
  const allScanned = (s: Stop) => books(s).every(b => scans[b.itemId])

  const deliveryStops = route?.stops.filter(s => s.children.length) || []
  const packedCount = deliveryStops.filter(s => s.status === 'packed').length
  const boxes = route ? [...new Set(route.stops.map(s => s.box))] : []
  const locked = route?.status === 'locked'

  return (
    <div style={{ ...font, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Top bar */}
      <div style={{ padding: '12px 24px', borderBottom: '1px solid #e5e5e5', display: 'flex', alignItems: 'center', gap: '14px', flexShrink: 0, flexWrap: 'wrap' }}>
        <button onClick={() => router.push('/admin/operations')} style={{ ...font, background: 'none', border: 'none', cursor: 'pointer', color: '#9b9b9b', fontSize: '13px', padding: 0 }}>← Operations</button>
        <h1 style={{ ...font, margin: 0, fontSize: '15px', fontWeight: 700, color: '#1a1a1a' }}>Packing</h1>
        <select value={routeId || ''} onChange={e => { setScans({}); setExpandedId(null); setRouteId(e.target.value || null) }} style={{ ...inp, minWidth: '260px' }}>
          <option value="">Choose a route…</option>
          {routes.map(r => <option key={r.id} value={r.id}>{prettyDate(r.route_date)} · {r.zones?.code} {r.zones?.name}{r.status === 'locked' ? '' : ' (not locked yet)'}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        {route && <span style={{ ...font, fontSize: '13px', color: '#6b6b6b', fontWeight: 600 }}>{packedCount} / {deliveryStops.length} packed</span>}
        {route && locked && <Btn variant="secondary" onClick={() => openLabelWindow(buildLabelHtml(labelsFor(route.stops.filter(s => s.status !== 'packed'), route)))}>Print all unpacked labels</Btn>}
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
        {error && <p style={{ ...font, color: '#dc2626', fontSize: '13px' }}>{error}</p>}
        {!routeId && <p style={{ ...font, color: '#9b9b9b', fontSize: '14px' }}>Choose a route to pack. Routes are built and locked in Operations → Routes.</p>}
        {loading && <p style={{ ...font, color: '#9b9b9b', fontSize: '13px' }}>Loading…</p>}

        {route && !locked && (
          <div style={{ padding: '12px 14px', borderRadius: '8px', background: '#fff8e1', border: '1px solid #f3d57a', marginBottom: '18px', fontSize: '13px' }}>
            This route isn’t locked yet, so stop numbers could still change. <a href="/admin/operations/routes" style={{ color: '#1a1a1a', fontWeight: 600 }}>Lock it in Routes</a> before packing.
          </div>
        )}

        {route && boxes.map(box => {
          const inBox = route.stops.filter(s => s.box === box)
          return (
            <div key={box} style={{ marginBottom: '26px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <p style={{ ...secHead, margin: 0, fontSize: '12px', color: '#1a1a1a' }}>Box {route.zones?.code}-{box} · stops {inBox[0].ref} – {inBox[inBox.length - 1].ref}</p>
                {locked && <button onClick={() => openLabelWindow(buildLabelHtml(labelsFor(inBox, route)))} style={{ ...font, background: 'none', border: '1px solid #d4d4d4', borderRadius: '5px', cursor: 'pointer', fontSize: '11px', fontWeight: 600, color: '#4a4a4a', padding: '3px 10px' }}>Print box labels</button>}
              </div>

              {inBox.map(stop => {
                const isOpen = expandedId === stop.id
                const packed = stop.status === 'packed'
                const nothingToPack = !stop.children.length
                const total = books(stop).length, scanned = scannedCount(stop)
                return (
                  <div key={stop.id} style={{ marginBottom: '8px', border: `1px solid ${packed ? '#86efac' : '#e5e5e5'}`, borderRadius: '8px', overflow: 'hidden' }}>
                    <div
                      onClick={() => { if (nothingToPack || !locked) return; const next = isOpen ? null : stop.id; setExpandedId(next); if (next) setTimeout(() => scanRef.current[stop.id]?.focus(), 120) }}
                      style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '14px', cursor: nothingToPack || !locked ? 'default' : 'pointer', backgroundColor: packed ? '#f0fdf4' : '#fafafa', userSelect: 'none' }}>
                      <div style={{ width: '74px', flexShrink: 0 }}>
                        <p style={{ ...font, margin: 0, fontSize: '17px', fontWeight: 900, color: '#1a1a1a' }}>{stop.ref}</p>
                        <p style={{ ...font, margin: 0, fontSize: '10.5px', color: '#9b9b9b' }}>{stop.visit_ref}</p>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ ...font, margin: 0, fontSize: '14px', fontWeight: 600, color: '#1a1a1a' }}>{familyName(stop.households)}</p>
                        <p style={{ ...font, margin: '2px 0 0', fontSize: '12px', color: '#9b9b9b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {shortAddress(stop.households)}
                        </p>
                      </div>
                      {stop.collectCount > 0 && <span style={{ ...font, fontSize: '11px', fontWeight: 600, color: '#b45309', backgroundColor: '#fff7ed', padding: '3px 8px', borderRadius: '4px', flexShrink: 0 }}>Collect {stop.collectCount}</span>}
                      {nothingToPack
                        ? <span style={{ ...font, fontSize: '12px', color: '#9b9b9b', flexShrink: 0 }}>Collection only — nothing to pack</span>
                        : packed
                          ? <span style={{ ...font, fontSize: '12px', color: '#16a34a', fontWeight: 700, flexShrink: 0 }}>✓ Packed</span>
                          : <span style={{ ...font, fontSize: '12px', color: scanned > 0 ? '#16a34a' : '#9b9b9b', fontWeight: scanned > 0 ? 600 : 400, flexShrink: 0 }}>{scanned}/{total} scanned</span>}
                      {!nothingToPack && locked && (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9b9b9b" strokeWidth="2" style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }}><polyline points="6 9 12 15 18 9" /></svg>
                      )}
                    </div>

                    {isOpen && (
                      <div style={{ padding: '16px 20px', borderTop: '1px solid #e5e5e5', backgroundColor: '#fff' }}>
                        {!packed && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
                            <input
                              ref={el => { scanRef.current[stop.id] = el }}
                              value={scanInput[stop.id] || ''}
                              onChange={e => setScanInput(p => ({ ...p, [stop.id]: e.target.value }))}
                              onKeyDown={e => { if (e.key === 'Enter') handleScan(stop) }}
                              placeholder="Scan book barcode (Enter to confirm)…"
                              disabled={scanning[stop.id]}
                              style={{ ...inp, width: '280px' }}
                              autoFocus
                            />
                            <Btn variant="secondary" disabled={scanning[stop.id]} onClick={() => handleScan(stop)}>{scanning[stop.id] ? 'Checking…' : 'Confirm'}</Btn>
                            {scanError[stop.id] && <span style={{ ...font, fontSize: '12px', color: '#dc2626' }}>{scanError[stop.id]}</span>}
                          </div>
                        )}

                        {stop.children.map(child => (
                          <div key={child.childId} style={{ marginBottom: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                              <p style={{ ...secHead, margin: 0 }}>{child.name}{child.lastName ? ` ${child.lastName}` : ''} · envelope {child.envelopeCode}</p>
                              <button onClick={() => openLabelWindow(buildLabelHtml(labelsFor([{ ...stop, children: [child] }], route)))}
                                style={{ ...font, background: 'none', border: '1px solid #d4d4d4', borderRadius: '5px', cursor: 'pointer', fontSize: '11px', fontWeight: 600, color: '#4a4a4a', padding: '3px 10px' }}>Print Label</button>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              {child.books.map(book => {
                                const s = scans[book.itemId]
                                return (
                                  <div key={book.itemId} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', borderRadius: '6px', backgroundColor: s || packed ? '#f0fdf4' : '#fafafa', border: `1px solid ${s || packed ? '#86efac' : '#e5e5e5'}` }}>
                                    {book.coverUrl
                                      ? <img src={book.coverUrl} alt={book.title} style={{ width: '30px', height: '41px', objectFit: 'cover', borderRadius: '3px', flexShrink: 0 }} />
                                      : <div style={{ width: '30px', height: '41px', backgroundColor: '#e5e5e5', borderRadius: '3px', flexShrink: 0 }} />}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <p style={{ ...font, margin: 0, fontSize: '13px', fontWeight: 600, color: '#1a1a1a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{book.title}</p>
                                      {book.author && <p style={{ ...font, margin: '2px 0 0', fontSize: '12px', color: '#9b9b9b' }}>{book.author}</p>}
                                    </div>
                                    {book.shelfLocation
                                      ? <span style={{ ...font, fontSize: '12px', fontWeight: 700, color: '#1a1a1a', backgroundColor: '#f4f4f5', padding: '3px 8px', borderRadius: '4px', flexShrink: 0, fontFamily: 'monospace' }}>{book.shelfLocation}</span>
                                      : <span style={{ ...font, fontSize: '11px', color: '#c4c4c4', flexShrink: 0 }}>no shelf</span>}
                                    {s ? <span style={{ ...font, fontSize: '11px', fontWeight: 600, color: '#16a34a', fontFamily: 'monospace', flexShrink: 0 }}>✓ {s.internalId}</span>
                                      : packed ? <span style={{ ...font, fontSize: '11px', color: '#16a34a', flexShrink: 0 }}>packed</span>
                                      : <span style={{ ...font, fontSize: '11px', color: '#9b9b9b', flexShrink: 0 }}>awaiting scan</span>}
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        ))}

                        <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid #f0f0f0', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '12px' }}>
                          {packed ? (
                            <Btn variant="secondary" disabled={marking[stop.id]} onClick={() => setPacked(stop, false)}>{marking[stop.id] ? 'Saving…' : 'Undo packed'}</Btn>
                          ) : (
                            <>
                              {!allScanned(stop) && <span style={{ ...font, fontSize: '12px', color: '#9b9b9b' }}>{total - scanned} book{total - scanned !== 1 ? 's' : ''} still to scan</span>}
                              <Btn variant={allScanned(stop) ? 'success' : 'secondary'} disabled={!allScanned(stop) || marking[stop.id]} onClick={() => setPacked(stop, true)}>{marking[stop.id] ? 'Saving…' : 'Mark Packed'}</Btn>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
