'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { REQUEST_STATUSES, STATUS_LABEL, type RequestStatus } from '@/lib/book-requests'

// Book Requests — books and series families have asked for, grouped and counted so you can see what's most wanted.
type Group = {
  key: string; title: string; authors: string[]; families: number; status: RequestStatus; book: { id: string; title: string } | null; latest: string
  requests: { id: string; created_at: string; note: string | null; family: string; reader: string | null }[]
}
const FILTERS: { key: RequestStatus | 'open'; label: string }[] = [{ key: 'open', label: 'Open' }, { key: 'added', label: 'Added' }, { key: 'not_adding', label: 'Not adding' }]
const STATUS_STYLE: Record<RequestStatus, [string, string]> = { new: ['#fff8e6', '#7a5a00'], ordered: ['#e8f0fe', '#1a56b0'], added: ['#e6f6ec', '#1e7a3c'], not_adding: ['#f0f0f0', '#1a1a1a'] }
const btn = (primary = false): React.CSSProperties => ({ padding: '7px 14px', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', border: primary ? 'none' : '1px solid #ccc', background: primary ? '#1a1a1a' : '#fff', color: primary ? '#fff' : '#1a1a1a' })
const when = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

export default function BookRequestsPage() {
  const [groups, setGroups] = useState<Group[]>([])
  const [filter, setFilter] = useState<RequestStatus | 'open'>('open')
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null)
  const [openKey, setOpenKey] = useState<string | null>(null)
  const [linking, setLinking] = useState<string | null>(null)        // group being marked "Added"
  const [search, setSearch] = useState('')
  const [matches, setMatches] = useState<{ id: string; title: string; author: string | null }[]>([])

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/book-requests')
    const body = await res.json()
    if (res.ok) setGroups(body.groups); else setMsg({ text: body.error || 'Could not load requests', bad: true })
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  // find the library book when marking a request "Added"
  useEffect(() => {
    if (!linking || search.trim().length < 2) { setMatches([]); return }
    const t = setTimeout(async () => {
      const { data } = await supabase.from('books').select('id, title, author').ilike('title', `%${search.trim()}%`).limit(8)
      setMatches(data || [])
    }, 250)
    return () => clearTimeout(t)
  }, [search, linking])

  async function setStatus(key: string, status: RequestStatus, bookId?: string) {
    setMsg(null)
    const res = await fetch('/api/admin/book-requests', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key, status, bookId }) })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) { setMsg({ text: body.error || 'Could not save', bad: true }); return }
    setMsg({ text: status === 'added' ? `Marked as added${body.notified ? ` — ${body.notified} ${body.notified === 1 ? 'family has' : 'families have'} been told` : ''}.` : `Marked as ${STATUS_LABEL[status].toLowerCase()}.` })
    setLinking(null); setSearch(''); setMatches([])
    load()
  }

  const shown = groups.filter(g => filter === 'open' ? (g.status === 'new' || g.status === 'ordered') : g.status === filter)
  const openCount = groups.filter(g => g.status === 'new' || g.status === 'ordered').length

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px', backgroundColor: '#fafafa', color: '#1a1a1a' }}>
      <h1 style={{ margin: '0 0 4px', fontSize: '22px', fontWeight: 700, color: '#1a1a1a' }}>Book Requests</h1>
      <p style={{ margin: '0 0 18px', fontSize: '14px', color: '#1a1a1a', maxWidth: '660px', lineHeight: 1.5 }}>
        Books and series families have asked for. Requests for the same title are grouped, most wanted first. When you mark one <strong>Added</strong> and pick the library book, everyone who asked is told.
      </p>

      <div style={{ display: 'flex', gap: '6px', marginBottom: '18px' }}>
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)} style={{ ...btn(filter === f.key), borderRadius: '999px' }}>
            {f.label}{f.key === 'open' && openCount ? ` (${openCount})` : ''}
          </button>
        ))}
      </div>

      {msg && <p style={{ margin: '0 0 16px', padding: '10px 14px', borderRadius: '8px', fontSize: '14px', backgroundColor: msg.bad ? '#fdecea' : '#e6f6ec', color: msg.bad ? '#b3261e' : '#1e7a3c' }}>{msg.text}</p>}

      {loading ? <p style={{ fontSize: '14px' }}>Loading…</p> : shown.length === 0 ? (
        <p style={{ fontSize: '14px' }}>{filter === 'open' ? 'No open requests.' : 'Nothing here yet.'}</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '820px' }}>
          {shown.map(g => {
            const [bg, fg] = STATUS_STYLE[g.status]
            return (
              <div key={g.key} style={{ border: '1px solid #e5e5e5', borderRadius: '10px', backgroundColor: '#fff', padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '220px' }}>
                    <p style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>{g.title}</p>
                    <p style={{ margin: '2px 0 0', fontSize: '13px' }}>
                      {g.authors.length ? `${g.authors.join(', ')} · ` : ''}<strong>{g.families} {g.families === 1 ? 'family' : 'families'}</strong> · latest {when(g.latest)}
                      {g.book && <> · in library as <em>{g.book.title}</em></>}
                    </p>
                  </div>
                  <span style={{ padding: '3px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 700, backgroundColor: bg, color: fg }}>{STATUS_LABEL[g.status]}</span>
                  <select value={g.status} onChange={e => { const s = e.target.value as RequestStatus; if (s === 'added') { setLinking(g.key); setSearch(g.title) } else setStatus(g.key, s) }}
                    style={{ padding: '6px 8px', border: '1px solid #ccc', borderRadius: '6px', fontSize: '13px', color: '#1a1a1a', backgroundColor: '#fff' }}>
                    {REQUEST_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                  </select>
                  <button style={btn()} onClick={() => setOpenKey(k => k === g.key ? null : g.key)}>{openKey === g.key ? 'Hide' : 'Who asked'}</button>
                </div>

                {linking === g.key && (
                  <div style={{ marginTop: '12px', padding: '12px', borderRadius: '8px', backgroundColor: '#f7f7f7' }}>
                    <p style={{ margin: '0 0 8px', fontSize: '13px', fontWeight: 600 }}>Which library book is it? (add the book in Books first)</p>
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search the library…" autoFocus
                      style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid #ccc', borderRadius: '6px', fontSize: '14px', color: '#1a1a1a', backgroundColor: '#fff' }} />
                    <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {matches.map(b => (
                        <button key={b.id} onClick={() => setStatus(g.key, 'added', b.id)}
                          style={{ textAlign: 'left', padding: '8px 10px', border: '1px solid #e5e5e5', borderRadius: '6px', background: '#fff', cursor: 'pointer', fontSize: '14px', color: '#1a1a1a' }}>
                          <strong>{b.title}</strong>{b.author ? ` — ${b.author}` : ''}
                        </button>
                      ))}
                      {search.trim().length >= 2 && matches.length === 0 && <p style={{ margin: 0, fontSize: '13px' }}>No matching book in the library yet.</p>}
                    </div>
                    <button style={{ ...btn(), marginTop: '8px' }} onClick={() => { setLinking(null); setSearch(''); setMatches([]) }}>Cancel</button>
                  </div>
                )}

                {openKey === g.key && (
                  <div style={{ marginTop: '12px', borderTop: '1px solid #eee', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {g.requests.map(r => (
                      <div key={r.id} style={{ fontSize: '13px' }}>
                        <strong>{r.family}</strong>{r.reader ? ` (for ${r.reader})` : ''} · {when(r.created_at)}
                        {r.note && <p style={{ margin: '2px 0 0', fontSize: '14px' }}>“{r.note}”</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
