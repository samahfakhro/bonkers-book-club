'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import EnvelopeScanner from '@/components/driver/EnvelopeScanner'
import { navy, yellow, Big, Card, Choice, Screen } from '../../ui'

// Route View (stops in order) + Stop Detail (?stop=…): verify the family, scan every child's envelope,
// record what happened, move on to the next stop. One stop at a time; no customer-service decisions.

type Household = {
  first_name: string | null; last_name: string | null; villa_flat: string | null; building: string | null; street: string | null
  sub_community: string | null; area: string | null; property_type: string | null; mobile_phone: string | null; whatsapp_number: string | null
  delivery_preference: string | null; safe_spot_description: string | null; delivery_container_type: string | null
  delivery_container_location_notes: string | null; neighbour_permission_enabled: boolean | null; neighbour_details: string | null
}
type Child = { childId: string; number: number; envelopeCode: string; name: string; lastName: string; bookCount: number }
type Stop = {
  id: string; ref: string; box: string; visit_ref: string; stop_order: number; status: string; outcome: string | null; outcomeLabel: string | null; outcome_notes: string | null
  latitude: number | null; longitude: number | null; delivery_notes: string | null; familyCode: string; collectCount: number
  households: Household | null; children: Child[]; allowed: string[]
}
type DriverRoute = { id: string; route_date: string; status: string; zones: { code: string; name: string } | null; stops: Stop[] }

const PREFERENCE: Record<string, string> = {
  leave_at_door: 'Leave at the door (contactless)', leave_safe_spot: 'Leave in their safe spot', ring_bell: 'Ring the bell — someone is home',
  call_no_bell: 'Call them — don’t ring the bell', leave_with_reception: 'Leave with reception / concierge',
}
const FAILED = new Set(['delivery_failed', 'collection_failed', 'no_access', 'no_answer', 'partial_issue'])
const familyName = (h: Household | null) => [h?.first_name, h?.last_name].filter(Boolean).join(' ') || 'Family'
const address = (h: Household | null) => !h ? '' : [
  h.villa_flat && `${h.property_type === 'apartment' ? 'Flat' : 'Villa'} ${h.villa_flat}`,
  h.property_type === 'apartment' && h.building, h.street && `Street ${h.street}`, h.sub_community, h.area,
].filter(Boolean).join(', ')
const phoneDigits = (p: string | null) => (p || '').replace(/[^\d+]/g, '')
const waNumber = (p: string | null) => { const d = (p || '').replace(/\D/g, ''); return d.startsWith('0') ? `971${d.slice(1)}` : d }

export default function DriverRoutePage() {
  return <Suspense fallback={null}><DriverRoute /></Suspense>
}

