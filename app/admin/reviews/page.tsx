'use client'

import { useCallback, useEffect, useState } from 'react'

// Reviews — children's written comments wait here until approved. Stars and category blobs show on the book page straight away.
type Review = {
  id: string; star_rating: number | null; review_text: string; moderation_status: string; created_at: string
  books: { title: string; cover_image_url: string | null } | null
  child_profiles: { name: string | null; nickname: string | null; households: { first_name: string | null; last_name: string | null } | null } | null
}
type Tab = 'pending' | 'approved' | 'hidden'
const TABS: { key: Tab; label: string }[] = [{ key: 'pending', label: 'Waiting' }, { key: 'approved', label: 'Approved' }, { key: 'hidden', label: 'Hidden' }]

const btn = (primary = false): React.CSSProperties => ({ padding: '8px 16px', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', border: primary ? 'none' : '1px solid #ccc', background: primary ? '#1a1a1a' : '#fff', color: primary ? '#fff' : '#1a1a1a' })
const stars = (n: number | null) => n ? '★'.repeat(n) + '☆'.repeat(5 - n) : 'No stars'
const when = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

export default function ReviewsPage() {
  const [tab, setTab] = useState<Tab>('pending')
  const [reviews, setReviews] = useState<Review[]>([])
  const [pendingCount, setPendingCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async (t: Tab) => {
    setLoading(true)
    const res = await fetch(`/api/admin/reviews?status=${t}`)
    const body = await res.json()
    if (res.ok) { setReviews(body.reviews); setPendingCount(body.pendingCount); setError('') } else setError(body.error || 'Could not load reviews')
    setLoading(false)
  }, [])
  useEffect(() => { load(tab) }, [tab, load])

  async function decide(id: string, status: 'approved' | 'hidden') {
    const res = await fetch('/api/admin/reviews', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) })
    if (!res.ok) { setError((await res.json().catch(() => ({}))).error || 'Could not save'); return }
    setReviews(r => r.filter(x => x.id !== id))
    if (tab === 'pending') setPendingCount(c => Math.max(0, c - 1))
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px', backgroundColor: '#fafafa', color: '#1a1a1a' }}>
      <h1 style={{ margin: '0 0 4px', fontSize: '22px', fontWeight: 700, color: '#1a1a1a' }}>Reviews</h1>
      <p style={{ margin: '0 0 18px', fontSize: '14px', color: '#1a1a1a', maxWidth: '640px', lineHeight: 1.5 }}>
        Children’s written comments appear on the book page once you approve them. Their stars and category ratings show straight away.
      </p>

      <div style={{ display: 'flex', gap: '6px', marginBottom: '18px' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ ...btn(tab === t.key), borderRadius: '999px' }}>
            {t.label}{t.key === 'pending' && pendingCount > 0 ? ` (${pendingCount})` : ''}
          </button>
        ))}
      </div>

      {error && <p style={{ margin: '0 0 16px', padding: '10px 14px', borderRadius: '8px', fontSize: '14px', backgroundColor: '#fdecea', color: '#b3261e' }}>{error}</p>}

      {loading ? <p style={{ fontSize: '14px' }}>Loading…</p> : reviews.length === 0 ? (
        <p style={{ fontSize: '14px' }}>{tab === 'pending' ? 'Nothing waiting — all caught up.' : tab === 'approved' ? 'No approved comments yet.' : 'No hidden comments.'}</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '760px' }}>
          {reviews.map(r => {
            const child = r.child_profiles?.nickname || r.child_profiles?.name || 'A reader'
            const family = [r.child_profiles?.households?.first_name, r.child_profiles?.households?.last_name].filter(Boolean).join(' ')
            return (
              <div key={r.id} style={{ display: 'flex', gap: '14px', border: '1px solid #e5e5e5', borderRadius: '10px', padding: '16px', backgroundColor: '#fff' }}>
                {r.books?.cover_image_url
                  ? <img src={r.books.cover_image_url} alt="" style={{ width: '54px', height: '78px', objectFit: 'cover', borderRadius: '4px', flexShrink: 0 }} />
                  : <div style={{ width: '54px', height: '78px', borderRadius: '4px', backgroundColor: '#eee', flexShrink: 0 }} />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: '0 0 2px', fontSize: '14px', fontWeight: 700 }}>{r.books?.title || 'Unknown book'}</p>
                  <p style={{ margin: '0 0 8px', fontSize: '13px' }}>
                    <strong>{child}</strong>{family ? ` · ${family} family` : ''} · <span style={{ color: '#b07d00' }}>{stars(r.star_rating)}</span> · {when(r.created_at)}
                  </p>
                  <p style={{ margin: '0 0 12px', fontSize: '15px', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>“{r.review_text}”</p>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {r.moderation_status !== 'approved' && <button style={btn(true)} onClick={() => decide(r.id, 'approved')}>Approve</button>}
                    {r.moderation_status !== 'hidden' && <button style={btn()} onClick={() => decide(r.id, 'hidden')}>Hide</button>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
