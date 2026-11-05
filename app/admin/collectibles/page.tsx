'use client'
// Collectibles in bulk: generate for many books at once (a few at a time, in this browser tab), then scroll through
// everything waiting and approve, redo, tweak, polish or reject each one. Nothing is ever approved automatically,
// and lore is still reviewed and published on each book's page in Admin → Books.

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Book = {
  id: string
  title: string
  author: string
  cover_image_url: string | null
  collectible_status: string | null
  collectible_name: string | null
  collectible_concept: string | null
  collectible_lore: string | null
  collectible_source_moment: string | null
  collectible_image_url: string | null
  collectible_kind: string | null
}

const FIELDS = 'id, title, author, cover_image_url, collectible_status, collectible_name, collectible_concept, collectible_lore, collectible_source_moment, collectible_image_url, collectible_kind'
const AT_ONCE = 3

const navy = '#1a2f51'
const btn: React.CSSProperties = { padding: '7px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', border: '1px solid #d4d4d4', backgroundColor: '#fff', color: navy }
const primary: React.CSSProperties = { ...btn, backgroundColor: navy, color: '#fff', border: 'none' }
const green: React.CSSProperties = { ...btn, backgroundColor: '#16a34a', color: '#fff', border: 'none' }

const needsOne = (b: Book) => !b.collectible_status || b.collectible_status === 'options'

