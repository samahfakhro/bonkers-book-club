'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

// Returns: scan returned books in (checked in as Good on scan — change the condition after if needed),
// and unpack undelivered envelopes back onto the shelves (still held for the family in their Coming Next list).

type Condition = 'good' | 'worn' | 'damaged_ok' | 'withdrawn'
const CONDITIONS: { value: Condition; label: string }[] = [
  { value: 'good', label: 'Good' }, { value: 'worn', label: 'Worn but fine' },
  { value: 'damaged_ok', label: 'Damaged – still lendable' }, { value: 'withdrawn', label: 'Damaged – withdrawn' },
]
type Due = { loanId: string; family: string; child: string; title: string; internalId: string; collectedOn: string | null }
type Undelivered = { itemId: string; family: string; child: string; title: string; internalId: string }
type CheckedIn = { inspectionId: string; title: string; internalId: string; family: string; condition: Condition; at: string }
type Data = { due: Due[]; undelivered: Undelivered[]; checkedIn: CheckedIn[] }

const font: React.CSSProperties = { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }
const inp: React.CSSProperties = { ...font, padding: '8px 10px', borderRadius: '6px', backgroundColor: '#fff', border: '1px solid #d4d4d4', color: '#1a1a1a', fontSize: '14px', outline: 'none' }
const secHead: React.CSSProperties = { ...font, fontSize: '11px', fontWeight: 700, color: '#9b9b9b', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '24px 0 8px' }
const card: React.CSSProperties = { border: '1px solid #e5e5e5', borderRadius: '8px', padding: '10px 12px', marginBottom: '6px', backgroundColor: '#fff', color: '#1a1a1a' }

function Btn({ variant = 'primary', disabled, onClick, children }: { variant?: 'primary' | 'secondary'; disabled?: boolean; onClick?: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} disabled={disabled} style={{ ...font, padding: '8px 14px', borderRadius: '6px', border: 'none', cursor: disabled ? 'default' : 'pointer', fontSize: '13px', fontWeight: 600, backgroundColor: variant === 'primary' ? '#1a1a1a' : '#f0f0f0', color: variant === 'primary' ? '#fff' : '#1a1a1a', opacity: disabled ? 0.5 : 1 }}>{children}</button>
}

function groupBy<T extends { family: string }>(rows: T[]) {
  const m = new Map<string, T[]>()
  rows.forEach(r => m.set(r.family, [...(m.get(r.family) || []), r]))
  return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]))
}

