'use client'
// Missing covers: every book without a cover, one row each. Fastest way in: open Amazon for the book (links search
// by its barcode), right-click the cover → Copy image, click the book's row here and press Ctrl+V. Dragging in a saved
// image file, or choosing one, works too. Nothing is fetched from Amazon by this page: the team copies each image.

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Book = { id: string; title: string; author: string; isbn: string | null; cover_image_url: string | null }

const navy = '#1a2f51'
const linkBtn: React.CSSProperties = { fontSize: '12px', fontWeight: 600, color: navy, textDecoration: 'none', padding: '6px 10px', border: '1px solid #d4d4d4', borderRadius: '8px', backgroundColor: '#fff', whiteSpace: 'nowrap' }

// any image → JPEG data URL, at most 1200px tall (keeps uploads small; Amazon images are already cover-shaped)
function toJpeg(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, 1200 / img.height)
      const c = document.createElement('canvas')
      c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale)
      const ctx = c.getContext('2d')!
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height)
      ctx.drawImage(img, 0, 0, c.width, c.height)
      URL.revokeObjectURL(url)
      resolve(c.toDataURL('image/jpeg', 0.9))
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('not an image')) }
    img.src = url
  })
}

export default function MissingCoversPage() {
  const [books, setBooks] = useState<Book[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [doneCount, setDoneCount] = useState(0)
  const [dragOver, setDragOver] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const fileFor = useRef<string | null>(null)

  useEffect(() => {
    supabase.from('books').select('id, title, author, isbn, cover_image_url').is('cover_image_url', null).order('title').then(({ data }) => {
      const list = (data || []) as Book[]
      setBooks(list); setSelected(list[0]?.id || null); setLoading(false)
    })
  }, [])

  const upload = useCallback(async (bookId: string, blob: Blob) => {
    const book = books.find(b => b.id === bookId)
    if (!book) return
    setBusy(bookId); setMsg(null)
    try {
      const base64 = await toJpeg(blob)
      const res = await fetch('/api/admin/books', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: bookId, bucket: 'book-covers', base64, field: 'cover_image_url' }) })
      const j = await res.json().catch(() => ({}))
      if (!res.ok || !j.publicUrl) throw new Error(j.error || 'upload failed')
      setMsg({ ok: true, text: `✓ Cover saved for ${book.title}` })
      setDoneCount(n => n + 1)
      setBooks(prev => {
        const i = prev.findIndex(b => b.id === bookId)
        const next = prev.filter(b => b.id !== bookId)
        setSelected(next[Math.min(i, next.length - 1)]?.id || null)   // move on to the next book
        return next
      })
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message === 'not an image' ? 'That wasn’t an image. On Amazon, right-click the cover and choose “Copy image”, then paste again.' : `⚠ Couldn’t save the cover: ${e?.message || 'try again'}` })
    } finally { setBusy(null) }
  }, [books])

  // Ctrl+V anywhere on the page puts the copied image on the selected book
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (!selected || busy) return
      const item = [...(e.clipboardData?.items || [])].find(i => i.type.startsWith('image/'))
      if (!item) { setMsg({ ok: false, text: 'No image was copied. On Amazon, right-click the cover and choose “Copy image” (not “Copy image address”).' }); return }
      const blob = item.getAsFile()
      if (blob) { e.preventDefault(); upload(selected, blob) }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [selected, busy, upload])

  function onDrop(e: React.DragEvent, bookId: string) {
    e.preventDefault(); setDragOver(null)
    const file = [...e.dataTransfer.files].find(f => f.type.startsWith('image/'))
    if (file) { setSelected(bookId); upload(bookId, file); return }
    setMsg({ ok: false, text: 'Drop a saved image file, or use “Copy image” on Amazon and press Ctrl+V here.' })
  }

  if (loading) return <div style={{ padding: '40px', fontFamily: 'var(--font-montserrat)', color: '#6b6b6b' }}>Loading…</div>

  return (
    <div style={{ padding: '28px 32px', fontFamily: 'var(--font-montserrat)', color: '#1a1a1a', maxWidth: '860px' }}>
      <Link href="/admin/books" style={{ fontSize: '12px', color: '#6b6b6b', textDecoration: 'none' }}>← Books</Link>
      <h1 style={{ fontSize: '22px', fontWeight: 700, margin: '6px 0 4px', color: navy }}>Missing covers</h1>
      <p style={{ fontSize: '13px', color: '#6b6b6b', margin: '0 0 6px' }}>
        {books.length} book{books.length === 1 ? '' : 's'} without a cover{doneCount ? ` · ${doneCount} added just now` : ''}
      </p>
      <p style={{ fontSize: '13px', color: '#4a4a4a', margin: '0 0 16px', lineHeight: 1.5 }}>
        Click <strong>Amazon</strong> on a book → right-click the cover → <strong>Copy image</strong> → come back and press <strong>Ctrl + V</strong>. It goes on the highlighted book, then the next book is highlighted. You can also drag an image file onto a row.
      </p>

      {msg && <div style={{ position: 'sticky', top: 0, zIndex: 5, marginBottom: '12px', padding: '10px 14px', borderRadius: '10px', fontSize: '13px', fontWeight: 600, backgroundColor: msg.ok ? '#f0fdf4' : '#fef2f2', color: msg.ok ? '#166534' : '#b91c1c', border: `1px solid ${msg.ok ? '#bbf7d0' : '#fecaca'}` }}>{msg.text}</div>}

      {books.length === 0 && <p style={{ fontSize: '14px', color: '#16a34a', fontWeight: 600 }}>Every book has a cover! 🎉</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {books.map(b => {
          const isSel = selected === b.id
          const isbn = (b.isbn || '').replace(/[^0-9X]/gi, '')
          const q = encodeURIComponent(isbn || `${b.title} ${b.author}`)
          return (
            <div key={b.id} onClick={() => setSelected(b.id)}
              onDragOver={e => { e.preventDefault(); setDragOver(b.id) }} onDragLeave={() => setDragOver(null)} onDrop={e => onDrop(e, b.id)}
              style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', borderRadius: '10px', cursor: 'pointer',
                border: `2px solid ${dragOver === b.id ? '#16a34a' : isSel ? navy : '#e5e5e5'}`, backgroundColor: isSel ? '#f3f6fb' : '#fff' }}>
              <div style={{ width: '40px', height: '60px', borderRadius: '4px', flexShrink: 0, border: '2px dashed #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#94a3b8', textAlign: 'center' }}>
                {busy === b.id ? '…' : isSel ? 'Ctrl+V' : ''}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>{b.title}</p>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#6b6b6b' }}>{b.author}{isbn ? ` · ${isbn}` : ' · no barcode'}</p>
              </div>
              <a href={`https://www.amazon.co.uk/s?k=${q}`} target="_blank" rel="noopener noreferrer" onClick={e => { e.stopPropagation(); setSelected(b.id) }} style={linkBtn}>🔎 Amazon UK</a>
              <a href={`https://www.amazon.ae/s?k=${q}`} target="_blank" rel="noopener noreferrer" onClick={e => { e.stopPropagation(); setSelected(b.id) }} style={linkBtn}>🔎 Amazon UAE</a>
              <button onClick={e => { e.stopPropagation(); setSelected(b.id); fileFor.current = b.id; fileRef.current?.click() }} style={{ ...linkBtn, cursor: 'pointer' }}>⬆ File</button>
            </div>
          )
        })}
      </div>

      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; const id = fileFor.current; e.target.value = ''; if (f && id) upload(id, f) }} />
    </div>
  )
}
