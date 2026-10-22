'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import CuriousLogo from '@/components/CuriousLogo'
import { canUsePage, HOME_FOR, loginEmailFor, type TeamRole } from '@/lib/team'

// Team login: staff sign in with their mobile number (or email) and the password set for them in Admin → Team.
export default function TeamLoginPage() {
  return <Suspense fallback={null}><TeamLogin /></Suspense>
}

function TeamLogin() {
  const router = useRouter()
  const params = useSearchParams()
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const font = 'var(--font-montserrat), sans-serif'
  const field: React.CSSProperties = { width: '100%', padding: '14px 16px', borderRadius: '12px', border: '1px solid #ddd6cc', backgroundColor: '#fff', fontFamily: font, fontSize: '1rem', color: '#1a2744', boxSizing: 'border-box' }
  const label: React.CSSProperties = { display: 'block', fontFamily: font, fontWeight: 700, fontSize: '0.8rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#1a2f51', marginBottom: '6px' }

  async function signIn(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!login.trim() || !password) { setError('Enter your mobile number and password.'); return }
    setLoading(true)
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email: loginEmailFor(login), password })
    if (authError || !data.user) { setLoading(false); setError('That mobile number and password don’t match. Ask your manager to reset your password if you’ve forgotten it.'); return }
    const { data: me } = await supabase.from('team_members').select('role, active').eq('user_id', data.user.id).maybeSingle()
    if (!me || !me.active) {
      await supabase.auth.signOut()
      setLoading(false)
      setError('This login doesn’t have team access. Please speak to your manager.')
      return
    }
    // back to the screen that sent them here, if their role covers it — otherwise their home screen
    const role = me.role as TeamRole
    const next = params.get('next')
    const safeNext = next && next.startsWith('/') && !next.startsWith('//') && canUsePage(role, next) ? next : null
    router.replace(safeNext || HOME_FOR[role])
  }

  return (
    <main style={{ minHeight: '100svh', backgroundColor: '#fefaf2', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 24px' }}>
      <CuriousLogo height={72} />
      <h1 style={{ fontFamily: 'var(--font-cormorant), serif', fontWeight: 700, color: '#1a2744', fontSize: '2rem', margin: '28px 0 6px' }}>Team login</h1>
      <p style={{ fontFamily: font, color: '#1a2f51', fontSize: '0.95rem', margin: '0 0 28px', textAlign: 'center' }}>For drivers, warehouse and admin staff.</p>

      <form onSubmit={signIn} style={{ width: '100%', maxWidth: '380px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
        <div>
          <label style={label} htmlFor="team-login">Mobile number</label>
          <input id="team-login" style={field} type="text" inputMode="tel" autoComplete="username" placeholder="050 123 4567" value={login} onChange={e => setLogin(e.target.value)} />
          <p style={{ fontFamily: font, fontSize: '0.78rem', color: '#1a2f51', opacity: 0.65, margin: '6px 0 0' }}>Or your email, if you were set up with one.</p>
        </div>
        <div>
          <label style={label} htmlFor="team-password">Password</label>
          <input id="team-password" style={field} type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} />
        </div>
        {error && <p style={{ fontFamily: font, color: '#e05c3a', fontSize: '0.9rem', margin: 0, lineHeight: 1.45 }}>{error}</p>}
        <button type="submit" disabled={loading}
          style={{ marginTop: '6px', backgroundColor: loading ? '#9aa3b5' : '#1a2f51', color: '#fff', border: 'none', borderRadius: '999px', padding: '16px', fontFamily: font, fontWeight: 600, fontSize: '0.9rem', letterSpacing: '0.15em', textTransform: 'uppercase', cursor: loading ? 'default' : 'pointer' }}>
          {loading ? 'Logging in…' : 'Log in'}
        </button>
      </form>
    </main>
  )
}
