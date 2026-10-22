'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import CuriousLogo from '@/components/CuriousLogo'

// Pre-launch: the site is only open to our team and test families.
export default function LockedPage() {
  return <Suspense fallback={null}><Locked /></Suspense>
}

function Locked() {
  const params = useSearchParams()
  const [attempt, setAttempt] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const font = 'var(--font-montserrat), sans-serif'

  async function enter(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setError('')
    const res = await fetch('/api/site-lock', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ attempt }) })
    if (!res.ok) { setBusy(false); setError('That password isn’t right — please try again.'); return }
    const next = params.get('next')
    window.location.href = next && next.startsWith('/') && !next.startsWith('//') ? next : '/'
  }

  return (
    <main style={{ minHeight: '100svh', backgroundColor: '#fefaf2', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', textAlign: 'center' }}>
      <CuriousLogo height={84} />
      <h1 style={{ fontFamily: 'var(--font-cormorant), serif', fontWeight: 700, color: '#1a2f51', fontSize: '2rem', margin: '28px 0 8px' }}>Coming soon</h1>
      <p style={{ fontFamily: font, color: '#1a2f51', fontSize: '0.98rem', lineHeight: 1.6, margin: '0 0 26px', maxWidth: '360px' }}>
        We’re putting the finishing touches to The Curious Library. If you’re helping us test, enter the password below.
      </p>
      <form onSubmit={enter} style={{ width: '100%', maxWidth: '340px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <input type="password" value={attempt} onChange={e => { setAttempt(e.target.value); setError('') }} placeholder="Password" autoFocus
          style={{ width: '100%', boxSizing: 'border-box', padding: '14px 16px', borderRadius: '12px', border: '1px solid #ddd6cc', backgroundColor: '#fff', fontFamily: font, fontSize: '1rem', color: '#1a2744', textAlign: 'center' }} />
        {error && <p style={{ fontFamily: font, color: '#e05c3a', fontSize: '0.9rem', margin: 0 }}>{error}</p>}
        <button type="submit" disabled={busy || !attempt}
          style={{ backgroundColor: '#1a2f51', color: '#fff', border: 'none', borderRadius: '999px', padding: '15px', fontFamily: font, fontWeight: 600, fontSize: '0.85rem', letterSpacing: '0.15em', textTransform: 'uppercase', cursor: 'pointer', opacity: busy || !attempt ? 0.6 : 1 }}>
          {busy ? 'One moment…' : 'Enter'}
        </button>
      </form>
    </main>
  )
}
