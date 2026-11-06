'use client'
// Temporary: re-scan every book's real barcode. Scan a copy's CUR sticker (finds the book), then the book's barcode:
// that exact barcode is saved for the book (and becomes its main ISBN). Books are "done" once they have a scanned
// barcode. Before 6 Nov 2026 the lookup could save another edition's ISBN, which is what this fixes.

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { normaliseCopyLabel } from '@/lib/copy-codes'
import EnvelopeScanner from '@/components/driver/EnvelopeScanner'

type Book = { id: string; title: string; author: string; cover_image_url: string | null; isbn: string | null }
type Copy = { book_id: string; internal_id: string }

const navy = '#1a2f51'
const inp: React.CSSProperties = { flex: 1, padding: '12px 14px', fontSize: '16px', border: '2px solid #d4d4d4', borderRadius: '10px', outline: 'none', fontFamily: 'inherit' }
const btn: React.CSSProperties = { padding: '10px 14px', borderRadius: '10px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', border: '1px solid #d4d4d4', backgroundColor: '#fff', color: navy }
const cleanIsbn = (v: string) => (v || '').replace(/[^0-9X]/gi, '').toUpperCase()

export default function RescanPage() {
  const [books, setBooks] = useState<Book[]>([])
  const [copies, setCopies] = useState<Copy[]>([])
  const [scanned, setScanned] = useState<Record<string, string[]>>({})   // book id → barcodes saved
  const [loading, setLoading] = useState(true)
  const [current, setCurrent] = useState<Book | null>(null)
  const [label, setLabel] = useState('')
  const [barcode, setBarcode] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [camera, setCamera] = useState<'label' | 'barcode' | null>(null)
  const [showDone, setShowDone] = useState(false)
  const labelRef = useRef<HTMLInputElement>(null)
  const barcodeRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    Promise.all([
      supabase.from('books').select('id, title, author, cover_image_url, isbn').order('title'),
      supabase.from('book_copies').select('book_id, internal_id'),
      fetch('/api/admin/book-isbns?list=1').then(r => r.json()).catch(() => ({ rows: [] })),
    ]).then(([b, c, s]) => {
      setBooks((b.data || []) as Book[])
      setCopies((c.data || []) as Copy[])
      const map: Record<string, string[]> = {}
      for (const r of (s.rows || []) as { book_id: string; isbn: string }[]) (map[r.book_id] ||= []).push(r.isbn)
      setScanned(map)
      setLoading(false)
      setTimeout(() => labelRef.current?.focus(), 100)
    })
  }, [])

  function pickBook(book: Book) {
    setCurrent(book); setLabel(''); setBarcode(''); setMsg(null)
    setTimeout(() => barcodeRef.current?.focus(), 50)
  }

  function findByLabel(raw: string) {
    const code = normaliseCopyLabel(raw)
    if (!code) { setMsg({ ok: false, text: `"${raw}" isn't a CUR sticker. Scan the CUR-0000 label.` }); setLabel(''); return }
    const copy = copies.find(c => c.internal_id === code)
    const book = copy && books.find(b => b.id === copy.book_id)
    if (!book) { setMsg({ ok: false, text: `${code} isn't linked to any book.` }); setLabel(''); return }
    pickBook(book)
  }

  async function saveBarcode(raw: string) {
    if (!current) return
    const isbn = cleanIsbn(raw)
    if (isbn.length < 10) { setMsg({ ok: false, text: `"${raw}" isn't a book barcode. Scan the barcode on the back of the book (starts with 978 or 979).` }); setBarcode(''); return }
    if (normaliseCopyLabel(raw)) { setMsg({ ok: false, text: 'That was a CUR sticker. Now scan the book’s own barcode.' }); setBarcode(''); return }
    setSaving(true)
    const res = await fetch('/api/admin/book-isbns', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bookId: current.id, isbn, setMain: true }) })
    const j = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) {
      setMsg({ ok: false, text: j.otherBook ? `⚠ That barcode is already saved for “${j.otherBook.title}”. Check you have the right book in hand.` : `⚠ ${j.error || 'Could not save'}` })
      setBarcode(''); return
    }
    setScanned(prev => ({ ...prev, [current.id]: [...new Set([...(prev[current.id] || []), isbn])] }))
    setBooks(prev => prev.map(b => b.id === current.id ? { ...b, isbn } : b))
    setMsg({ ok: true, text: `✓ ${current.title}: barcode ${isbn} saved.` })
    setCurrent(null); setBarcode('')
    setTimeout(() => labelRef.current?.focus(), 50)
  }

  if (loading) return <div style={{ padding: '40px', fontFamily: 'var(--font-montserrat)', color: '#6b6b6b' }}>Loading…</div>

  const todo = books.filter(b => !scanned[b.id]?.length)
  const done = books.filter(b => scanned[b.id]?.length)

  return (
    <div style={{ padding: '28px 32px', fontFamily: 'var(--font-montserrat)', color: '#1a1a1a', maxWidth: '760px' }}>
      <Link href="/admin/books" style={{ fontSize: '12px', color: '#6b6b6b', textDecoration: 'none' }}>← Books</Link>
      <h1 style={{ fontSize: '22px', fontWeight: 700, margin: '6px 0 4px', color: navy }}>Re-scan barcodes</h1>
      <p style={{ fontSize: '13px', color: '#6b6b6b', margin: '0 0 16px' }}>
        {done.length} of {books.length} done. For each book: scan its CUR sticker, then the barcode on the back.
      </p>
      <div style={{ height: '8px', borderRadius: '4px', backgroundColor: '#e5e5e5', overflow: 'hidden', marginBottom: '22px' }}>
        <div style={{ height: '100%', width: `${books.length ? (done.length / books.length) * 100 : 0}%`, backgroundColor: '#16a34a' }} />
      </div>

      {msg && <div style={{ marginBottom: '14px', padding: '10px 14px', borderRadius: '10px', fontSize: '14px', fontWeight: 600, backgroundColor: msg.ok ? '#f0fdf4' : '#fef2f2', color: msg.ok ? '#166534' : '#b91c1c', border: `1px solid ${msg.ok ? '#bbf7d0' : '#fecaca'}` }}>{msg.text}</div>}

      {/* Step 1: sticker */}
      {!current && (
        <div style={{ backgroundColor: '#f7f7f7', borderRadius: '12px', padding: '16px' }}>
          <label style={{ fontSize: '12px', fontWeight: 700, color: navy, textTransform: 'uppercase', letterSpacing: '0.05em' }}>1. Scan the CUR sticker</label>
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <input ref={labelRef} style={inp} placeholder="CUR-0042" value={label} onChange={e => setLabel(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && label.trim()) findByLabel(label) }} />
            <button style={btn} onClick={() => setCamera('label')}>📷 Scan</button>
          </div>
        </div>
      )}

      {/* Step 2: barcode */}
      {current && (
        <div style={{ backgroundColor: '#f7f7f7', borderRadius: '12px', padding: '16px', display: 'flex', gap: '16px' }}>
          <div style={{ width: '110px', height: '165px', flexShrink: 0, borderRadius: '6px', overflow: 'hidden', backgroundColor: '#e5e5e5' }}>
            {current.cover_image_url && <img src={current.cover_image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: '17px', fontWeight: 700 }}>{current.title}</p>
            <p style={{ margin: '2px 0 12px', fontSize: '13px', color: '#6b6b6b' }}>{current.author}</p>
            <label style={{ fontSize: '12px', fontWeight: 700, color: navy, textTransform: 'uppercase', letterSpacing: '0.05em' }}>2. Scan the barcode on the back</label>
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <input ref={barcodeRef} style={inp} placeholder="978…" value={barcode} disabled={saving} onChange={e => setBarcode(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && barcode.trim()) saveBarcode(barcode) }} />
              <button style={btn} onClick={() => setCamera('barcode')}>📷 Scan</button>
            </div>
            <button style={{ ...btn, border: 'none', background: 'none', padding: '8px 0 0', color: '#6b6b6b', textDecoration: 'underline' }}
              onClick={() => { setCurrent(null); setMsg(null); setTimeout(() => labelRef.current?.focus(), 50) }}>Wrong book? Start again</button>
          </div>
        </div>
      )}

      {/* Still to do (also lets a book without a sticker be picked by hand) */}
      <h2 style={{ fontSize: '15px', fontWeight: 700, margin: '28px 0 8px', color: navy }}>Still to do ({todo.length})</h2>
      {todo.length === 0 && <p style={{ fontSize: '13px', color: '#16a34a', fontWeight: 600 }}>All done! 🎉</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {todo.map(b => (
          <button key={b.id} onClick={() => pickBook(b)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 8px', border: 'none', borderRadius: '8px', backgroundColor: current?.id === b.id ? '#eef2ff' : 'transparent', cursor: 'pointer', textAlign: 'left' }}>
            <div style={{ width: '24px', height: '36px', borderRadius: '3px', overflow: 'hidden', backgroundColor: '#e5e5e5', flexShrink: 0 }}>
              {b.cover_image_url && <img src={b.cover_image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
            </div>
            <span style={{ fontSize: '13px' }}>{b.title}</span>
            <span style={{ fontSize: '12px', color: '#9b9b9b' }}>{copies.filter(c => c.book_id === b.id).map(c => c.internal_id).join(', ')}</span>
          </button>
        ))}
      </div>

      <button style={{ ...btn, marginTop: '20px', border: 'none', background: 'none', padding: 0, textDecoration: 'underline' }} onClick={() => setShowDone(s => !s)}>
        {showDone ? 'Hide' : 'Show'} done ({done.length})
      </button>
      {showDone && (
        <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {done.map(b => <p key={b.id} style={{ margin: 0, fontSize: '13px' }}>✓ {b.title} <span style={{ color: '#9b9b9b' }}>· {scanned[b.id].join(', ')}</span></p>)}
        </div>
      )}

      {camera && (
        <EnvelopeScanner
          title={camera === 'label' ? 'Scan the CUR sticker' : 'Scan the barcode on the back'}
          placeholder={camera === 'label' ? 'CUR-0042' : '978…'}
          onClose={() => setCamera(null)}
          onCode={code => { const which = camera; setCamera(null); if (which === 'label') findByLabel(code); else saveBarcode(code) }} />
      )}
    </div>
  )
}
