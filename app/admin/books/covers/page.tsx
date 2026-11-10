'use client'
// Missing covers: every book without a cover, one row each. The highlighted book shows suggested covers (Google Books,
// Open Library, Penguin — never Amazon): tap the right one to save it. Otherwise: open Amazon for the book (links search
// by its barcode), right-click the cover → Copy image, click the book's row here and press Ctrl+V. Dragging in a saved
// image file, or choosing one, works too. Nothing is fetched from Amazon by this page: the team copies each image.

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Book = { id: string; title: string; author: string; isbn: string | null; cover_image_url: string | null; publisher: string | null }

// Each publisher's own website. Penguin's search goes straight to the book; for the others a Google search limited to
// their site puts the book page first. Unknown publisher → a plain Google search for the barcode.
const PUBLISHER_SITES: [RegExp, string][] = [
  [/puffin|penguin|ladybird|transworld|price stern|random house|corgi/i, 'penguin.co.uk'],
  [/farshore|egmont/i, 'farshore.co.uk'],
  [/harper/i, 'harpercollins.co.uk'],
  [/scholastic|graphix|alison green|branches/i, 'scholastic.co.uk'],
  [/macmillan/i, 'panmacmillan.com'],
  [/hodder|orion|orchard|hachette|wren/i, 'hachettechildrens.co.uk'],
  [/walker/i, 'walker.co.uk'],
  [/simon/i, 'simonandschuster.co.uk'],
  [/bloomsbury/i, 'bloomsbury.com'],
  [/fickling/i, 'davidficklingbooks.com'],
  [/usborne/i, 'usborne.com'],
  [/little tiger/i, 'littletiger.co.uk'],
  [/andrews mcmeel/i, 'andrewsmcmeel.com'],
  [/nosy crow/i, 'nosycrow.com'],
  [/barrington/i, 'barringtonstoke.co.uk'],
  [/candlewick/i, 'candlewick.com'],
  [/\bdk\b|dorling/i, 'dk.com'],
]
function publisherLink(b: Book, isbn: string): { href: string; label: string } {
  const site = b.publisher ? PUBLISHER_SITES.find(([re]) => re.test(b.publisher!))?.[1] : null
  const q = isbn || `${b.title} ${b.author || ''}`
  if (site === 'penguin.co.uk' && isbn) return { href: `https://www.penguin.co.uk/search-results?q=${isbn}`, label: `${b.publisher} site` }
  if (site) return { href: `https://www.google.com/search?q=${encodeURIComponent(`${q} site:${site}`)}`, label: `${b.publisher} site` }
  return { href: `https://www.google.com/search?q=${encodeURIComponent(isbn ? isbn : `${q} book`)}`, label: 'Find publisher' }
}

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
  const [suggest, setSuggest] = useState<{ id: string; list: { url: string; source: string }[] } | null>(null)
  const [skipped, setSkipped] = useState<Set<string>>(new Set())

  // suggested covers for the highlighted book
  useEffect(() => {
    if (!selected) return
    let alive = true
    setSuggest(null)
    fetch('/api/admin/cover-candidates?id=' + selected).then(r => r.json())
      .then(j => { if (alive) setSuggest({ id: selected, list: j.candidates || [] }) })
      .catch(() => { if (alive) setSuggest({ id: selected, list: [] }) })
    return () => { alive = false }
  }, [selected])

  // the book has its cover: take it off the list and highlight the next one (skipping ones marked "none of these")
  const done = useCallback((bookId: string, title: string) => {
    setMsg({ ok: true, text: `✓ Cover saved for ${title}` })
    setDoneCount(n => n + 1)
    setBooks(prev => {
      const i = prev.findIndex(b => b.id === bookId)
      const next = prev.filter(b => b.id !== bookId)
      const order = next.slice(i).concat(next.slice(0, i))
      setSelected(order.find(b => !skipped.has(b.id))?.id || null)
      return next
    })
  }, [skipped])

  async function pickSuggestion(bookId: string, url: string) {
    const book = books.find(b => b.id === bookId)
    if (!book || busy) return
    setBusy(bookId); setMsg(null)
    try {
      const res = await fetch('/api/admin/cover-candidates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: bookId, url }) })
      const j = await res.json().catch(() => ({}))
      if (!res.ok || !j.publicUrl) throw new Error(j.error || 'save failed')
      done(bookId, book.title)
    } catch (e: any) {
      setMsg({ ok: false, text: `⚠ Couldn’t save that cover: ${e?.message || 'try another'}` })
    } finally { setBusy(null) }
  }

  function noneRight(bookId: string) {
    const nextSkipped = new Set(skipped); nextSkipped.add(bookId); setSkipped(nextSkipped)
    const i = books.findIndex(b => b.id === bookId)
    const order = books.slice(i + 1).concat(books.slice(0, i))
    setSelected(order.find(b => !nextSkipped.has(b.id))?.id || null)
  }

  useEffect(() => {
    supabase.from('books').select('id, title, author, isbn, cover_image_url, publisher').is('cover_image_url', null).order('title').then(({ data }) => {
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
      done(bookId, book.title)
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message === 'not an image' ? 'That wasn’t an image. On Amazon, right-click the cover and choose “Copy image”, then paste again.' : `⚠ Couldn’t save the cover: ${e?.message || 'try again'}` })
    } finally { setBusy(null) }
  }, [books, done])

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
    <div style={{ flex: 1, overflowY: 'auto' }}>{/* the admin frame doesn't scroll, so this page scrolls itself */}
    <div style={{ padding: '28px 32px', fontFamily: 'var(--font-montserrat)', color: '#1a1a1a', maxWidth: '860px' }}>
      <Link href="/admin/books" style={{ fontSize: '12px', color: '#6b6b6b', textDecoration: 'none' }}>← Books</Link>
      <h1 style={{ fontSize: '22px', fontWeight: 700, margin: '6px 0 4px', color: navy }}>Missing covers</h1>
      <p style={{ fontSize: '13px', color: '#6b6b6b', margin: '0 0 6px' }}>
        {books.length} book{books.length === 1 ? '' : 's'} without a cover{doneCount ? ` · ${doneCount} added just now` : ''}
      </p>
      <p style={{ fontSize: '13px', color: '#4a4a4a', margin: '0 0 16px', lineHeight: 1.5 }}>
        The highlighted book shows <strong>suggested covers</strong>: tap the one that matches your copy (English, same edition) and it saves. If none are right, tap <strong>None of these</strong>.<br />
        Or click <strong>Amazon</strong> on a book → right-click the cover → <strong>Copy image</strong> → come back and press <strong>Ctrl + V</strong>. It goes on the highlighted book, then the next book is highlighted. You can also drag an image file onto a row.
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
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#6b6b6b' }}>{b.author}{isbn ? ` · ${isbn}` : ' · no barcode'}{skipped.has(b.id) ? ' · no suggestion was right' : ''}</p>
                {isSel && (
                  <div onClick={e => e.stopPropagation()} style={{ marginTop: '10px', cursor: 'default' }}>
                    {suggest?.id !== b.id
                      ? <p style={{ margin: 0, fontSize: '12px', color: '#6b6b6b' }}>Looking for covers…</p>
                      : <SuggestionStrip key={b.id} list={suggest.list} disabled={!!busy} onPick={url => pickSuggestion(b.id, url)} onNone={() => noneRight(b.id)} />}
                  </div>
                )}
              </div>
              {(() => { const p = publisherLink(b, isbn); return <a href={p.href} target="_blank" rel="noopener noreferrer" onClick={e => { e.stopPropagation(); setSelected(b.id) }} style={linkBtn}>🏢 {p.label}</a> })()}
              <a href={`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(`${b.title} ${b.author || ''} book cover`)}`} target="_blank" rel="noopener noreferrer" onClick={e => { e.stopPropagation(); setSelected(b.id) }} style={linkBtn}>🔎 Google Images</a>
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
    </div>
  )
}

