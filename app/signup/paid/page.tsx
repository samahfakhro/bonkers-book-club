'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import CuriousLogo from '@/components/CuriousLogo'

// Where Stripe's payment page sends families back to: paid (or left without paying: ?cancelled=1)
function Paid() {
  const router = useRouter()
  const cancelled = useSearchParams().get('cancelled') === '1'
  const [signedIn, setSignedIn] = useState<boolean | null>(null)
  useEffect(() => { supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session)) }, [])

  const navy = '#1a2f51', font = 'var(--font-montserrat), sans-serif'
  const btn: React.CSSProperties = { width: '100%', fontFamily: font, fontWeight: 600, fontSize: '0.82rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#fff', backgroundColor: navy, border: 'none', borderRadius: '999px', padding: '15px', cursor: 'pointer', marginTop: '8px' }
  const p: React.CSSProperties = { fontFamily: font, color: navy, fontSize: '0.95rem', lineHeight: 1.7, margin: '0 0 16px' }

  return (
    <main style={{ minHeight: '100svh', backgroundColor: '#fefaf2', padding: '120px 24px 60px', position: 'relative' }}>
      <div style={{ position: 'absolute', top: '24px', left: '20px', lineHeight: 1, zIndex: 10 }}>
        <CuriousLogo height={72} />
      </div>
      <div style={{ maxWidth: '480px', margin: '0 auto', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '16px' }}>{cancelled ? '💳' : '🎉'}</div>
        <h1 style={{ fontFamily: 'var(--font-cormorant), serif', color: navy, fontSize: '2.4rem', fontWeight: 700, lineHeight: 1.1, margin: '0 0 14px' }}>
          {cancelled ? 'No payment taken' : 'Welcome to The Curious Library!'}
        </h1>
        {cancelled ? (
          <p style={p}>Your details are saved. Whenever you’re ready, log in and you’ll be able to finish setting up your membership.</p>
        ) : (
          <p style={p}>Your membership is set up.{signedIn === false && ' We’ve sent a confirmation link to your email. Click it to open your dashboard (check your spam folder if it doesn’t arrive within a minute).'}</p>
        )}
        {signedIn && <button style={btn} onClick={() => router.push('/dashboard')}>{cancelled ? 'Finish setting up' : 'Go to my dashboard'}</button>}
        {signedIn === false && cancelled && <button style={btn} onClick={() => router.push('/login')}>Log in</button>}
      </div>
    </main>
  )
}

export default function PaidPage() {
  return <Suspense><Paid /></Suspense>
}
