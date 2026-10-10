'use client'

import { useCallback, useEffect, useState } from 'react'

// Admin Reports: members, where families come from, books, stock and the waitlist — for a chosen date range.

type Row = { label: string; count: number }
type Report = {
  range: { from: string | null; to: string | null }
  members: { signups: number; cancellations: number; activeFamilies: number; childrenPerFamily: Row[]; byMonth: { month: string; signups: number; cancellations: number }[] }
  sources: { funnel: { source: string; visits: number; waitlist: number; members: number; visitToMember: number | null }[]; saidVsSaw: { said: string; saw: string; count: number }[]; totalVisits: number }
  books: { mostBorrowed: { title: string; cover: string | null; count: number }[]; neverBorrowed: number; neverBorrowedSample: { title: string; cover: string | null }[]; bestReviewed: { title: string; cover: string | null; rating: number; ratings: number }[]; avgDaysOut: number | null; loansInRange: number; loansByStage: { stage: string; children: number; loans: number; perChild: number | null }[] }
  stock: { usableCopies: number; onShelf: number; activeFamilies: number; perTenFamilies: number | null; guidePerTen: number; unknownStageCopies: number; byStage: { stage: string; copies: number; children: number; perChild: number | null }[] }
  waitlist: { newEntries: number; stillWaiting: number; byArea: Row[]; byZone: Row[]; invited: number; joined: number; inviteToJoin: number | null; byMonth: { month: string; count: number }[] }
}

const font: React.CSSProperties = { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', color: '#1a1a1a' }
const card: React.CSSProperties = { border: '1px solid #e5e5e5', borderRadius: '10px', padding: '16px 18px', marginBottom: '16px', backgroundColor: '#fff' }
const h2: React.CSSProperties = { ...font, fontSize: '14px', fontWeight: 700, margin: '0 0 12px' }
const h3: React.CSSProperties = { ...font, fontSize: '11px', fontWeight: 700, color: '#9b9b9b', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '14px 0 8px' }
const muted: React.CSSProperties = { ...font, fontSize: '12px', color: '#9b9b9b' }
const inp: React.CSSProperties = { ...font, padding: '6px 8px', borderRadius: '6px', border: '1px solid #d4d4d4', fontSize: '13px', backgroundColor: '#fff' }

const dubaiToday = () => new Date(Date.now() + 4 * 3600_000).toISOString().slice(0, 10)
const daysAgo = (n: number) => new Date(Date.now() + 4 * 3600_000 - n * 86400_000).toISOString().slice(0, 10)
const monthLabel = (m: string) => new Date(`${m}-15T12:00:00Z`).toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' })
const FIRST_YEAR = 2026

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div style={{ flex: '1 1 140px', border: '1px solid #f0f0f0', borderRadius: '8px', padding: '10px 12px' }}>
      <p style={{ ...muted, margin: 0 }}>{label}</p>
      <p style={{ ...font, fontSize: '22px', fontWeight: 700, margin: '2px 0 0' }}>{value}</p>
      {sub && <p style={{ ...muted, margin: 0 }}>{sub}</p>}
    </div>
  )
}

function Bars({ rows, color = '#1a2f51' }: { rows: Row[]; color?: string }) {
  if (!rows.length) return <p style={muted}>Nothing in this period.</p>
  const max = Math.max(...rows.map(r => r.count), 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
      {rows.map(r => (
        <div key={r.label} style={{ display: 'grid', gridTemplateColumns: '170px 1fr 36px', gap: '8px', alignItems: 'center' }}>
          <span style={{ ...font, fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.label}>{r.label}</span>
          <span style={{ height: '12px', borderRadius: '3px', backgroundColor: '#f0f0f0' }}><span style={{ display: 'block', height: '100%', width: `${(r.count / max) * 100}%`, borderRadius: '3px', backgroundColor: color }} /></span>
          <span style={{ ...font, fontSize: '12px', fontWeight: 600, textAlign: 'right' }}>{r.count}</span>
        </div>
      ))}
    </div>
  )
}

function Table({ head, rows }: { head: string[]; rows: (string | number | React.ReactNode)[][] }) {
  if (!rows.length) return <p style={muted}>Nothing in this period.</p>
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', ...font, fontSize: '12px' }}>
      <thead><tr>{head.map((h, i) => <th key={i} style={{ textAlign: i ? 'right' : 'left', padding: '5px 6px', color: '#9b9b9b', fontWeight: 700, borderBottom: '1px solid #eee' }}>{h}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} style={{ textAlign: j ? 'right' : 'left', padding: '5px 6px', borderBottom: '1px solid #f6f6f6' }}>{c}</td>)}</tr>)}</tbody>
    </table>
  )
}