export default function CollectiblesPage() {
  const [books, setBooks] = useState<Book[]>([])
  const [loading, setLoading] = useState(true)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [working, setWorking] = useState<Set<string>>(new Set())   // books being drawn right now
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [batch, setBatch] = useState<{ total: number; done: number } | null>(null)
  const [showPick, setShowPick] = useState(false)
  const [tweakFor, setTweakFor] = useState<string | null>(null)
  const [tweakNote, setTweakNote] = useState('')
  const stopRef = useRef(false)

  useEffect(() => {
    supabase.from('books').select(FIELDS).order('title').then(({ data }) => {
      const list = (data || []) as Book[]
      setBooks(list)
      setPicked(new Set(list.filter(b => needsOne(b) && b.cover_image_url).map(b => b.id)))
      setLoading(false)
    })
  }, [])

  // warn before closing the tab while collectibles are still being drawn
  useEffect(() => {
    if (!working.size) return
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [working.size])

  const mark = (id: string, on: boolean) => setWorking(prev => { const n = new Set(prev); if (on) n.add(id); else n.delete(id); return n })
  const refresh = async (id: string) => {
    const { data } = await supabase.from('books').select(FIELDS).eq('id', id).single()
    if (data) setBooks(prev => prev.map(b => b.id === id ? data as Book : b))
  }

  async function step(book: Book, which: 'generate' | 'draw' | 'polish', extra: Record<string, unknown> = {}) {
    mark(book.id, true)
    setErrors(prev => { const n = { ...prev }; delete n[book.id]; return n })
    try {
      const res = await fetch('/api/admin/generate-collectible', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookId: book.id, step: which, ...extra }),
      })
      const json = await res.json().catch(() => ({ error: 'The server took too long — try again.' }))
      if (!res.ok) setErrors(prev => ({ ...prev, [book.id]: json.error || 'Something went wrong' }))
    } catch {
      setErrors(prev => ({ ...prev, [book.id]: 'Connection lost — try again.' }))
    } finally {
      await refresh(book.id)
      mark(book.id, false)
    }
  }

  async function generateAll() {
    const queue = books.filter(b => picked.has(b.id) && needsOne(b) && !working.has(b.id))
    if (!queue.length) return
    stopRef.current = false
    setShowPick(false)
    setBatch({ total: queue.length, done: 0 })
    let next = 0
    const worker = async () => {
      while (!stopRef.current && next < queue.length) {
        const book = queue[next++]
        await step(book, 'generate')
        setBatch(prev => prev && { ...prev, done: prev.done + 1 })
      }
    }
    await Promise.all(Array.from({ length: Math.min(AT_ONCE, queue.length) }, worker))
    setBatch(null)
  }

  async function decide(book: Book, action: 'approve' | 'reject') {
    const res = await fetch('/api/admin/generate-collectible', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bookId: book.id, action }) })
    if (res.ok) await refresh(book.id)
    else setErrors(prev => ({ ...prev, [book.id]: 'Could not save — try again.' }))
  }

  async function setKind(book: Book, kind: 'creature' | 'thing') {
    await fetch('/api/admin/books', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: book.id, collectible_kind: kind }) })
    setBooks(prev => prev.map(b => b.id === book.id ? { ...b, collectible_kind: kind } : b))
  }

  function sendTweak(book: Book) {
    const note = tweakNote.trim()
    if (!note) return
    setTweakFor(null); setTweakNote('')
    step(book, 'draw', { idea: { collectible_name: book.collectible_name, concept: book.collectible_concept, lore: book.collectible_lore || '', source_moment: book.collectible_source_moment || '' }, direction: note })
  }

  if (loading) return <div style={{ padding: '40px', fontFamily: 'var(--font-montserrat)', color: '#6b6b6b' }}>Loading…</div>

  const withoutOne = books.filter(needsOne)
  const noCover = withoutOne.filter(b => !b.cover_image_url)
  const canGenerate = withoutOne.filter(b => b.cover_image_url)
  const pickedCount = canGenerate.filter(b => picked.has(b.id)).length
  const review = books.filter(b => b.collectible_status === 'awaiting_approval' || working.has(b.id) || errors[b.id])
  const approvedCount = books.filter(b => b.collectible_status === 'approved').length

  return (
    <div style={{ padding: '28px 32px', fontFamily: 'var(--font-montserrat)', color: '#1a1a1a', maxWidth: '1200px' }}>
      <h1 style={{ fontSize: '22px', fontWeight: 700, margin: '0 0 4px', color: navy }}>Collectibles</h1>
      <p style={{ fontSize: '13px', color: '#6b6b6b', margin: '0 0 20px' }}>
        {approvedCount} approved · {books.filter(b => b.collectible_status === 'awaiting_approval').length} waiting for you · {withoutOne.length} without one yet
      </p>

      {/* ── Generate in bulk ── */}
      <div style={{ backgroundColor: '#f7f7f7', borderRadius: '12px', padding: '16px 18px', marginBottom: '28px' }}>
        {batch ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <p style={{ margin: '0 0 6px', fontSize: '13px', fontWeight: 600 }}>
                {stopRef.current ? 'Stopping after the ones already drawing…' : `Generating… ${batch.done} of ${batch.total} done`}
              </p>
              <div style={{ height: '8px', borderRadius: '4px', backgroundColor: '#e5e5e5', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(batch.done / batch.total) * 100}%`, backgroundColor: '#16a34a', transition: 'width 0.4s' }} />
              </div>
              <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#6b6b6b' }}>Keep this page open. Finished ones appear below as they arrive, ready to review.</p>
            </div>
            <button style={btn} onClick={() => { stopRef.current = true; setBatch(b => b && { ...b }) }}>Stop</button>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <button style={{ ...primary, padding: '10px 16px', fontSize: '13px', opacity: pickedCount ? 1 : 0.5 }} disabled={!pickedCount} onClick={generateAll}>
                Generate for {pickedCount === canGenerate.length ? 'all books without one' : 'the ticked books'} ({pickedCount})
              </button>
              {canGenerate.length > 0 && <button style={{ ...btn, border: 'none', background: 'none', textDecoration: 'underline' }} onClick={() => setShowPick(s => !s)}>{showPick ? 'Hide the list' : 'Choose which books'}</button>}
            </div>
            <p style={{ margin: '8px 0 0', fontSize: '11px', color: '#6b6b6b' }}>
              {AT_ONCE} at a time, about a minute each.{noCover.length ? ` ${noCover.length} book${noCover.length === 1 ? '' : 's'} without a cover ${noCover.length === 1 ? 'is' : 'are'} left out (add a cover first).` : ''}
            </p>
            {showPick && (
              <div style={{ marginTop: '12px', maxHeight: '320px', overflowY: 'auto', backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e5e5e5', padding: '8px 12px' }}>
                <div style={{ display: 'flex', gap: '12px', fontSize: '12px', marginBottom: '6px' }}>
                  <button style={{ ...btn, padding: '4px 8px' }} onClick={() => setPicked(new Set(canGenerate.map(b => b.id)))}>Tick all</button>
                  <button style={{ ...btn, padding: '4px 8px' }} onClick={() => setPicked(new Set())}>Untick all</button>
                </div>
                {canGenerate.map(b => (
                  <label key={b.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0', fontSize: '13px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={picked.has(b.id)} onChange={e => setPicked(prev => { const n = new Set(prev); if (e.target.checked) n.add(b.id); else n.delete(b.id); return n })} />
                    <img src={b.cover_image_url!} alt="" style={{ width: '20px', height: '30px', objectFit: 'cover', borderRadius: '2px' }} />
                    <span>{b.title}</span><span style={{ color: '#9b9b9b' }}>· {b.author}</span>
                  </label>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Review ── */}
      <h2 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 12px', color: navy }}>Waiting for your approval</h2>
      {review.length === 0 && <p style={{ fontSize: '13px', color: '#6b6b6b' }}>Nothing to review right now.</p>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
        {review.map(book => {
          const busy = working.has(book.id)
          const ready = book.collectible_status === 'awaiting_approval' && book.collectible_image_url
          return (
            <div key={book.id} style={{ border: '1px solid #e5e5e5', borderRadius: '12px', overflow: 'hidden', backgroundColor: '#fff', display: 'flex', flexDirection: 'column' }}>
              <div style={{ position: 'relative', aspectRatio: '1', backgroundColor: navy, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {ready && <img src={book.collectible_image_url!} alt={book.collectible_name || ''} style={{ width: '88%', height: '88%', objectFit: 'contain', opacity: busy ? 0.35 : 1 }} />}
                {busy && <span style={{ position: 'absolute', color: '#fff', fontSize: '13px', fontWeight: 600 }}>Drawing…</span>}
                {!busy && !ready && <span style={{ color: '#fff', fontSize: '12px', opacity: 0.7 }}>No collectible yet</span>}
                {book.cover_image_url && <img src={book.cover_image_url} alt="" style={{ position: 'absolute', left: '10px', top: '10px', width: '40px', height: '60px', objectFit: 'cover', borderRadius: '3px', boxShadow: '0 2px 8px rgba(0,0,0,0.4)' }} />}
              </div>
              <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                <div>
                  <p style={{ margin: 0, fontSize: '14px', fontWeight: 700 }}>{ready ? book.collectible_name : '—'}</p>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#6b6b6b' }}>{book.title}</p>
                </div>
                {errors[book.id] && <p style={{ margin: 0, fontSize: '12px', color: '#dc2626' }}>⚠ {errors[book.id]}</p>}
                {ready && (
                  <div style={{ display: 'flex', gap: '4px', fontSize: '12px' }}>
                    {(['creature', 'thing'] as const).map(k => {
                      const on = (book.collectible_kind || 'thing') === k
                      return <button key={k} disabled={busy} onClick={() => setKind(book, k)} style={{ ...btn, padding: '4px 8px', backgroundColor: on ? navy : '#fff', color: on ? '#fff' : navy }}>{k === 'creature' ? '🥚 Egg' : '🎁 Parcel'}</button>
                    })}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: 'auto' }}>
                  {ready && <button style={green} disabled={busy} onClick={() => decide(book, 'approve')}>✓ Approve</button>}
                  <button style={btn} disabled={busy} onClick={() => step(book, 'generate')}>↻ Another idea</button>
                  {ready && <button style={btn} disabled={busy} onClick={() => { setTweakFor(tweakFor === book.id ? null : book.id); setTweakNote('') }}>Tweak</button>}
                  {ready && <button style={btn} disabled={busy} onClick={() => step(book, 'polish')}>✨ Polish</button>}
                  {ready && <button style={{ ...btn, color: '#dc2626' }} disabled={busy} onClick={() => decide(book, 'reject')}>Reject</button>}
                </div>
                {tweakFor === book.id && (
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input autoFocus value={tweakNote} onChange={e => setTweakNote(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') sendTweak(book) }}
                      placeholder="e.g. make it rounder, no hat" style={{ flex: 1, fontSize: '12px', padding: '6px 8px', border: '1px solid #d4d4d4', borderRadius: '6px' }} />
                    <button style={primary} disabled={!tweakNote.trim()} onClick={() => sendTweak(book)}>Send</button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