export default function ReturnsPage() {
  const router = useRouter()
  const [tab, setTab] = useState<'returned' | 'undelivered'>('returned')
  const [data, setData] = useState<Data | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/returns', { cache: 'no-store' })
    const b = await res.json()
    if (res.ok) setData(b); else setFeedback({ ok: false, text: b.error || 'Could not load' })
  }, [])
  useEffect(() => { load() }, [load])
  useEffect(() => { setFeedback(null); setTimeout(() => inputRef.current?.focus(), 50) }, [tab])

  const post = async (body: object) => {
    const res = await fetch('/api/admin/returns', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    return { ok: res.ok, body: await res.json().catch(() => ({})) }
  }

  const scan = async () => {
    const c = code.trim()
    if (!c || busy) return
    setBusy(true); setCode('')
    const { ok, body } = await post({ action: tab === 'returned' ? 'checkin' : 'undelivered', code: c })
    setBusy(false)
    if (!ok) setFeedback({ ok: false, text: body.error || 'Scan failed' })
    else if (tab === 'returned') setFeedback({ ok: true, text: `✓ ${body.title} (${body.internalId}) checked in as Good${body.warning ? ` — ${body.warning}` : ''}` })
    else setFeedback({ ok: true, text: `✓ ${body.title} → back on the shelf (held for ${body.family})` })
    await load()
    inputRef.current?.focus()
  }

  return (
    <div style={{ padding: '24px 32px', overflowY: 'auto', height: '100%', maxWidth: '900px' }}>
      <button onClick={() => router.push('/admin/operations')} style={{ ...font, background: 'none', border: 'none', padding: 0, color: '#9b9b9b', fontSize: '12px', cursor: 'pointer' }}>← Operations</button>
      <h1 style={{ ...font, fontSize: '15px', fontWeight: 700, color: '#1a1a1a', margin: '8px 0 16px' }}>Returns</h1>

      <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
        {([['returned', `Returned books${data ? ` (${data.due.length} due)` : ''}`], ['undelivered', `Undelivered envelopes${data ? ` (${data.undelivered.length})` : ''}`]] as const).map(([v, l]) => (
          <button key={v} onClick={() => setTab(v)} style={{ ...font, padding: '8px 14px', borderRadius: '999px', border: '1px solid #d4d4d4', cursor: 'pointer', fontSize: '13px', fontWeight: 600, backgroundColor: tab === v ? '#1a1a1a' : '#fff', color: tab === v ? '#fff' : '#1a1a1a' }}>{l}</button>
        ))}
      </div>

      <p style={{ ...font, fontSize: '13px', color: '#4a4a4a', margin: '0 0 8px' }}>
        {tab === 'returned'
          ? 'Scan each book. It’s checked in as Good straight away — change the condition below if it isn’t.'
          : 'Scan each book from an undelivered envelope, then put it back on the normal shelf. It stays held for the family in their Coming Next list.'}
      </p>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <input ref={inputRef} autoFocus value={code} onChange={e => setCode(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') scan() }}
          placeholder="Scan or type the book’s barcode" style={{ ...inp, width: '300px' }} disabled={busy} />
        <Btn onClick={scan} disabled={busy || !code.trim()}>{busy ? 'Checking…' : 'Enter'}</Btn>
      </div>
      {feedback && <p style={{ ...font, margin: '10px 0 0', padding: '10px 12px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, backgroundColor: feedback.ok ? '#e8f5ec' : '#fdecea', color: feedback.ok ? '#16673a' : '#b3261e' }}>{feedback.text}</p>}

      {!data ? <p style={{ ...font, color: '#9b9b9b', marginTop: '20px' }}>Loading…</p> : tab === 'returned' ? (
        <>
          <p style={secHead}>Checked in (last 36 hours)</p>
          {data.checkedIn.length === 0 && <p style={{ ...font, fontSize: '13px', color: '#9b9b9b' }}>Nothing yet.</p>}
          {data.checkedIn.map(r => (
            <div key={r.inspectionId} style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}>
                <span style={{ ...font, fontSize: '13px' }}><strong style={{ color: '#1a1a1a' }}>{r.title}</strong> <span style={{ color: '#9b9b9b' }}>{r.internalId} · {r.family}</span></span>
                <span style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
                  <span style={{ ...font, fontSize: '12px', fontWeight: 600, color: r.condition === 'good' ? '#16a34a' : r.condition === 'withdrawn' ? '#dc2626' : '#b45309' }}>{CONDITIONS.find(c => c.value === r.condition)?.label}</span>
                  <Btn variant="secondary" onClick={() => setEditing(editing === r.inspectionId ? null : r.inspectionId)}>Change</Btn>
                </span>
              </div>
              {editing === r.inspectionId && <ConditionEditor row={r} post={post} onDone={async () => { setEditing(null); await load() }} />}
            </div>
          ))}

          <p style={secHead}>Still to come back — collected by the driver</p>
          {data.due.length === 0 && <p style={{ ...font, fontSize: '13px', color: '#9b9b9b' }}>All collected books are checked in.</p>}
          {groupBy(data.due).map(([family, rows]) => (
            <div key={family} style={card}>
              <p style={{ ...font, fontSize: '13px', fontWeight: 700, margin: '0 0 4px', color: '#1a1a1a' }}>{family}</p>
              {rows.map(r => <p key={r.loanId} style={{ ...font, fontSize: '13px', margin: '2px 0', color: '#4a4a4a' }}>{r.title} <span style={{ color: '#9b9b9b' }}>{r.internalId} · {r.child}{r.collectedOn ? ` · collected ${r.collectedOn}` : ''}</span></p>)}
            </div>
          ))}
        </>
      ) : (
        <>
          <p style={secHead}>To unpack</p>
          {data.undelivered.length === 0 && <p style={{ ...font, fontSize: '13px', color: '#9b9b9b' }}>No undelivered envelopes.</p>}
          {groupBy(data.undelivered).map(([family, rows]) => (
            <div key={family} style={card}>
              <p style={{ ...font, fontSize: '13px', fontWeight: 700, margin: '0 0 4px', color: '#1a1a1a' }}>{family}</p>
              {rows.map(r => <p key={r.itemId} style={{ ...font, fontSize: '13px', margin: '2px 0', color: '#4a4a4a' }}>{r.title} <span style={{ color: '#9b9b9b' }}>{r.internalId} · {r.child}</span></p>)}
            </div>
          ))}

        </>
      )}
    </div>
  )
}

function ConditionEditor({ row, post, onDone }: { row: CheckedIn; post: (b: object) => Promise<{ ok: boolean; body: any }>; onDone: () => void }) {
  const [condition, setCondition] = useState<Condition>(row.condition)
  const [note, setNote] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const damaged = condition === 'damaged_ok' || condition === 'withdrawn'

  const save = async () => {
    setSaving(true); setError(null)
    let photoPath: string | null = null
    if (photo) {
      const form = new FormData(); form.append('inspectionId', row.inspectionId); form.append('photo', photo)
      const res = await fetch('/api/admin/returns', { method: 'POST', body: form })
      const b = await res.json().catch(() => ({}))
      if (!res.ok) { setError(b.error || 'Photo upload failed'); setSaving(false); return }
      photoPath = b.path
    }
    const { ok, body } = await post({ action: 'condition', inspectionId: row.inspectionId, condition, note, photoPath })
    setSaving(false)
    if (!ok) { setError(body.error || 'Not saved'); return }
    onDone()
  }

  return (
    <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #f0f0f0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {CONDITIONS.map(c => (
          <button key={c.value} onClick={() => setCondition(c.value)} style={{ ...font, padding: '6px 12px', borderRadius: '999px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', border: '1px solid #d4d4d4', backgroundColor: condition === c.value ? '#1a1a1a' : '#fff', color: condition === c.value ? '#fff' : '#1a1a1a' }}>{c.label}</button>
        ))}
      </div>
      {damaged && (
        <>
          <input value={note} onChange={e => setNote(e.target.value)} placeholder="What’s wrong? e.g. torn cover, water damage" style={inp} />
          <label style={{ ...font, fontSize: '13px' }}>Photo {condition === 'withdrawn' ? '(required)' : '(optional)'}: <input type="file" accept="image/*" capture="environment" onChange={e => setPhoto(e.target.files?.[0] || null)} /></label>
        </>
      )}
      {error && <p style={{ ...font, fontSize: '12px', color: '#dc2626', margin: 0 }}>{error}</p>}
      <div><Btn onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Btn></div>
    </div>
  )
}
