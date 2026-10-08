'use client'

import { useCallback, useEffect, useState } from 'react'

// Capacity — "how is Bonkers doing operationally, and am I comfortable opening more places?"
// Only the caps + pauses are enforced (at signup). Everything else is information.

type Zone = { id: string; code: string; name: string; bonkers_day: string | null; membership_cap: number | null; is_paused: boolean; active: number }
type Stage = { id: string; name: string; ages: string; children: number; availableBooks: number; usableBooks: number }
type Count = { label: string; count: number }
type Data = {
  memberships: { active: number; cap: number | null; paused: boolean }
  zones: Zone[]
  books: { usable: number; borrowed: number; available: number }
  stages: Stage[]
  unknownAge: number
  waitlist: { total: number; byZone: Count[]; byArea: Count[]; byReason: Count[] }
  booksPerChildWarning: number
}

const REASON_LABELS: Record<string, string> = {
  ZONE_NOT_OPEN: 'Zone not open / outside zones',
  ZONE_CAP_REACHED: 'Zone cap reached',
  GLOBAL_CAP_REACHED: 'Global cap reached',
  ZONE_PAUSED: 'Zone paused',
  GLOBAL_PAUSED: 'All memberships paused',
  CHECK_FAILED: 'Check failed (technical)',
  Unknown: 'No reason recorded (older entries)',
}

const card: React.CSSProperties = { border: '1px solid #e5e5e5', borderRadius: '10px', padding: '18px 20px', backgroundColor: '#fff' }
const h2: React.CSSProperties = { margin: '0 0 12px', fontSize: '11px', fontWeight: 700, color: '#9b9b9b', textTransform: 'uppercase', letterSpacing: '0.08em' }
const smallBtn: React.CSSProperties = { padding: '5px 10px', fontSize: '12px', borderRadius: '6px', border: '1px solid #d4d4d4', backgroundColor: '#fff', color: '#1a1a1a', cursor: 'pointer' }
const badge = (bg: string, color: string): React.CSSProperties => ({ fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '999px', backgroundColor: bg, color, letterSpacing: '0.04em' })

function CapEditor({ cap, onSave, label = 'Edit cap' }: { cap: number | null; onSave: (v: string) => Promise<void>; label?: string }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)
  if (!editing) return <button style={smallBtn} onClick={() => { setValue(cap == null ? '' : String(cap)); setEditing(true) }}>{label}</button>
  return (
    <span style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
      <input autoFocus type="number" min={0} value={value} placeholder="No limit" onChange={e => setValue(e.target.value)}
        style={{ width: '80px', padding: '4px 8px', fontSize: '12px', border: '1px solid #d4d4d4', borderRadius: '6px' }} />
      <button style={{ ...smallBtn, backgroundColor: '#1a1a1a', color: '#fff', borderColor: '#1a1a1a' }} disabled={saving}
        onClick={async () => { setSaving(true); await onSave(value); setSaving(false); setEditing(false) }}>{saving ? 'Saving…' : 'Save'}</button>
      <button style={smallBtn} onClick={() => setEditing(false)}>Cancel</button>
    </span>
  )
}

function CountList({ items, labels }: { items: Count[]; labels?: Record<string, string> }) {
  if (!items.length) return <p style={{ margin: 0, fontSize: '12px', color: '#9b9b9b' }}>Nobody yet</p>
  return (
    <div>
      {items.map(i => (
        <div key={i.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '4px 0', borderBottom: '1px solid #f3f3f3' }}>
          <span style={{ color: '#4a4a4a' }}>{labels?.[i.label] ?? i.label}</span>
          <span style={{ fontWeight: 600, color: '#1a1a1a' }}>{i.count} {i.count === 1 ? 'family' : 'families'}</span>
        </div>
      ))}
    </div>
  )
}

