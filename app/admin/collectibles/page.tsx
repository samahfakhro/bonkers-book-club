'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

type CollectibleBook = {
  id: string
  title: string
  author: string
  cover_image_url: string | null
  collectible_status: string | null
  collectible_name: string | null
  collectible_concept: string | null
  collectible_lore: string | null
  collectible_image_url: string | null
  collectible_openai_response_id: string | null
  collectible_version: number | null
}

const btn: React.CSSProperties = {
  padding: '8px 18px', borderRadius: '6px', fontSize: '13px', fontWeight: 600,
  cursor: 'pointer', border: 'none', letterSpacing: '0.02em',
}

export default function CollectiblesPage() {
  const [books, setBooks] = useState<CollectibleBook[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<CollectibleBook | null>(null)
  const [working, setWorking] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [showFeedback, setShowFeedback] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('books')
      .select('id, title, author, cover_image_url, collectible_status, collectible_name, collectible_concept, collectible_lore, collectible_image_url, collectible_openai_response_id, collectible_version')
      .eq('collectible_status', 'awaiting_approval')
      .order('title')
    setBooks(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  async function approve(book: CollectibleBook) {
    setWorking(true)
    const res = await fetch('/api/admin/generate-collectible', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookId: book.id, action: 'approve' }),
    })
    if (res.ok) {
      showToast(`✓ Approved "${book.collectible_name}"`)
      setSelected(null)
      setBooks(prev => prev.filter(b => b.id !== book.id))
    }
    setWorking(false)
  }

  async function reject(book: CollectibleBook) {
    setWorking(true)
    const res = await fetch('/api/admin/generate-collectible', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookId: book.id, action: 'reject' }),
    })
    if (res.ok) {
      showToast(`Rejected — collectible cleared for "${book.title}"`)
      setSelected(null)
      setBooks(prev => prev.filter(b => b.id !== book.id))
    }
    setWorking(false)
  }

  async function regenerate(book: CollectibleBook, mode: 'retry' | 'revise', feedbackText?: string) {
    setWorking(true)
    setShowFeedback(false)
    setFeedback('')
    const res = await fetch('/api/admin/generate-collectible', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bookId: book.id,
        mode,
        previousResponseId: book.collectible_openai_response_id,
        feedback: feedbackText,
      }),
    })
    const json = await res.json()
    if (res.ok) {
      const updated: CollectibleBook = {
        ...book,
        collectible_name: json.collectible_name,
        collectible_concept: json.collectible_concept,
        collectible_lore: json.collectible_lore,
        collectible_image_url: json.collectible_image_url,
        collectible_openai_response_id: json.collectible_openai_response_id,
        collectible_version: json.collectible_version,
      }
      setSelected(updated)
      setBooks(prev => prev.map(b => b.id === book.id ? updated : b))
    } else {
      showToast(`Generation failed: ${json.error}`)
    }
    setWorking(false)
  }

  return (
    <div style={{ padding: '32px', fontFamily: 'ui-sans-serif, system-ui, sans-serif', maxWidth: '1200px', margin: '0 auto' }}>
      {toast && (
        <div style={{ position: 'fixed', top: '20px', right: '20px', backgroundColor: '#1a1a1a', color: '#fff', padding: '10px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, zIndex: 100 }}>
          {toast}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: '#1a1a1a' }}>Awaiting Approval</h1>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#9b9b9b' }}>{books.length} collectible{books.length !== 1 ? 's' : ''} waiting for review</p>
        </div>
        <a href="/admin/books" style={{ fontSize: '13px', color: '#6b7280', textDecoration: 'none' }}>← Back to Books</a>
      </div>

      {loading ? (
        <p style={{ color: '#9b9b9b', fontSize: '14px' }}>Loading…</p>
      ) : books.length === 0 ? (
        <p style={{ color: '#9b9b9b', fontSize: '14px' }}>No collectibles awaiting approval.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '16px' }}>
          {books.map(book => (
            <button key={book.id} onClick={() => { setSelected(book); setShowFeedback(false); setFeedback('') }}
              style={{ background: 'none', border: '1.5px solid #e5e5e5', borderRadius: '12px', cursor: 'pointer', padding: '14px', textAlign: 'left', transition: 'border-color 0.15s', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ width: '44px', height: '66px', borderRadius: '4px', overflow: 'hidden', flexShrink: 0, backgroundColor: '#f0f0f0' }}>
                  {book.cover_image_url && <img src={book.cover_image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                </div>
                <div style={{ width: '66px', height: '66px', borderRadius: '8px', overflow: 'hidden', flexShrink: 0, backgroundColor: '#f7f0ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {book.collectible_image_url
                    ? <img src={book.collectible_image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    : <span style={{ fontSize: '24px' }}>✦</span>}
                </div>
              </div>
              <div>
                <p style={{ margin: 0, fontSize: '12px', fontWeight: 700, color: '#1a1a1a', lineHeight: 1.3 }}>{book.title}</p>
                <p style={{ margin: '3px 0 0', fontSize: '11px', color: '#7c3aed', fontWeight: 600 }}>{book.collectible_name || '—'}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* ── Detail modal ── */}
      {selected && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}
          onClick={e => { if (e.target === e.currentTarget) setSelected(null) }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '16px', maxWidth: '680px', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '28px' }}>
            <div style={{ display: 'flex', gap: '24px', marginBottom: '24px' }}>
              {/* Book cover */}
              <div style={{ flexShrink: 0 }}>
                <p style={{ margin: '0 0 6px', fontSize: '11px', fontWeight: 600, color: '#9b9b9b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Book</p>
                <div style={{ width: '80px', height: '120px', borderRadius: '6px', overflow: 'hidden', backgroundColor: '#f0f0f0' }}>
                  {selected.cover_image_url && <img src={selected.cover_image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                </div>
                <p style={{ margin: '8px 0 0', fontSize: '12px', fontWeight: 700, color: '#1a1a1a', maxWidth: '80px', lineHeight: 1.3 }}>{selected.title}</p>
              </div>

              {/* Collectible */}
              <div style={{ flexShrink: 0 }}>
                <p style={{ margin: '0 0 6px', fontSize: '11px', fontWeight: 600, color: '#9b9b9b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Collectible</p>
                <div style={{ width: '160px', height: '160px', borderRadius: '10px', overflow: 'hidden', backgroundColor: '#f7f0ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {selected.collectible_image_url
                    ? <img src={selected.collectible_image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    : <span style={{ fontSize: '48px' }}>✦</span>}
                </div>
                {selected.collectible_version && <p style={{ margin: '4px 0 0', fontSize: '10px', color: '#9b9b9b', textAlign: 'center' }}>v{selected.collectible_version}</p>}
              </div>

              {/* Metadata */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 600, color: '#9b9b9b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Name</p>
                <p style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 700, color: '#7c3aed' }}>{selected.collectible_name || '—'}</p>

                <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 600, color: '#9b9b9b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Concept</p>
                <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#1a1a1a', lineHeight: 1.5 }}>{selected.collectible_concept || '—'}</p>

                <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 600, color: '#9b9b9b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Lore</p>
                <p style={{ margin: 0, fontSize: '13px', color: '#1a1a1a', fontStyle: 'italic' }}>"{selected.collectible_lore || '—'}"</p>
              </div>
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button onClick={() => approve(selected)} disabled={working}
                style={{ ...btn, backgroundColor: '#7c3aed', color: '#fff', opacity: working ? 0.6 : 1 }}>
                {working ? 'Working…' : '✓ Approve'}
              </button>
              <button onClick={() => regenerate(selected, 'retry')} disabled={working}
                style={{ ...btn, backgroundColor: '#f3f4f6', color: '#1a1a1a', opacity: working ? 0.6 : 1 }}>
                ↻ Another Idea
              </button>
              <button onClick={() => { setShowFeedback(s => !s); setFeedback('') }} disabled={working}
                style={{ ...btn, backgroundColor: '#f3f4f6', color: '#1a1a1a' }}>
                ✦ Tweak This
              </button>
              <button onClick={() => reject(selected)} disabled={working}
                style={{ ...btn, backgroundColor: '#f3f4f6', color: '#dc2626', opacity: working ? 0.6 : 1 }}>
                ✕ Reject
              </button>
              <button onClick={() => setSelected(null)}
                style={{ ...btn, backgroundColor: 'transparent', color: '#9b9b9b', marginLeft: 'auto' }}>
                Close
              </button>
            </div>

            {showFeedback && (
              <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <p style={{ margin: 0, fontSize: '12px', color: '#9b9b9b' }}>Keep the concept, refine the execution — e.g. "make the box turquoise" or "the penguins need to be crazier"</p>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <textarea
                    value={feedback}
                    onChange={e => setFeedback(e.target.value)}
                    placeholder='e.g. "Make the box turquoise and the penguins wilder"'
                    style={{ flex: 1, padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #e5e5e5', fontSize: '13px', fontFamily: 'inherit', resize: 'vertical', minHeight: '72px' }}
                  />
                  <button onClick={() => feedback.trim() && regenerate(selected, 'revise', feedback.trim())}
                    disabled={working || !feedback.trim()}
                    style={{ ...btn, backgroundColor: '#7c3aed', color: '#fff', alignSelf: 'flex-end', opacity: (!feedback.trim() || working) ? 0.5 : 1 }}>
                    Send
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