function BookCell({ title, cover }: { title: string; cover: string | null }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      {cover ? <img src={cover} alt="" style={{ width: '24px', height: '34px', objectFit: 'cover', borderRadius: '2px', flexShrink: 0 }} /> : <span style={{ width: '24px', height: '34px', background: '#eee', borderRadius: '2px', flexShrink: 0 }} />}
      {title}
    </span>
  )
}

export default function ReportsPage() {
  const [preset, setPreset] = useState<'30' | '90' | 'year' | 'all' | 'custom'>('30')
  const [year, setYear] = useState(String(new Date().getFullYear()))
  const [from, setFrom] = useState(daysAgo(29))
  const [to, setTo] = useState(dubaiToday())
  const [data, setData] = useState<Report | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const years = Array.from({ length: Math.max(1, new Date().getFullYear() - FIRST_YEAR + 1) }, (_, i) => String(new Date().getFullYear() - i))

  // the range actually asked for
  const range = preset === '30' ? { from: daysAgo(29), to: dubaiToday() }
    : preset === '90' ? { from: daysAgo(89), to: dubaiToday() }
    : preset === 'year' ? { from: `${year}-01-01`, to: `${year}-12-31` }
    : preset === 'all' ? { from: '', to: '' }
    : { from, to }

  const load = useCallback(async (r: { from: string; to: string }) => {
    setLoading(true); setError(null)
    const q = new URLSearchParams(); if (r.from) q.set('from', r.from); if (r.to) q.set('to', r.to)
    const res = await fetch(`/api/admin/reports?${q}`, { cache: 'no-store' })
    const b = await res.json().catch(() => ({}))
    setLoading(false)
    if (!res.ok) { setError(b.error || 'Could not load'); return }
    setData(b)
  }, [])
  useEffect(() => { if (preset !== 'custom' || (from && to && from <= to)) load(range) }, [preset, year, from, to]) // eslint-disable-line react-hooks/exhaustive-deps

  const chip = (v: typeof preset, label: string) => (
    <button onClick={() => setPreset(v)} style={{ ...font, padding: '6px 12px', borderRadius: '999px', border: '1px solid #d4d4d4', cursor: 'pointer', fontSize: '12px', fontWeight: 600, backgroundColor: preset === v ? '#1a1a1a' : '#fff', color: preset === v ? '#fff' : '#1a1a1a' }}>{label}</button>
  )
  const d = data

  return (
    <div style={{ padding: '24px 32px 80px', overflowY: 'auto', height: '100%', maxWidth: '920px' }}>
      <h1 style={{ ...font, fontSize: '15px', fontWeight: 700, margin: '0 0 12px' }}>Reports</h1>

      <div style={{ ...card, display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', position: 'sticky', top: 0, zIndex: 1 }}>
        {chip('30', 'Last 30 days')}{chip('90', 'Last 90 days')}{chip('all', 'All time')}
        <span style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          {chip('year', 'Year')}
          <select value={year} onChange={e => { setYear(e.target.value); setPreset('year') }} style={inp}>{years.map(y => <option key={y}>{y}</option>)}</select>
        </span>
        <span style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          {chip('custom', 'Dates')}
          <input type="date" value={from} max={to} onChange={e => { setFrom(e.target.value); setPreset('custom') }} style={inp} />
          <span style={muted}>to</span>
          <input type="date" value={to} min={from} onChange={e => { setTo(e.target.value); setPreset('custom') }} style={inp} />
        </span>
        {loading && <span style={muted}>Loading…</span>}
      </div>
      <p style={{ ...muted, margin: '-8px 0 14px' }}>Test families are left out of every number.</p>

      {error && <p style={{ ...font, color: '#dc2626' }}>{error}</p>}
      {d && (
        <>
          <div style={card}>
            <p style={h2}>Members</p>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <Stat label="New signups" value={d.members.signups} />
              <Stat label="Cancellations" value={d.members.cancellations} />
              <Stat label="Active families (today)" value={d.members.activeFamilies} />
            </div>
            <p style={h3}>Signups and cancellations by month</p>
            <Table head={['Month', 'Signups', 'Cancellations']} rows={d.members.byMonth.map(m => [monthLabel(m.month), m.signups, m.cancellations])} />
            <p style={h3}>Children per family (active families)</p>
            <Bars rows={d.members.childrenPerFamily} />
          </div>

          <div style={card}>
            <p style={h2}>Where families come from</p>
            <p style={muted}>Visits are counted once per visitor, by where they first came from.</p>
            <Table head={['Source', 'Visits', 'Waitlist', 'Members', 'Visit → member']}
              rows={d.sources.funnel.map(f => [f.source, f.visits, f.waitlist, f.members, f.visitToMember == null ? '—' : `${f.visitToMember}%`])} />
            <p style={h3}>What families said vs what we saw</p>
            <Table head={['They said (“How did you hear”)', 'We saw (first visit)', 'Families']} rows={d.sources.saidVsSaw.map(r => [r.said, r.saw, r.count])} />
          </div>

          <div style={card}>
            <p style={h2}>Books</p>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <Stat label="Books borrowed" value={d.books.loansInRange} />
              <Stat label="Average time out" value={d.books.avgDaysOut == null ? '—' : `${d.books.avgDaysOut} days`} sub="books returned in this period" />
              <Stat label="Never borrowed" value={d.books.neverBorrowed} sub="all time" />
            </div>
            <p style={h3}>Most borrowed</p>
            <Table head={['Book', 'Times borrowed']} rows={d.books.mostBorrowed.map(b => [<BookCell key={b.title} {...b} />, b.count])} />
            <p style={h3}>Best reviewed (all time)</p>
            <Table head={['Book', 'Rating', 'Reviews']} rows={d.books.bestReviewed.map(b => [<BookCell key={b.title} {...b} />, b.rating.toFixed(1), b.ratings])} />
            <p style={h3}>Borrowing by reading stage</p>
            <Table head={['Stage', 'Children', 'Books borrowed', 'Per child']} rows={d.books.loansByStage.map(s => [s.stage, s.children, s.loans, s.perChild ?? '—'])} />
            {d.books.neverBorrowedSample.length > 0 && <>
              <p style={h3}>Never borrowed (first {d.books.neverBorrowedSample.length})</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>{d.books.neverBorrowedSample.map(b => <BookCell key={b.title} {...b} />)}</div>
            </>}
          </div>

          <div style={card}>
            <p style={h2}>Stock (today)</p>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <Stat label="Books in circulation" value={d.stock.usableCopies} sub={`${d.stock.onShelf} on the shelf now`} />
              <Stat label="Books per 10 families" value={d.stock.perTenFamilies ?? '—'} sub={`your guide: ${d.stock.guidePerTen}`} />
            </div>
            <p style={h3}>By reading stage</p>
            <Table head={['Stage', 'Books', 'Children', 'Books per child']} rows={d.stock.byStage.map(s => [s.stage, s.copies, s.children, s.perChild ?? '—'])} />
            {d.stock.unknownStageCopies > 0 && <p style={muted}>{d.stock.unknownStageCopies} books have no age set, so they aren’t in a stage.</p>}
          </div>

          <div style={card}>
            <p style={h2}>Waitlist</p>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <Stat label="New entries" value={d.waitlist.newEntries} />
              <Stat label="Still waiting (today)" value={d.waitlist.stillWaiting} />
              <Stat label="Invited → joined" value={`${d.waitlist.joined}/${d.waitlist.invited}`} sub={d.waitlist.inviteToJoin == null ? undefined : `${d.waitlist.inviteToJoin}%`} />
            </div>
            <p style={h3}>New entries by month</p>
            <Bars rows={d.waitlist.byMonth.map(m => ({ label: monthLabel(m.month), count: m.count }))} color="#b45309" />
            <p style={h3}>By area</p>
            <Bars rows={d.waitlist.byArea} color="#b45309" />
            <p style={h3}>By zone</p>
            <Bars rows={d.waitlist.byZone} color="#b45309" />
          </div>
        </>
      )}
    </div>
  )
}
