'use client'
// Series overview for the team: every series with the books we own, their numbers, the gaps in the numbering
// (e.g. we have 1, 2, 4 → missing 3) and books still without a number. Tap a series to see its books in order;
// tap a book to open it on the Books page. Shows only what we own: books published after our highest number
// aren't known here.

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Series = { id: string; name: string; parent_series_id: string | null }
type Book = { id: string; title: string; cover_image_url: string | null; series_id: string | null; series_number: number | null }
type Copy = { book_id: string; status: string }
type Row = { series: Series; books: Book[]; copies: number; out: number; numbers: number[]; gaps: number[]; unnumbered: number; subs: Row[] }

const navy = '#1a2f51'
const chip = (on: boolean): React.CSSProperties => ({ fontSize: '12px', fontWeight: 600, padding: '6px 12px', borderRadius: '999px', cursor: 'pointer', border: `1px solid ${on ? navy : '#d4d4d4'}`, backgroundColor: on ? navy : '#fff', color: on ? '#fff' : navy })

// [1,2,3,5,7,8] → "1–3, 5, 7–8"
function ranges(ns: number[]): string {
  const out: string[] = []
  for (let i = 0; i < ns.length; i++) {
    let j = i
    while (j + 1 < ns.length && ns[j + 1] === ns[j] + 1) j++
    out.push(i === j ? `${ns[i]}` : `${ns[i]}–${ns[j]}`)
    i = j
  }
  return out.join(', ')
}

