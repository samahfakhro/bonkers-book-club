'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

// "Can't find it? Ask us to add it!" — parents and kids tell us a book or series they'd like in the library.
type Reader = { id: string; name: string }

export default function BookRequestSheet({ initialTitle = '', childId, readers = [], onClose }: {
  initialTitle?: string
  childId?: string | null          // set when a child is asking from their own profile
  readers?: Reader[]               // a parent can say which reader it's for
  onClose: () => void
}) {
  const kid = !!childId
  const [title, setTitle] = useState(initialTitle)
  const [author, setAuthor] = useState('')
  const [note, setNote] = useState('')
  const [forChild, setForChild] = useState<string | null>(childId ?? null)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const font = 'var(--font-montserrat), sans-serif'
  const field: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '13px 14px', borderRadius: '12px', border: '1px solid #ddd6cc', backgroundColor: '#fff', fontFamily: font, fontSize: '1rem', color: '#1a2744', outline: 'none' }
  const label: React.CSSProperties = { display: 'block', fontFamily: font, fontWeight: 700, fontSize: '0.8rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#1a2f51', margin: '0 0 6px' }

  async function send() {
    if (!title.trim()) { setError(kid ? 'What’s the book called?' : 'Tell us the name of the book or series.'); return }
    setSending(true); setError('')
    const { data } = await supabase.auth.getSession()
    const res = await fetch('/api/book-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {}) },
      body: JSON.stringify({ title, author, note, childId: forChild }),
    })
    const body = await res.json().catch(() => ({}))
    setSending(false)
    if (!res.ok) { setError(body.error || 'Something went wrong — please try again.'); return }
    setSent(true)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, backgroundColor: 'rgba(26,47,81,0.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: '576px', maxHeight: '90vh', overflowY: 'auto', backgroundColor: '#fefaf2', borderRadius: '24px 24px 0 0', padding: '26px 22px 36px', boxShadow: '0 -8px 32px rgba(26,47,81,0.2)', position: 'relative' }}>
        <button onClick={onClose} aria-label="Close" style={{ position: 'absolute', top: '16px', right: '16px', background: 'rgba(26,47,81,0.08)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', color: '#1a2f51', fontSize: '1rem' }}>✕</button>

        {sent ? (
          <div style={{ textAlign: 'center', padding: '12px 4px 4px' }}>
            <img src="/sparklestar_yellow.png" alt="" style={{ width: '48px', height: '48px', marginBottom: '10px' }} />
            <p style={{ fontFamily: 'var(--font-patrick-hand)', fontSize: '1.8rem', color: '#1a2f51', margin: '0 0 8px' }}>Thank you!</p>
            <p style={{ fontFamily: font, fontSize: '0.95rem', color: '#1a2f51', lineHeight: 1.6, margin: '0 0 22px' }}>
              We’ve got your request for <strong>{title.trim()}</strong>. If we add it to the library, we’ll let you know.
            </p>
            <button onClick={onClose} style={{ fontFamily: font, fontWeight: 600, fontSize: '0.85rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#fff', backgroundColor: '#1a2f51', border: 'none', borderRadius: '999px', padding: '14px 36px', cursor: 'pointer' }}>Done</button>
          </div>
        ) : (
          <>
            <p style={{ fontFamily: 'var(--font-patrick-hand)', fontSize: '1.8rem', color: '#1a2f51', margin: '0 40px 4px 0', lineHeight: 1.15 }}>
              {kid ? 'Which book do you wish we had?' : 'Ask us to add a book'}
            </p>
            <p style={{ fontFamily: font, fontSize: '0.95rem', color: '#1a2f51', lineHeight: 1.55, margin: '0 0 20px' }}>
              {kid ? 'Tell us and we’ll try to get it for the library!' : 'Tell us a book or series you’d love to see in the library and we’ll do our best to add it.'}
            </p>

            <label style={label} htmlFor="req-title">{kid ? 'Book name' : 'Book or series name'}</label>
            <input id="req-title" style={{ ...field, marginBottom: '16px' }} value={title} onChange={e => { setTitle(e.target.value); setError('') }} placeholder="e.g. Dog Man" />

            <label style={label} htmlFor="req-author">Author <span style={{ textTransform: 'none', fontWeight: 400 }}>(if you know it)</span></label>
            <input id="req-author" style={{ ...field, marginBottom: '16px' }} value={author} onChange={e => setAuthor(e.target.value)} placeholder="e.g. Dav Pilkey" />

            {!kid && readers.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <span style={label}>Who is it for? <span style={{ textTransform: 'none', fontWeight: 400 }}>(optional)</span></span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {[{ id: '', name: 'Whole family' }, ...readers].map(r => {
                    const on = (forChild ?? '') === r.id
                    return (
                      <button key={r.id || 'all'} type="button" onClick={() => setForChild(r.id || null)}
                        style={{ fontFamily: font, fontSize: '0.9rem', fontWeight: on ? 700 : 500, color: on ? '#fff' : '#1a2f51', backgroundColor: on ? '#1a2f51' : '#fff', border: on ? '2px solid #1a2f51' : '2px solid #e8e0d4', borderRadius: '999px', padding: '7px 14px', cursor: 'pointer' }}>
                        {r.name}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            <label style={label} htmlFor="req-note">{kid ? 'Why do you want it?' : 'Anything else?'} <span style={{ textTransform: 'none', fontWeight: 400 }}>(optional)</span></label>
            <textarea id="req-note" style={{ ...field, minHeight: '76px', resize: 'none', marginBottom: '18px' }} value={note} onChange={e => setNote(e.target.value)}
              placeholder={kid ? 'e.g. I loved the first one!' : 'e.g. my son loves the first one'} />

            {error && <p style={{ fontFamily: font, color: '#e05c3a', fontSize: '0.9rem', margin: '-6px 0 14px' }}>{error}</p>}
            <button onClick={send} disabled={sending}
              style={{ width: '100%', fontFamily: font, fontWeight: 600, fontSize: '0.85rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#fff', backgroundColor: '#1a2f51', border: 'none', borderRadius: '999px', padding: '15px', cursor: sending ? 'default' : 'pointer', opacity: sending ? 0.6 : 1 }}>
              {sending ? 'Sending…' : 'Send request'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
