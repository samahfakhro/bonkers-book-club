'use client'
import { useEffect, useState, type CSSProperties } from 'react'

// The small gold line under a book title: "Dog Man · Book 5". Titles are the book's own name, so this tells
// families which series a book belongs to. Lines are fetched in one batch per screen and remembered.
const cache = new Map<string, string | null>()
const waiting = new Map<string, ((line: string | null) => void)[]>()
let timer: ReturnType<typeof setTimeout> | null = null

function flush() {
  timer = null
  const ids = [...waiting.keys()]
  const callbacks = new Map(waiting); waiting.clear()
  fetch('/api/series-lines?ids=' + ids.join(','))
    .then(r => r.json()).then(j => j.lines || {}).catch(() => ({} as Record<string, string | null>))
    .then((lines: Record<string, string | null>) => {
      for (const id of ids) { const l = lines[id] ?? null; cache.set(id, l); for (const cb of callbacks.get(id) || []) cb(l) }
    })
}

function load(id: string, cb: (line: string | null) => void) {
  if (cache.has(id)) { cb(cache.get(id) ?? null); return }
  waiting.set(id, [...(waiting.get(id) || []), cb])
  if (!timer) timer = setTimeout(flush, 30)
}

export default function SeriesLine({ bookId, style }: { bookId: string | null | undefined; style?: CSSProperties }) {
  const [line, setLine] = useState<string | null>(bookId ? cache.get(bookId) ?? null : null)
  useEffect(() => {
    if (!bookId) return
    let alive = true
    load(bookId, l => { if (alive) setLine(l) })
    return () => { alive = false }
  }, [bookId])
  if (!line) return null
  return (
    <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.65rem', fontWeight: 700, color: '#c48b00', letterSpacing: '0.05em', margin: '2px 0 0', lineHeight: 1.35, overflowWrap: 'anywhere', ...style }}>{line}</p>
  )
}