export default function SeriesPage() {
  const [series, setSeries] = useState<Series[]>([])
  const [books, setBooks] = useState<Book[]>([])
  const [copies, setCopies] = useState<Copy[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<'all' | 'gaps' | 'unnumbered'>('all')
  const [sort, setSort] = useState<'size' | 'az'>('size')

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/series').then(r => r.json()),
      supabase.from('books').select('id, title, cover_image_url, series_id, series_number').eq('is_active', true).not('series_id', 'is', null),
      supabase.from('book_copies').select('book_id, status'),
    ]).then(([s, b, c]) => { setSeries(s.data || []); setBooks((b.data || []) as Book[]); setCopies((c.data || []) as Copy[]); setLoading(false) })
  }, [])

  const rows = useMemo(() => {
    const copyCount = new Map<string, { n: number; out: number }>()
    for (const c of copies) { const x = copyCount.get(c.book_id) || { n: 0, out: 0 }; x.n++; if (c.status !== 'available') x.out++; copyCount.set(c.book_id, x) }
    const build = (s: Series): Row => {
      const own = books.filter(b => b.series_id === s.id).sort((a, b) => (a.series_number ?? 9999) - (b.series_number ?? 9999) || a.title.localeCompare(b.title))
      const numbers = [...new Set(own.map(b => b.series_number).filter((n): n is number => n != null))].sort((a, b) => a - b)
      const max = numbers.length ? numbers[numbers.length - 1] : 0
      const gaps = numbers.length ? Array.from({ length: max }, (_, i) => i + 1).filter(n => !numbers.includes(n)) : []
      const subs = series.filter(x => x.parent_series_id === s.id).map(build).filter(r => r.books.length || r.subs.length)
      const cc = own.reduce((t, b) => { const x = copyCount.get(b.id); return { n: t.n + (x?.n || 0), out: t.out + (x?.out || 0) } }, { n: 0, out: 0 })
      // "no number" only matters in a numbered series (Mr. Men, for example, has no numbers on purpose)
      const unnumbered = numbers.length ? own.filter(b => b.series_number == null).length : 0
      return { series: s, books: own, copies: cc.n, out: cc.out, numbers, gaps, unnumbered, subs }
    }
    const total = (r: Row): number => r.books.length + r.subs.reduce((t, x) => t + total(x), 0)
    const anyGap = (r: Row): boolean => r.gaps.length > 0 || r.subs.some(anyGap)
    const anyUn = (r: Row): boolean => r.unnumbered > 0 || r.subs.some(anyUn)
    const text = q.trim().toLowerCase()
    return series.filter(s => !s.parent_series_id).map(build)
      .filter(r => total(r) > 0)
      .filter(r => !text || r.series.name.toLowerCase().includes(text) || r.subs.some(x => x.series.name.toLowerCase().includes(text)) || r.books.some(b => b.title.toLowerCase().includes(text)))
      .filter(r => filter === 'all' || (filter === 'gaps' ? anyGap(r) : anyUn(r)))
      .sort((a, b) => sort === 'az' ? a.series.name.localeCompare(b.series.name) : total(b) - total(a) || a.series.name.localeCompare(b.series.name))
  }, [series, books, copies, q, filter, sort])

  if (loading) return <div style={{ padding: '40px', fontFamily: 'var(--font-montserrat)', color: '#6b6b6b' }}>Loading…</div>

  const Summary = ({ r }: { r: Row }) => (
    <span style={{ fontSize: '12px', color: '#4a4a4a', lineHeight: 1.6 }}>
      {r.books.length} {r.books.length === 1 ? 'book' : 'books'} · {r.copies} {r.copies === 1 ? 'copy' : 'copies'}{r.out ? ` (${r.out} out)` : ''}
      {r.numbers.length > 0 && <> · numbers {ranges(r.numbers)}</>}
      {r.gaps.length > 0 && <> · <strong style={{ color: '#b45309' }}>missing {ranges(r.gaps)}</strong></>}
      {r.unnumbered > 0 && <> · <strong style={{ color: '#b45309' }}>{r.unnumbered} without a number</strong></>}
    </span>
  )

  const BookGrid = ({ list }: { list: Book[] }) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: '12px', marginTop: '10px' }}>
      {list.map(b => {
        const cs = copies.filter(c => c.book_id === b.id), out = cs.filter(c => c.status !== 'available').length
        return (
          <Link key={b.id} href={`/admin/books?book=${b.id}`} style={{ textDecoration: 'none', color: '#1a1a1a' }} title="Open this book">
            <div style={{ width: '100%', aspectRatio: '2/3', borderRadius: '6px', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', overflow: 'hidden' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {b.cover_image_url ? <img src={b.cover_image_url} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} /> : <span style={{ fontSize: '10px', color: '#94a3b8', padding: '6px' }}>no cover</span>}
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '11px', fontWeight: 700, color: b.series_number == null ? '#b45309' : navy }}>{b.series_number != null ? `#${b.series_number}` : 'no number'}</p>
            <p style={{ margin: '1px 0 0', fontSize: '11px', lineHeight: 1.3 }}>{b.title}</p>
            <p style={{ margin: '1px 0 0', fontSize: '10px', color: '#6b6b6b' }}>{cs.length} {cs.length === 1 ? 'copy' : 'copies'}{out ? ` · ${out} out` : ''}</p>
          </Link>
        )
      })}
    </div>
  )

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      <div style={{ padding: '28px 32px', fontFamily: 'var(--font-montserrat)', color: '#1a1a1a', maxWidth: '960px' }}>
        <Link href="/admin/books" style={{ fontSize: '12px', color: '#6b6b6b', textDecoration: 'none' }}>← Books</Link>
        <h1 style={{ fontSize: '22px', fontWeight: 700, margin: '6px 0 4px', color: navy }}>Series</h1>
        <p style={{ fontSize: '13px', color: '#4a4a4a', margin: '0 0 14px', lineHeight: 1.5 }}>
          Every series and the books we own. <strong style={{ color: '#b45309' }}>Missing</strong> means a gap in the numbers we have (e.g. we have 1, 2 and 4, so 3 is missing).
          Books published after our highest number aren&apos;t shown, so check those on the publisher&apos;s site.
        </p>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '16px' }}>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search series or book" style={{ flex: '1 1 220px', padding: '8px 12px', borderRadius: '8px', border: '1px solid #d4d4d4', fontSize: '13px' }} />
          <button onClick={() => setFilter('all')} style={chip(filter === 'all')}>All</button>
          <button onClick={() => setFilter('gaps')} style={chip(filter === 'gaps')}>With gaps</button>
          <button onClick={() => setFilter('unnumbered')} style={chip(filter === 'unnumbered')}>Books without a number</button>
          <span style={{ width: '8px' }} />
          <button onClick={() => setSort('size')} style={chip(sort === 'size')}>Biggest first</button>
          <button onClick={() => setSort('az')} style={chip(sort === 'az')}>A–Z</button>
        </div>
        <p style={{ fontSize: '12px', color: '#6b6b6b', margin: '0 0 10px' }}>{rows.length} series</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {rows.map(r => {
            const isOpen = open === r.series.id
            return (
              <div key={r.series.id} style={{ border: `1px solid ${isOpen ? navy : '#e5e5e5'}`, borderRadius: '10px', backgroundColor: '#fff' }}>
                <button onClick={() => setOpen(isOpen ? null : r.series.id)} style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: '12px 14px', cursor: 'pointer', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '12px', color: navy, marginTop: '2px' }}>{isOpen ? '▾' : '▸'}</span>
                  <span style={{ flex: 1 }}>
                    <span style={{ display: 'block', fontSize: '15px', fontWeight: 700, color: navy }}>{r.series.name}</span>
                    {r.books.length > 0 && <Summary r={r} />}
                    {r.subs.map(s => <span key={s.series.id} style={{ display: 'block', marginTop: '2px' }}><span style={{ fontSize: '12px', fontWeight: 600, color: navy }}>› {s.series.name}: </span><Summary r={s} /></span>)}
                  </span>
                </button>
                {isOpen && (
                  <div style={{ padding: '0 14px 14px' }}>
                    {r.books.length > 0 && <BookGrid list={r.books} />}
                    {r.subs.map(s => (
                      <div key={s.series.id} style={{ marginTop: '14px' }}>
                        <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: navy }}>› {s.series.name}</p>
                        <BookGrid list={s.books} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