// The suggested covers, big enough to check the edition and language. Broken or placeholder images hide themselves.
function SuggestionStrip({ list, disabled, onPick, onNone }: { list: { url: string; source: string }[]; disabled: boolean; onPick: (url: string) => void; onNone: () => void }) {
  const [bad, setBad] = useState<Set<string>>(new Set())
  const hide = (url: string) => setBad(prev => new Set(prev).add(url))
  // each image's real size: covers under 500px wide look blurry on a book's own page on phones and iPads
  const [size, setSize] = useState<Record<string, { w: number; h: number }>>({})
  const shown = list.filter(c => !bad.has(c.url))
  return (
    <div>
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        {shown.map(c => (
          <button key={c.url} type="button" disabled={disabled} onClick={() => onPick(c.url)} title="Use this cover"
            style={{ border: '2px solid #e5e5e5', borderRadius: '10px', padding: '6px', backgroundColor: '#fff', cursor: disabled ? 'wait' : 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', width: '132px' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={c.url} alt="" referrerPolicy="no-referrer" onError={() => hide(c.url)}
              onLoad={e => {
                const i = e.currentTarget
                if (i.naturalWidth < 60 || i.naturalHeight < 80) hide(c.url)
                else setSize(prev => ({ ...prev, [c.url]: { w: i.naturalWidth, h: i.naturalHeight } }))
              }}
              style={{ maxWidth: '120px', maxHeight: '180px', objectFit: 'contain', borderRadius: '4px' }} />
            <span style={{ fontSize: '10px', color: '#6b6b6b', textAlign: 'center', lineHeight: 1.3 }}>{c.source}</span>
            {size[c.url] && (
              <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '6px',
                backgroundColor: size[c.url].w >= 500 ? '#fdf3d7' : '#f1f1f1', color: size[c.url].w >= 500 ? '#8a6100' : '#6b6b6b' }}>
                {size[c.url].w >= 500 ? '✓ sharp' : 'small'} · {size[c.url].w}×{size[c.url].h}
              </span>
            )}
          </button>
        ))}
        {shown.length === 0 && <p style={{ margin: 0, fontSize: '12px', color: '#6b6b6b' }}>No suggestions found. Use Amazon or take a photo.</p>}
      </div>
      <button type="button" onClick={onNone} style={{ ...linkBtn, cursor: 'pointer', marginTop: '10px' }}>None of these → next book</button>
    </div>
  )
}
