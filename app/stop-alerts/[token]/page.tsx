'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

// Opened from the "Stop alerts for this book" link in a back-on-the-shelf email. No login needed.
export default function StopAlertsPage() {
  const { token } = useParams<{ token: string }>()
  const [state, setState] = useState<{ title?: string; stopped?: boolean; error?: string } | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    fetch(`/api/stop-alerts/${token}`).then(r => r.json()).then(setState).catch(() => setState({ error: 'No connection — please try again' }))
  }, [token])

  const stop = async () => {
    setBusy(true)
    const r = await fetch(`/api/stop-alerts/${token}`, { method: 'POST' })
    setState(await r.json().catch(() => ({ error: 'Something went wrong' })))
    setBusy(false)
  }

  const text: React.CSSProperties = { fontFamily: 'var(--font-montserrat), sans-serif', color: '#1a2f51', fontSize: '0.95rem', lineHeight: 1.55 }
  return (
    <main style={{ minHeight: '100vh', padding: '28px 20px', background: '#fefaf2' }}>
      <p style={{ fontFamily: 'var(--font-amatic)', fontWeight: 700, fontSize: '2.4rem', color: '#1a2744', margin: 0, lineHeight: 1 }}>BONKERS</p>
      <p style={{ ...text, fontSize: '0.55rem', fontWeight: 600, letterSpacing: '0.18em', margin: '2px 0 0' }}>THE CHILDREN’S LIBRARY</p>
      <div style={{ maxWidth: '420px', marginTop: '36px' }}>
        {!state && <p style={{ ...text, opacity: 0.6 }}>Loading…</p>}
        {state?.error && <p style={{ ...text, color: '#e05c3a' }}>{state.error}</p>}
        {state?.stopped && <p style={{ ...text, fontWeight: 700 }}>✓ Done — we won’t send any more alerts for this book.</p>}
        {state?.title && !state.stopped && (
          <>
            <h1 style={{ fontFamily: 'var(--font-cormorant), serif', color: '#1a2f51', fontSize: '2rem', margin: '0 0 12px' }}>Stop alerts?</h1>
            <p style={text}>We’ll stop letting you know when <strong>{state.title}</strong> is back on the shelf.</p>
            <button onClick={stop} disabled={busy} style={{ marginTop: '18px', backgroundColor: '#1a2f51', border: 'none', borderRadius: '999px', padding: '14px 32px', cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>
              <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600, fontSize: '0.8rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#fff' }}>{busy ? 'Stopping…' : 'Stop alerts'}</span>
            </button>
          </>
        )}
      </div>
    </main>
  )
}
