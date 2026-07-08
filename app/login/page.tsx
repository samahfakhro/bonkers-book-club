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
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) { setAuthError(error.message); return }
    router.push('/dashboard')
  }

  const inputClass = "w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-amber-400 bg-[#efe7dd]"

  return (
    <main className="min-h-screen flex flex-col items-center justify-start px-4 py-12" style={{ backgroundImage: 'url(/background_3.png)', backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed', paddingTop: 'max(3rem, env(safe-area-inset-top))' }}>
      <div className="w-full max-w-sm px-6">
        <img src="/Bonkers_Word_Logo_White1.png" alt="Bonkers Book Club" style={{ width: '160px', height: 'auto', display: 'block', margin: '0 auto 12px' }} />
        <img src="/bonky_door.png" alt="" style={{ width: '80%', height: 'auto', display: 'block', margin: '0 auto 20px' }} />

        <h1 className="text-center font-black mb-6" style={{ fontFamily: 'var(--font-cormorant), serif', color: '#eddbc3', fontSize: '2rem', lineHeight: 1.1 }}>
          Welcome back!
        </h1>

        {authError && (
          <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm mb-4">
            {authError}
          </div>
        )}

        <form onSubmit={handleLogin} noValidate className="flex flex-col gap-3">
          <div>
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={e => { setEmail(e.target.value); setFieldErrors(prev => ({ ...prev, email: '' })) }}
              className={inputClass}
            />
            {fieldErrors.email && <p style={errStyle}>{fieldErrors.email}</p>}
          </div>
          <div>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={e => { setPassword(e.target.value); setFieldErrors(prev => ({ ...prev, password: '' })) }}
              className={inputClass}
            />
            {fieldErrors.password && <p style={errStyle}>{fieldErrors.password}</p>}
            <button type="button" onClick={handleForgotPassword} className="mt-1 text-right w-full" style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#eddbc3', fontSize: '0.75rem', textDecoration: 'underline' }}>
              Forgot password?
            </button>
            {resetSent && <p className="mt-1 text-right" style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#eddbc3', fontSize: '0.75rem' }}>Password reset email sent!</p>}
          </div>
          <div className="relative flex items-center justify-center mt-2" style={{ width: '71%', maxWidth: '260px', margin: '-8px auto 0' }}>
            <img src="/whiskers_left.png" alt="" style={{ position: 'absolute', left: '-15px', height: '50px', width: 'auto', zIndex: 1, pointerEvents: 'none' }} />
            <div style={{ position: 'relative', width: '100%', paddingBottom: 'calc(100% / 2.97)' }}>
              <button
                type="submit"
                disabled={loading}
                className="flex items-center justify-center border-none bg-transparent cursor-pointer disabled:opacity-60"
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', backgroundImage: 'url(/button2.png)', backgroundSize: '100% 100%', backgroundRepeat: 'no-repeat' }}
              >
                <span className="relative z-10 flex items-center text-2xl text-white" style={{ fontFamily: 'var(--font-amatic)', fontWeight: 700, letterSpacing: '0.04em', marginBottom: '5px' }}>
                  {loading ? 'Signing in...' : 'Sign In'}
                </span>
              </button>
            </div>
            <img src="/whiskers_right.png" alt="" style={{ position: 'absolute', right: '-15px', height: '50px', width: 'auto', zIndex: 1, pointerEvents: 'none' }} />
          </div>
        </form>

        <p className="text-center mt-1" style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#eddbc3', fontSize: '0.8rem' }}>
          Don&apos;t have an account?{' '}
          <button onClick={() => router.push('/?step=check')} style={{ textDecoration: 'underline', color: '#eddbc3' }}>
            Sign up
          </button>
        </p>
      </div>
    </main>
  )
}
