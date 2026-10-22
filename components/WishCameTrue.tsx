'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

// On a child's profile: "Your wish came true!" — a book they asked for is now in the library.
// Stays until they act on it or close it, then never shows again.
type Wish = { requestIds: string[]; book: { id: string; title: string; author: string | null; cover_image_url: string | null } }

async function authed(path: string, init?: RequestInit) {
  const { data } = await supabase.auth.getSession()
  return fetch(path, { ...init, headers: { 'Content-Type': 'application/json', ...(data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {}), ...(init?.headers || {}) } })
}

export default function WishCameTrue({ childId, onOpen }: {
  childId: string
  onOpen: (bookId: string) => void   // opens the book page, where they can add it to a delivery
}) {
  const [wishes, setWishes] = useState<Wish[]>([])

  useEffect(() => {
    authed(`/api/book-requests/wishes?childId=${childId}`).then(r => r.json()).then(b => setWishes(b.wishes || [])).catch(() => {})
  }, [childId])

  const dismiss = (w: Wish) => {
    setWishes(list => list.filter(x => x.book.id !== w.book.id))
    authed('/api/book-requests/wishes', { method: 'POST', body: JSON.stringify({ ids: w.requestIds }) }).catch(() => {})
  }

  if (!wishes.length) return null
  const font = 'var(--font-montserrat), sans-serif'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', margin: '0 0 20px' }}>
      {wishes.map(w => {
        return (
          <div key={w.book.id} style={{ position: 'relative', display: 'flex', gap: '14px', alignItems: 'center', padding: '16px', borderRadius: '20px', backgroundColor: '#fffef9', border: '3px solid #fee297', boxShadow: '0 6px 20px rgba(26,47,81,0.12)' }}>
            <button onClick={() => dismiss(w)} aria-label="Close" style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(26,47,81,0.08)', border: 'none', borderRadius: '50%', width: '28px', height: '28px', cursor: 'pointer', color: '#1a2f51', fontSize: '0.85rem' }}>✕</button>
            {w.book.cover_image_url
              ? <img src={w.book.cover_image_url} alt="" style={{ width: '70px', height: '100px', objectFit: 'cover', borderRadius: '8px', flexShrink: 0 }} />
              : <div style={{ width: '70px', height: '100px', borderRadius: '8px', backgroundColor: 'rgba(26,47,81,0.08)', flexShrink: 0 }} />}
            <div style={{ flex: 1, minWidth: 0, paddingRight: '22px' }}>
              <p style={{ fontFamily: 'var(--font-patrick-hand)', fontSize: '1.5rem', color: '#1a2f51', margin: '0 0 2px', lineHeight: 1.1 }}>Your wish came true! ✨</p>
              <p style={{ fontFamily: font, fontSize: '0.9rem', color: '#1a2f51', margin: '0 0 10px', lineHeight: 1.4 }}>
                You asked for <strong>{w.book.title}</strong>, and now it’s in the library!
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                <button onClick={() => { dismiss(w); onOpen(w.book.id) }}
                  style={{ fontFamily: font, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#fff', backgroundColor: '#1a2f51', border: 'none', borderRadius: '999px', padding: '10px 18px', cursor: 'pointer' }}>
                  See the book
                </button>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