export default function CapacityPage() {
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/capacity', { cache: 'no-store' })
    const json = await res.json()
    if (!res.ok) return setError(json.error ?? 'Could not load capacity')
    setError('')
    setData(json)
  }, [])

  useEffect(() => { load() }, [load])

  const save = async (body: object) => {
    const res = await fetch('/api/admin/capacity', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (!res.ok) setError((await res.json()).error ?? 'Could not save')
    await load()
  }

  if (!data) return <div style={{ padding: '32px', fontSize: '13px', color: error ? '#c0392b' : '#9b9b9b' }}>{error || 'Loading…'}</div>

  const { memberships: m, zones, books, stages, waitlist } = data
  const remaining = m.cap == null ? null : Math.max(0, m.cap - m.active)

  // Warnings only — nothing here closes memberships
  const warnings: string[] = []
  if (m.paused) warnings.push('All new memberships are paused — every new applicant goes to the waitlist.')
  if (remaining === 0) warnings.push('Global membership cap reached — new applicants go to the waitlist.')
  else if (remaining != null && remaining <= 5) warnings.push(`Only ${remaining} global membership place${remaining === 1 ? '' : 's'} remain.`)
  for (const z of zones) {
    if (!z.bonkers_day) warnings.push(`${z.name} has no Bonkers Day, so it isn't accepting members.`)
    else if (z.membership_cap != null && z.active >= z.membership_cap) warnings.push(`${z.name} (${z.bonkers_day}) is full.`)
    else if (z.membership_cap != null && z.membership_cap > 0 && z.active / z.membership_cap >= 0.9) warnings.push(`${z.name} (${z.bonkers_day}) is at ${Math.round(z.active / z.membership_cap * 100)}% of its cap.`)
  }
  for (const s of stages) {
    if (s.children > 0 && s.availableBooks / s.children < data.booksPerChildWarning)
      warnings.push(`${s.name} stock is getting low: ${s.availableBooks} available books for ${s.children} children (under ${data.booksPerChildWarning} per child).`)
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      <div style={{ padding: '28px 32px 60px', maxWidth: '980px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '6px' }}>
          <h1 style={{ fontSize: '15px', fontWeight: 700, color: '#1a1a1a', margin: 0 }}>Capacity</h1>
          <button style={smallBtn} onClick={load}>Refresh</button>
        </div>
        <p style={{ margin: '0 0 20px', fontSize: '12px', color: '#9b9b9b' }}>
          Only caps and pauses are enforced at signup. An empty cap or 0 means no limit — use Pause to stop signups. Book and reading-stage figures are information only.
        </p>

        {error && <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#c0392b' }}>{error}</p>}

        {warnings.length > 0 && (
          <div style={{ ...card, backgroundColor: '#fff8e6', borderColor: '#f3d98b', marginBottom: '16px' }}>
            {warnings.map(w => <p key={w} style={{ margin: '3px 0', fontSize: '13px', color: '#7a5a00' }}>⚠ {w}</p>)}
          </div>
        )}

        {/* MEMBERSHIPS */}
        <div style={{ ...card, marginBottom: '16px' }}>
          <h2 style={h2}>Memberships</h2>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <p style={{ margin: 0, fontSize: '28px', fontWeight: 700, color: '#1a1a1a' }}>
                {m.active} <span style={{ fontSize: '16px', color: '#9b9b9b', fontWeight: 500 }}>/ {m.cap ?? 'no limit'} active</span>
              </p>
              <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#4a4a4a' }}>
                {remaining == null ? 'Unlimited places' : `${remaining} place${remaining === 1 ? '' : 's'} remaining`}
                {m.paused && <span style={{ ...badge('#fdecea', '#c0392b'), marginLeft: '8px' }}>PAUSED</span>}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <CapEditor cap={m.cap} onSave={v => save({ type: 'global', cap: v })} />
              <button style={{ ...smallBtn, ...(m.paused ? { backgroundColor: '#1a1a1a', color: '#fff', borderColor: '#1a1a1a' } : {}) }}
                onClick={() => {
                  if (!m.paused && !confirm('Pause ALL new memberships? Existing members and deliveries are not affected.')) return
                  save({ type: 'global', paused: !m.paused })
                }}>
                {m.paused ? 'Reopen memberships' : 'Pause new memberships'}
              </button>
            </div>
          </div>
        </div>

        {/* BONKERS DAYS */}
        <div style={{ ...card, marginBottom: '16px' }}>
          <h2 style={h2}>Bonkers Days</h2>
          {zones.length === 0 && <p style={{ margin: 0, fontSize: '13px', color: '#9b9b9b' }}>No zones saved yet — draw them in Zones.</p>}
          {zones.map(z => {
            const full = z.membership_cap != null && z.active >= z.membership_cap
            return (
              <div key={z.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', padding: '10px 0', borderBottom: '1px solid #f3f3f3' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: '260px' }}>
                  <span style={{ fontSize: '13px', color: '#1a1a1a', fontWeight: 600, width: '90px' }}>{z.bonkers_day ?? 'No day'}</span>
                  <span style={{ fontSize: '13px', color: '#4a4a4a' }}>{z.code} · {z.name}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#1a1a1a', minWidth: '90px', textAlign: 'right' }}>
                    {z.active} / {z.membership_cap ?? '∞'}
                  </span>
                  <span style={{ width: '62px' }}>
                    {!z.bonkers_day ? <span style={badge('#f0f0f0', '#6b6b6b')}>NOT OPEN</span>
                      : z.is_paused ? <span style={badge('#fdecea', '#c0392b')}>PAUSED</span>
                      : full ? <span style={badge('#fdecea', '#c0392b')}>FULL</span> : null}
                  </span>
                  <CapEditor cap={z.membership_cap} onSave={v => save({ type: 'zone', id: z.id, cap: v })} />
                  <button style={{ ...smallBtn, width: '70px', ...(z.is_paused ? { backgroundColor: '#1a1a1a', color: '#fff', borderColor: '#1a1a1a' } : {}) }}
                    onClick={() => save({ type: 'zone', id: z.id, paused: !z.is_paused })}>
                    {z.is_paused ? 'Reopen' : 'Pause'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px', marginBottom: '16px' }}>
          {/* BOOKS */}
          <div style={card}>
            <h2 style={h2}>Books</h2>
            {[['Total usable', books.usable], ['Borrowed / out', books.borrowed], ['Available', books.available]].map(([label, n]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '6px 0', borderBottom: '1px solid #f3f3f3' }}>
                <span style={{ color: '#4a4a4a' }}>{label}</span><span style={{ fontWeight: 700, color: '#1a1a1a' }}>{n}</span>
              </div>
            ))}
            <p style={{ margin: '10px 0 0', fontSize: '11px', color: '#9b9b9b' }}>
              Planning guide (assumption, not enforced): ~100 books per 10 families → about {Math.floor(books.usable / 10)} families.
            </p>
          </div>

          {/* READING STAGES */}
          <div style={card}>
            <h2 style={h2}>Reading stages</h2>
            {stages.map(s => {
              const perChild = s.children ? s.availableBooks / s.children : null
              const low = perChild != null && perChild < data.booksPerChildWarning
              return (
                <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', padding: '6px 0', borderBottom: '1px solid #f3f3f3' }}>
                  <span style={{ color: '#1a1a1a', fontWeight: 600 }}>{s.name} <span style={{ fontWeight: 400, color: '#9b9b9b' }}>{s.ages}</span></span>
                  <span style={{ color: low ? '#c0392b' : '#4a4a4a' }}>
                    {s.children} {s.children === 1 ? 'child' : 'children'} / <b>{s.availableBooks}</b> available
                    {perChild != null && <span style={{ color: low ? '#c0392b' : '#9b9b9b' }}> · {perChild.toFixed(1)} per child</span>}
                  </span>
                </div>
              )
            })}
            {data.unknownAge > 0 && <p style={{ margin: '8px 0 0', fontSize: '11px', color: '#9b9b9b' }}>{data.unknownAge} child{data.unknownAge === 1 ? '' : 'ren'} with no date of birth (not counted).</p>}
            <p style={{ margin: '10px 0 0', fontSize: '11px', color: '#9b9b9b', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              Stage from date of birth: under 5 Hatchling, 5–7 Chick, 8+ Bird. Books in two stages count in both. Warn below {data.booksPerChildWarning} per child
              <CapEditor cap={data.booksPerChildWarning} label="Change" onSave={v => save({ type: 'global', booksPerChildWarning: v })} />
            </p>
          </div>
        </div>

        {/* WAITLIST */}
        <div style={card}>
          <h2 style={h2}>Waitlist</h2>
          <p style={{ margin: '0 0 14px', fontSize: '22px', fontWeight: 700, color: '#1a1a1a' }}>
            {waitlist.total} <span style={{ fontSize: '14px', color: '#9b9b9b', fontWeight: 500 }}>household{waitlist.total === 1 ? '' : 's'} waiting</span>
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
            <div><p style={{ ...h2, marginBottom: '6px' }}>By area</p><CountList items={waitlist.byArea} /></div>
            <div><p style={{ ...h2, marginBottom: '6px' }}>By zone</p><CountList items={waitlist.byZone} /></div>
            <div><p style={{ ...h2, marginBottom: '6px' }}>By reason</p><CountList items={waitlist.byReason} labels={REASON_LABELS} /></div>
          </div>
        </div>
      </div>
    </div>
  )
}
