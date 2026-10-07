'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const errStyle = { fontFamily: 'var(--font-montserrat), sans-serif', color: '#e57451', fontSize: '0.95rem', marginTop: '4px', paddingLeft: '4px' }

  const handleForgotPassword = async () => {
    if (!email) { setFieldErrors(prev => ({ ...prev, email: 'Please enter your email address first.' })); return }
    setFieldErrors({})
    await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` })
    setResetSent(true)
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthError('')

    const errors: Record<string, string> = {}
    if (!email) errors.email = 'Please enter your email address.'
    if (!password) errors.password = 'Please enter your password.'

    if (Object.keys(errors).length > 0) { setFieldErrors(errors); return }
    setFieldErrors({})

    setLoading(true)
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) { setAuthError(error.message); return }
    router.push('/dashboard')
  }

  const inputClass = "w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-amber-400 bg-[#fcf7eb]"

  return (
    <main className="min-h-screen flex flex-col items-center justify-start px-4 py-12" style={{ backgroundColor: '#fefaf2', paddingTop: 'max(3rem, env(safe-area-inset-top))', position: 'relative' }}>
      <div style={{ position: 'absolute', top: '20px', left: '20px', lineHeight: 1, zIndex: 10 }}>
        <p style={{ fontFamily: 'var(--font-amatic)', fontWeight: 700, fontSize: '3rem', color: '#1a2f51', letterSpacing: '0.04em', margin: 0 }}>BONKERS</p>
        <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600, fontSize: '0.5rem', color: '#1a2f51', letterSpacing: '0.18em', textTransform: 'uppercase', margin: '2px 0 0' }}>THE CHILDREN'S LIBRARY</p>
      </div>
      <div className="w-full max-w-sm px-6" style={{ paddingTop: '48px' }}>
        <div style={{ marginBottom: '24px', marginTop: '60px' }}>
          <h1 style={{ fontFamily: 'var(--font-cormorant), serif', fontWeight: 700, fontSize: '2.2rem', color: '#1a2f51', margin: 0, lineHeight: 1.1 }}>
            Log in to Bonkers
          </h1>
        </div>

        {authError && (
          <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm mb-4">
            {authError}
          </div>
        )}

        <form onSubmit={handleLogin} noValidate className="flex flex-col gap-3">
          <div>
            <label style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#1a2f51', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Email</label>
            <input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={e => { setEmail(e.target.value); setFieldErrors(prev => ({ ...prev, email: '' })) }}
              className={inputClass}
            />
            {fieldErrors.email && <p style={errStyle}>{fieldErrors.email}</p>}
          </div>
          <div>
            <label style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#1a2f51', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={e => { setPassword(e.target.value); setFieldErrors(prev => ({ ...prev, password: '' })) }}
                className={inputClass}
                style={{ paddingRight: '44px' }}
              />
              <button type="button" onClick={() => setShowPassword(p => !p)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#1a1a1a', opacity: 0.4 }}>
                {showPassword
                  ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                }
              </button>
            </div>
            {fieldErrors.password && <p style={errStyle}>{fieldErrors.password}</p>}
            <button type="button" onClick={handleForgotPassword} className="mt-1 text-right w-full" style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#1a2f51', fontSize: '0.75rem', textDecoration: 'underline', opacity: 0.65 }}>
              Forgot password?
            </button>
            {resetSent && <p className="mt-1 text-right" style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#1a2f51', fontSize: '0.75rem' }}>Password reset email sent!</p>}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '8px' }}>
              <button
                type="submit"
                disabled={loading}
                style={{ backgroundColor: '#1a2f51', border: 'none', borderRadius: '999px', cursor: 'pointer', padding: '14px 40px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', opacity: loading ? 0.6 : 1 }}>
                <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600, fontSize: '0.85rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#fefaf2' }}>
                  {loading ? 'Logging in...' : 'Log In'}
                </span>
              </button>
          </div>
        </form>

        <p className="text-center" style={{ marginTop: '16px', fontFamily: 'var(--font-montserrat), sans-serif', color: '#1a2f51', fontSize: '0.8rem' }}>
          New here?{' '}
          <button onClick={() => router.push('/signup')} style={{ textDecoration: 'underline', color: '#1a2f51', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.8rem' }}>
            Join Bonkers
          </button>
        </p>
      </div>
    </main>
  )
}
