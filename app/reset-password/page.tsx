'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// Landing page for the "Forgot password?" email link. Supabase signs the parent in from the link,
// then they choose a new password here.
export default function ResetPasswordPage() {
  const router = useRouter()
  const [ready, setReady] = useState<'checking' | 'ok' | 'expired'>('checking')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (window.location.hash.includes('error=')) { setReady('expired'); return }
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) setReady('ok')
    })
    supabase.auth.getSession().then(({ data }) => { if (data.session) setReady('ok') })
    const t = setTimeout(() => setReady(r => r === 'checking' ? 'expired' : r), 5000)
    return () => { sub.subscription.unsubscribe(); clearTimeout(t) }
  }, [])

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (password !== confirm) { setError('The two passwords don’t match.'); return }
    setError(''); setSaving(true)
    const { error } = await supabase.auth.updateUser({ password })
    setSaving(false)
    if (error) { setError(error.message); return }
    setDone(true)
    setTimeout(() => router.push('/dashboard'), 1500)
  }

  const label: React.CSSProperties = { fontFamily: 'var(--font-montserrat), sans-serif', color: '#1a2f51', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }
  const text: React.CSSProperties = { fontFamily: 'var(--font-montserrat), sans-serif', color: '#1a2f51', fontSize: '0.9rem', lineHeight: 1.5 }
  const inputClass = "w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-amber-400 bg-[#fcf7eb]"

  return (
    <main className="min-h-screen flex flex-col items-center justify-start px-4 py-12" style={{ backgroundColor: '#fefaf2', paddingTop: 'max(3rem, env(safe-area-inset-top))', position: 'relative' }}>
      <div style={{ position: 'absolute', top: '24px', left: '20px', lineHeight: 1, zIndex: 10 }}>
        <p style={{ fontFamily: 'var(--font-amatic)', fontWeight: 700, fontSize: '3rem', color: '#1a2f51', letterSpacing: '0.04em', margin: 0 }}>BONKERS</p>
        <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600, fontSize: '0.5rem', color: '#1a2f51', letterSpacing: '0.18em', textTransform: 'uppercase', margin: '2px 0 0' }}>THE CHILDREN'S LIBRARY</p>
      </div>
      <div className="w-full max-w-sm px-6" style={{ paddingTop: '48px' }}>
        <h1 style={{ fontFamily: 'var(--font-cormorant), serif', fontWeight: 700, fontSize: '2.2rem', color: '#1a2f51', margin: '60px 0 20px', lineHeight: 1.1 }}>
          Choose a new password
        </h1>

        {ready === 'checking' && <p style={{ ...text, opacity: 0.6 }}>Just a moment…</p>}

        {ready === 'expired' && (
          <>
            <p style={text}>This link has expired or has already been used. Please go back to the log in page and tap <strong>Forgot password?</strong> again for a fresh link.</p>
            <button onClick={() => router.push('/login')} style={{ ...text, marginTop: '16px', textDecoration: 'underline', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>Back to log in</button>
          </>
        )}

        {ready === 'ok' && (done ? (
          <p style={{ ...text, fontWeight: 700, color: '#2e5c3a' }}>✓ Password changed — taking you to your dashboard…</p>
        ) : (
          <form onSubmit={save} noValidate className="flex flex-col gap-3">
            {error && <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm">{error}</div>}
            <div>
              <label style={label}>New password</label>
              <div style={{ position: 'relative' }}>
                <input type={showPassword ? 'text' : 'password'} autoComplete="new-password" placeholder="At least 8 characters" value={password}
                  onChange={e => setPassword(e.target.value)} className={inputClass} style={{ paddingRight: '64px' }} />
                <button type="button" onClick={() => setShowPassword(p => !p)}
                  style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.7rem', color: '#1a2f51', opacity: 0.6 }}>
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
            <div>
              <label style={label}>Type it again</label>
              <input type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} className={inputClass} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '8px' }}>
              <button type="submit" disabled={saving}
                style={{ backgroundColor: '#1a2f51', border: 'none', borderRadius: '999px', cursor: 'pointer', padding: '14px 40px', opacity: saving ? 0.6 : 1 }}>
                <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600, fontSize: '0.85rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#fefaf2' }}>
                  {saving ? 'Saving…' : 'Save password'}
                </span>
              </button>
            </div>
          </form>
        ))}
      </div>
    </main>
  )
}
