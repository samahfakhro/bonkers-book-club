'use client'

import { useCallback, useEffect, useState } from 'react'

// Members → family page: each child's Coming next books, which admin can add to or remove from until packed.

type Book = { itemId: string; bookId: string; title: string; cover: string | null; packed: boolean }
type Child = { childId: string; name: string; requestId: string | null; status: string | null; packed: boolean; books: Book[] }
type Data = { children: Child[]; plan: number; staying: number; chosen: number; slotsLeft: number }
type Found = { id: string; title: string; author: string | null; cover_image_url: string | null; free: number }

const font: React.CSSProperties = { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', color: '#1a1a1a' }
const small: React.CSSProperties = { ...font, fontSize: '12px', color: '#6b6b6b' }
const btn: React.CSSProperties = { ...font, padding: '5px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600, backgroundColor: '#f0f0f0' }
const Cover = ({ src }: { src: string | null }) => src
  ? <img src={src} alt="" style={{ width: '28px', height: '38px', objectFit: 'cover', borderRadius: '3px', flexShrink: 0 }} />
  : <span style={{ width: '28px', height: '38px', borderRadius: '3px', background: '#eee', flexShrink: 0, display: 'inline-block' }} />

export default function ComingNextEditor({ householdId }: { householdId: string }) {
  const [data, setData] = useState<Data | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [addingFor, setAddingFor] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [found, setFound] = useState<Found[]>([])
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const r = await fetch(`/api/admin/swaps?householdId=${householdId}`, { cache: 'no-store' })
    const b = await r.json(); if (r.ok) setData(b); else setMsg({ ok: false, text: b.error || 'Could not load' })
  }, [householdId])
  useEffect(() => { load(); setAddingFor(null); setMsg(null) }, [load])

  useEffect(() => {
    if (!addingFor || q.trim().length < 2) { setFound([]); return }
    const t = setTimeout(async () => {
      const r = await fetch(`/api/admin/swaps?householdId=${householdId}&q=${encodeURIComponent(q)}`)
      const b = await r.json(); setFound(b.books || [])
    }, 300)
    return () => clearTimeout(t)
  }, [q, addingFor, householdId])

  const post = async (body: object, ok: string) => {
    setBusy(true)
    const r = await fetch('/api/admin/swaps', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ householdId, ...body }) })
    const b = await r.json().catch(() => ({}))
    setBusy(false)
    setMsg(r.ok ? { ok: true, text: ok } : { ok: false, text: b.error || 'Not saved' })
    if (r.ok) await load()
    return r.ok
  }

  const add = async (child: Child, book: Found) => {
    if (data && data.slotsLeft <= 0 && !confirm(`This family has no free book slots (${data.staying} staying home + ${data.chosen} chosen on a ${data.plan}-book plan). Add anyway?`)) return
    if (await post({ action: 'add', childId: child.childId, bookId: book.id }, `✓ Added ${book.title} for ${child.name} — family notified`)) { setQ(''); setFound([]); setAddingFor(null) }
  }

  if (!data) return <p style={small}>Loading…</p>
  return (
    <div>
      <p style={{ ...small, margin: '0 0 10px' }}>
        {data.plan}-book plan · {data.staying} staying home · {data.chosen} chosen · <strong style={{ color: data.slotsLeft ? '#16a34a' : '#dc2626' }}>{data.slotsLeft} slot{data.slotsLeft === 1 ? '' : 's'} left</strong>
      </p>
      {msg && <p style={{ ...font, fontSize: '12px', fontWeight: 600, color: msg.ok ? '#16a34a' : '#dc2626', margin: '0 0 10px' }}>{msg.text}</p>}
      {data.children.map(c => (
        <div key={c.childId} style={{ border: '1px solid #eee', borderRadius: '8px', padding: '10px 12px', marginBottom: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ ...font, fontSize: '13px', fontWeight: 700 }}>{c.name} <span style={{ ...small, fontWeight: 400 }}>{c.status ? `· ${c.status.replace(/_/g, ' ')}` : '· nothing chosen yet'}{c.packed ? ' · PACKED' : ''}</span></span>
            {!c.packed && <button style={btn} onClick={() => { setAddingFor(addingFor === c.childId ? null : c.childId); setQ(''); setFound([]) }}>{addingFor === c.childId ? 'Cancel' : '+ Add a book'}</button>}
          </div>
          {c.books.length === 0 && <p style={small}>No books chosen.</p>}
          {c.books.map(b => (
            <div key={b.itemId} style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'space-between', padding: '3px 0' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', ...font, fontSize: '13px' }}><Cover src={b.cover} />{b.title}{b.packed && <span style={small}>· packed</span>}</span>
              {!b.packed && !c.packed && <button style={btn} disabled={busy} onClick={() => { if (confirm(`Remove ${b.title} from ${c.name}'s books? The family will be told.`)) post({ action: 'remove', itemId: b.itemId }, `✓ Removed ${b.title} — family notified`) }}>Remove</button>}
            </div>
          ))}
          {addingFor === c.childId && (
            <div style={{ marginTop: '8px' }}>
              <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search the library by title"
                style={{ ...font, width: '100%', boxSizing: 'border-box', padding: '7px 10px', borderRadius: '6px', border: '1px solid #d4d4d4', fontSize: '13px' }} />
              {found.map(b => (
                <div key={b.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '4px 0' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px', ...font, fontSize: '13px' }}><Cover src={b.cover_image_url} />{b.title}<span style={small}>{b.free > 0 ? `· ${b.free} free` : '· none free'}</span></span>
                  <button style={{ ...btn, opacity: b.free > 0 ? 1 : 0.4 }} disabled={busy || b.free <= 0} onClick={() => add(c, b)}>Add</button>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