function DriverRoute() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const params = useSearchParams()
  const stopId = params.get('stop')
  const [route, setRoute] = useState<DriverRoute | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/driver/routes/${id}`)
      const body = await res.json()
      if (!res.ok) { setError(body.error || 'Could not load this route'); return }
      setError(null)
      setRoute(body)
    } catch { setError('No connection — check your signal and try again.') }
  }, [id])
  useEffect(() => { load() }, [load])

  const openStop = (sid: string | null) => router.push(sid ? `/driver/route/${id}?stop=${sid}` : `/driver/route/${id}`)

  if (error && !route) return <Screen><Card style={{ background: '#fdecea', color: '#b3261e', fontWeight: 600 }}>{error}</Card><Big onClick={load}>Try again</Big></Screen>
  if (!route) return <Screen><p style={{ color: navy, opacity: 0.6 }}>Loading route…</p></Screen>

  const stop = stopId ? route.stops.find(s => s.id === stopId) : null
  if (stop) return <StopDetail key={stop.id} route={route} stop={stop} onBack={() => openStop(null)} onDone={async next => { await load(); openStop(next) }} />

  // ── Route View ──
  const done = route.stops.filter(s => s.status === 'done' || s.status === 'cancelled').length
  const next = route.stops.find(s => s.status !== 'done' && s.status !== 'cancelled')
  return (
    <Screen>
      <button onClick={() => router.push('/driver')} style={{ background: 'none', border: 'none', padding: 0, color: navy, fontSize: '15px', fontWeight: 600, marginBottom: '10px' }}>← Today’s routes</button>
      <h1 style={{ margin: '0 0 4px', fontSize: '26px', color: navy }}>{route.zones?.code} {route.zones?.name}</h1>
      <p style={{ margin: '0 0 12px', color: navy, opacity: 0.8, fontSize: '16px' }}>{done} of {route.stops.length} stops done</p>
      <div style={{ height: '10px', background: '#ece4d6', borderRadius: '999px', overflow: 'hidden', marginBottom: '18px' }}>
        <div style={{ height: '100%', width: `${route.stops.length ? (done / route.stops.length) * 100 : 0}%`, background: next ? navy : '#2e7d32' }} />
      </div>

      {next ? (
        <Card style={{ border: `3px solid ${navy}`, padding: '18px' }}>
          <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, letterSpacing: '0.1em', color: navy, opacity: 0.7 }}>NEXT STOP</p>
          <p style={{ margin: '4px 0 2px', fontSize: '34px', fontWeight: 900, color: navy }}>{next.ref}</p>
          <p style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: navy }}>{familyName(next.households)}</p>
          <p style={{ margin: '2px 0 14px', fontSize: '15px', color: navy, opacity: 0.8 }}>{address(next.households)}</p>
          <Big onClick={() => openStop(next.id)}>Go to {next.ref}</Big>
        </Card>
      ) : (
        <Card style={{ background: '#eef8f1', border: '2px solid #2e7d32' }}>
          <p style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#2e7d32' }}>Route finished 🎉</p>
          <p style={{ margin: '6px 0 0', color: navy }}>Head back to the warehouse with the collected books.</p>
        </Card>
      )}

      {[...new Set(route.stops.map(s => s.box))].map(box => (
        <div key={box}>
          <p style={{ margin: '18px 0 8px', fontSize: '13px', fontWeight: 800, letterSpacing: '0.1em', color: navy, opacity: 0.7 }}>BOX {route.zones?.code}-{box}</p>
          {route.stops.filter(s => s.box === box).map(s => {
            const isDone = s.status === 'done'
            const bad = isDone && s.outcome && FAILED.has(s.outcome)
            return (
              <button key={s.id} onClick={() => openStop(s.id)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px', textAlign: 'left', background: '#fff', border: `1px solid ${s.id === next?.id ? navy : '#ece4d6'}`, borderRadius: '14px', padding: '12px 14px', marginBottom: '8px', opacity: isDone ? 0.75 : 1 }}>
                <span style={{ fontSize: '18px', fontWeight: 900, color: navy, width: '72px', flexShrink: 0 }}>{s.ref}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontWeight: 700, color: navy, fontSize: '15px' }}>{familyName(s.households)}</span>
                  <span style={{ display: 'block', fontSize: '13px', color: navy, opacity: 0.7, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{address(s.households)}</span>
                </span>
                <span style={{ fontSize: '12px', fontWeight: 800, padding: '5px 9px', borderRadius: '999px', flexShrink: 0, background: !isDone ? '#f1ece2' : bad ? '#fdecea' : '#eef8f1', color: !isDone ? navy : bad ? '#b3261e' : '#2e7d32' }}>
                  {isDone ? (bad ? '⚠ ' : '✓ ') + (s.outcomeLabel || 'Done') : s.children.length && s.collectCount ? 'Deliver + collect' : s.children.length ? 'Deliver' : 'Collect'}
                </span>
              </button>
            )
          })}
        </div>
      ))}
    </Screen>
  )
}

// ── Stop Detail ─────────────────────────────────────────────────────────────

function StopDetail({ route, stop, onBack, onDone }: { route: DriverRoute; stop: Stop; onBack: () => void; onDone: (nextStopId: string | null) => Promise<void> }) {
  const h = stop.households
  const hasDelivery = stop.children.length > 0
  const hasCollection = stop.collectCount > 0
  const isDone = stop.status === 'done'
  const index = route.stops.findIndex(s => s.id === stop.id)

  const [scanned, setScanned] = useState<Set<string>>(new Set())
  const [scanning, setScanning] = useState(false)
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null)
  const [delivery, setDelivery] = useState<string | null>(null)
  const [failReason, setFailReason] = useState<string | null>(null)
  const [neighbour, setNeighbour] = useState('')
  const [photoPath, setPhotoPath] = useState<string | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [collection, setCollection] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const allScanned = stop.children.every(c => scanned.has(c.envelopeCode))
  const deliveredOk = delivery && delivery !== 'failed'

  const handleCode = (raw: string) => {
    const code = raw.trim().toUpperCase()
    const child = stop.children.find(c => c.envelopeCode === code)
    if (child) {
      setScanned(prev => new Set(prev).add(code))
      setFeedback({ ok: true, text: `✓ ${child.name}’s envelope` })
    } else if (code.startsWith(stop.familyCode)) {
      setFeedback({ ok: false, text: '✗ This family’s code, but not an envelope on today’s list' })
    } else {
      setFeedback({ ok: false, text: '✗ WRONG FAMILY — this envelope isn’t for this house' })
      if (navigator.vibrate) navigator.vibrate([100, 60, 100])
    }
  }

  const uploadPhoto = async (file: File) => {
    setUploading(true); setError(null)
    setPhotoPreview(URL.createObjectURL(file))
    const form = new FormData()
    form.append('stopId', stop.id); form.append('photo', file)
    try {
      const res = await fetch('/api/driver/photo', { method: 'POST', body: form })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error)
      setPhotoPath(body.path)
    } catch (e: any) { setError(e.message || 'Photo didn’t upload — try again'); setPhotoPreview(null) }
    setUploading(false)
  }

  const missing = useMemo(() => {
    if (hasDelivery && !delivery) return 'Choose what happened with the delivery'
    if (delivery === 'failed' && !failReason) return 'Choose why the delivery wasn’t possible'
    if (deliveredOk && !allScanned) return 'Scan every envelope first'
    if (delivery === 'neighbour' && !neighbour.trim()) return 'Add the neighbour’s name and villa/flat'
    if (delivery === 'safe_drop' && !photoPath) return 'Take a photo of where you left the books'
    if (hasCollection && !collection) return 'Choose what happened with the collection'
    return null
  }, [hasDelivery, hasCollection, delivery, failReason, deliveredOk, allScanned, neighbour, photoPath, collection])

  const complete = async () => {
    if (missing) return
    setSaving(true); setError(null)
    const report = {
      delivery: hasDelivery ? { result: delivery, failReason: failReason || undefined, neighbour: neighbour || undefined, photoPath: photoPath || undefined, scannedCodes: [...scanned] } : undefined,
      collection: hasCollection ? { result: collection } : undefined,
      notes: notes || undefined,
    }
    try {
      const res = await fetch(`/api/driver/stops/${stop.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(report) })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error)
      const nextStop = route.stops.slice(index + 1).find(s => s.status !== 'done' && s.status !== 'cancelled') || route.stops.find(s => s.id !== stop.id && s.status !== 'done' && s.status !== 'cancelled')
      await onDone(nextStop?.id ?? null)
    } catch (e: any) { setError(e.message || 'Not saved — check your signal and try again') }
    setSaving(false)
  }

  const section = (title: string) => <p style={{ margin: '20px 0 8px', fontSize: '13px', fontWeight: 800, letterSpacing: '0.1em', color: navy, opacity: 0.7 }}>{title}</p>

  return (
    <Screen>
      <button onClick={onBack} style={{ background: 'none', border: 'none', padding: 0, color: navy, fontSize: '15px', fontWeight: 600, marginBottom: '10px' }}>← All stops</button>

      {/* who and where */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <p style={{ margin: 0, fontSize: '44px', fontWeight: 900, color: navy, lineHeight: 1 }}>{stop.ref}</p>
        <p style={{ margin: 0, fontSize: '14px', color: navy, opacity: 0.7 }}>Stop {index + 1} of {route.stops.length} · Box {route.zones?.code}-{stop.box}</p>
      </div>
      <p style={{ margin: '8px 0 2px', fontSize: '22px', fontWeight: 800, color: navy }}>{familyName(h)}</p>
      <p style={{ margin: '0 0 4px', fontSize: '17px', color: navy }}>{address(h)}</p>
      <p style={{ margin: '0 0 14px', fontSize: '13px', color: navy, opacity: 0.6 }}>{stop.visit_ref} · family {stop.familyCode}</p>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '8px', marginBottom: '8px' }}>
        <Big onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${stop.latitude},${stop.longitude}&travelmode=driving`, '_blank')} disabled={stop.latitude == null}>🧭 Navigate</Big>
        <Big tone="light" onClick={() => { window.location.href = `tel:${phoneDigits(h?.mobile_phone ?? null)}` }} disabled={!h?.mobile_phone}>📞 Call</Big>
        <Big tone="light" onClick={() => window.open(`https://wa.me/${waNumber(h?.whatsapp_number || h?.mobile_phone || null)}`, '_blank')} disabled={!h?.whatsapp_number && !h?.mobile_phone}>💬</Big>
      </div>

      {/* instructions */}
      <Card style={{ background: '#fffbea', border: `1px solid ${yellow}` }}>
        <p style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: navy }}>{PREFERENCE[h?.delivery_preference || ''] || 'No delivery preference given'}</p>
        {h?.delivery_preference === 'leave_safe_spot' && h.safe_spot_description && <p style={{ margin: '6px 0 0', fontSize: '15px', color: navy }}>Safe spot: <strong>{h.safe_spot_description}</strong></p>}
        {h?.delivery_container_type && <p style={{ margin: '6px 0 0', fontSize: '15px', color: navy }}>Their {h.delivery_container_type}{h.delivery_container_location_notes ? `: ${h.delivery_container_location_notes}` : ''}</p>}
        {stop.delivery_notes && <p style={{ margin: '6px 0 0', fontSize: '15px', color: navy }}>Notes: <strong>{stop.delivery_notes}</strong></p>}
        {h?.neighbour_permission_enabled && h.neighbour_details && <p style={{ margin: '6px 0 0', fontSize: '15px', color: navy }}>Neighbour allowed: {h.neighbour_details}</p>}
      </Card>

      {isDone ? (
        <Card style={{ background: '#eef8f1', border: '2px solid #2e7d32' }}>
          <p style={{ margin: 0, fontSize: '19px', fontWeight: 800, color: '#2e7d32' }}>✓ {stop.outcomeLabel}</p>
          {stop.outcome_notes && <p style={{ margin: '6px 0 0', color: navy }}>{stop.outcome_notes}</p>}
        </Card>
      ) : (
        <>
          {/* 1. delivery */}
          {hasDelivery && (
            <>
              {section(`DELIVER — ${stop.children.length} ENVELOPE${stop.children.length === 1 ? '' : 'S'}`)}
              <Card>
                {stop.children.map(c => (
                  <p key={c.childId} style={{ margin: '0 0 8px', fontSize: '17px', color: navy, display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                    <span><strong>{c.name} {c.lastName}</strong> <span style={{ opacity: 0.6, fontSize: '14px' }}>· {c.bookCount} book{c.bookCount === 1 ? '' : 's'}</span></span>
                    <span style={{ fontWeight: 800, color: scanned.has(c.envelopeCode) ? '#2e7d32' : '#b3261e' }}>{scanned.has(c.envelopeCode) ? '✓ scanned' : 'not scanned'}</span>
                  </p>
                ))}
                <Big onClick={() => { setFeedback(null); setScanning(true) }} tone={allScanned ? 'light' : 'navy'}>{allScanned ? '✓ All envelopes scanned' : '📷 Scan envelopes'}</Big>
              </Card>

              <p style={{ margin: '14px 0 8px', fontSize: '16px', fontWeight: 700, color: navy }}>What happened?</p>
              {stop.allowed.includes('handed_over') && <Choice selected={delivery === 'handed_over'} onClick={() => setDelivery('handed_over')}>Delivered</Choice>}
              {stop.allowed.includes('concierge') && <Choice selected={delivery === 'concierge'} onClick={() => setDelivery('concierge')}>Left with concierge</Choice>}
              {stop.allowed.includes('neighbour') && <Choice selected={delivery === 'neighbour'} onClick={() => setDelivery('neighbour')}>Left with neighbour</Choice>}
              {stop.allowed.includes('safe_drop') && <Choice selected={delivery === 'safe_drop'} onClick={() => setDelivery('safe_drop')}>Safe drop (photo needed)</Choice>}
              <Choice selected={delivery === 'failed'} onClick={() => setDelivery('failed')}>Couldn’t deliver</Choice>

              {delivery === 'neighbour' && (
                <input value={neighbour} onChange={e => setNeighbour(e.target.value)} placeholder="Neighbour’s name + villa/flat"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '16px', fontSize: '17px', borderRadius: '12px', border: '2px solid #ddd6cc', marginBottom: '8px' }} />
              )}
              {delivery === 'safe_drop' && (
                <Card>
                  {photoPreview && <img src={photoPreview} alt="Safe drop" style={{ width: '100%', borderRadius: '10px', marginBottom: '8px' }} />}
                  <label style={{ display: 'block' }}>
                    <span style={{ display: 'block', textAlign: 'center', padding: '16px', borderRadius: '14px', background: navy, color: '#fff', fontSize: '17px', fontWeight: 800 }}>
                      {uploading ? 'Uploading…' : photoPath ? '✓ Photo saved — retake' : '📸 Take photo'}
                    </span>
                    <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadPhoto(f) }} />
                  </label>
                </Card>
              )}
              {delivery === 'failed' && (
                <>
                  <p style={{ margin: '6px 0 8px', fontSize: '15px', color: navy }}>Why? (Books are never left unattended without the family’s permission.)</p>
                  <Choice selected={failReason === 'no_answer'} onClick={() => setFailReason('no_answer')}>No answer at the door</Choice>
                  <Choice selected={failReason === 'no_access'} onClick={() => setFailReason('no_access')}>No access to the property</Choice>
                  <Choice selected={failReason === 'other'} onClick={() => setFailReason('other')}>Other problem</Choice>
                </>
              )}
            </>
          )}

          {/* 2. collection */}
          {hasCollection && (
            <>
              {section(`COLLECT — ${stop.collectCount} BOOK${stop.collectCount === 1 ? '' : 'S'} FROM THEIR ${(h?.delivery_container_type || 'tote').toUpperCase()}`)}
              <Choice selected={collection === 'collected'} onClick={() => setCollection('collected')}>Collected — into the return bin</Choice>
              <Choice selected={collection === 'partial'} onClick={() => setCollection('partial')}>Only some books were there</Choice>
              <Choice selected={collection === 'not_collected'} onClick={() => setCollection('not_collected')}>Couldn’t collect</Choice>
            </>
          )}

          {section('ANYTHING TO ADD? (OPTIONAL)')}
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="e.g. tote was wet, dog in the garden…"
            style={{ width: '100%', boxSizing: 'border-box', padding: '14px', fontSize: '16px', borderRadius: '12px', border: '2px solid #ddd6cc', fontFamily: 'inherit' }} />

          {error && <Card style={{ background: '#fdecea', color: '#b3261e', fontWeight: 700, marginTop: '12px' }}>{error}</Card>}
          <div style={{ position: 'sticky', bottom: '12px', marginTop: '18px' }}>
            {missing && <p style={{ margin: '0 0 8px', textAlign: 'center', color: navy, fontWeight: 600, background: '#fff', borderRadius: '10px', padding: '8px' }}>{missing}</p>}
            <Big tone={delivery === 'failed' ? 'red' : 'green'} disabled={!!missing || saving} onClick={complete}>
              {saving ? 'Saving…' : `Complete ${stop.ref}`}
            </Big>
          </div>
        </>
      )}

      {scanning && <EnvelopeScanner onCode={handleCode} onClose={() => setScanning(false)} feedback={feedback} />}
    </Screen>
  )
}
