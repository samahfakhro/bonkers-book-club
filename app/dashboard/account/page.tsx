'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const AVATARS = [
  { id: 'lion', emoji: '🦁', bg: '#FCD34D' },
  { id: 'elephant', emoji: '🐘', bg: '#93C5FD' },
  { id: 'fox', emoji: '🦊', bg: '#FB923C' },
  { id: 'owl', emoji: '🦉', bg: '#A78BFA' },
  { id: 'bear', emoji: '🐻', bg: '#86EFAC' },
  { id: 'bunny', emoji: '🐰', bg: '#F9A8D4' },
  { id: 'tiger', emoji: '🐯', bg: '#FDE68A' },
  { id: 'penguin', emoji: '🐧', bg: '#BAE6FD' },
]

type Child = {
  id: string
  name: string
  nickname: string | null
  avatar_id: string | null
  date_of_birth: string | null
}

type Parent = {
  firstName: string
  avatarId: string
}

export default function AccountPage() {
  const router = useRouter()
  const pathname = usePathname()
  const [parent, setParent] = useState<Parent | null>(null)
  const [children, setChildren] = useState<Child[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: hh } = await supabase.from('households').select('*').eq('user_id', user.id).single()
      if (!hh) { setLoading(false); return }
      setParent({ firstName: hh.first_name || '', avatarId: hh.avatar_id || '' })
      const { data: kids } = await supabase.from('child_profiles').select('id, name, nickname, avatar_id, date_of_birth').eq('household_id', hh.id).order('created_at')
      setChildren(kids || [])
      setLoading(false)
    }
    load()
  }, [])

  const parentAvatar = AVATARS.find(a => a.id === parent?.avatarId)

  const isActive = (path: string, exact = false) =>
    exact ? pathname === path : pathname.startsWith(path)

  return (
    <main className="min-h-screen pb-32" style={{ backgroundColor: '#080402' }}>
      <div style={{ position: 'absolute', top: '20px', left: '20px', lineHeight: 1, zIndex: 10 }}>
        <p style={{ fontFamily: 'var(--font-amatic)', fontWeight: 700, fontSize: '3rem', color: '#eddbc3', letterSpacing: '0.04em', margin: 0 }}>BONKERS</p>
        <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600, fontSize: '0.5rem', color: '#eddbc3', letterSpacing: '0.18em', textTransform: 'uppercase', margin: '2px 0 0' }}>THE CHILDREN'S LIBRARY</p>
      </div>

      <div className="max-w-lg mx-auto px-5" style={{ paddingTop: '100px' }}>
        {loading ? (
          <p style={{ color: '#eddbc3', opacity: 0.5, fontFamily: 'var(--font-montserrat), sans-serif', textAlign: 'center', marginTop: '60px' }}>Loading…</p>
        ) : (
          <>
            {/* Parent row */}
            <div className="flex items-center gap-4" style={{ marginBottom: '48px' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: parentAvatar?.bg || 'rgba(237,219,195,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', flexShrink: 0, border: '3px solid rgba(237,219,195,0.2)' }}>
                {parentAvatar?.emoji || <span style={{ fontFamily: 'var(--font-cormorant), serif', color: '#eddbc3', fontSize: '1.6rem', fontWeight: 700 }}>{parent?.firstName?.[0] || '?'}</span>}
              </div>
              <div>
                <p style={{ fontFamily: 'var(--font-amatic)', fontWeight: 700, color: '#eddbc3', fontSize: '2.2rem', letterSpacing: '0.04em', margin: 0, lineHeight: 1 }}>{parent?.firstName}</p>
              </div>
            </div>

            {/* Section heading */}
            <div style={{ marginBottom: '20px' }}>
              <p style={{ fontFamily: 'var(--font-amatic)', fontWeight: 700, color: '#eddbc3', fontSize: '2.2rem', letterSpacing: '0.04em', margin: 0, lineHeight: 1 }}>Your readers</p>
            </div>

            {/* Child cards */}
            {children.length === 0 ? (
              <div style={{ textAlign: 'center', marginTop: '40px' }}>
                <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#eddbc3', opacity: 0.5, fontSize: '0.9rem', marginBottom: '20px' }}>No readers yet.</p>
                <button onClick={() => router.push('/dashboard/children/new')}
                  style={{ backgroundImage: 'url(/button2.png)', backgroundSize: '300% 300%', backgroundPosition: 'center', backgroundRepeat: 'no-repeat', backgroundColor: 'transparent', border: 'none', borderRadius: '999px', cursor: 'pointer', padding: '14px 32px' }}>
                  <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600, fontSize: '0.85rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#fff' }}>Add a Reader</span>
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {children.map(child => (
                  <button key={child.id} onClick={() => router.push(`/dashboard/children/${child.id}`)}
                    className="text-left"
                    style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(237,219,195,0.15)', borderRadius: '20px', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer', width: '100%', transition: 'border-color 0.15s' }}>
                    <div style={{ width: '60px', height: '60px', borderRadius: '50%', backgroundColor: 'rgba(237,219,195,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                      <span style={{ fontFamily: 'var(--font-cormorant), serif', color: '#eddbc3', fontSize: '1.6rem', fontWeight: 700 }}>{(child.nickname || child.name)?.[0]}</span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontFamily: 'var(--font-cormorant), serif', fontWeight: 700, color: '#eddbc3', fontSize: '1.8rem', margin: 0, lineHeight: 1.1 }}>{child.nickname || child.name}</p>
                    </div>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(237,219,195,0.4)" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
                  </button>
                ))}

                <button onClick={() => router.push('/dashboard/children/new')}
                  style={{ backgroundColor: 'transparent', border: '1px dashed rgba(237,219,195,0.25)', borderRadius: '20px', padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', cursor: 'pointer', width: '100%' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(237,219,195,0.4)" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#eddbc3', opacity: 0.4, fontSize: '0.85rem' }}>Add another reader</span>
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── BOTTOM NAV ── */}
      <div className="fixed bottom-0 left-0 right-0" style={{ backgroundColor: 'rgb(8,4,2)', borderTop: '1px solid rgba(237,219,195,0.12)', zIndex: 40 }}>
        <div className="max-w-xl mx-auto flex items-center justify-around px-2 py-2">
          {[
            { label: 'Home', path: '/dashboard', exact: true, icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>, onClick: () => router.push('/dashboard') },
            { label: 'Library', path: '/dashboard/library', exact: false, icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>, onClick: () => router.push('/dashboard/library') },
            { label: 'Account', path: '/dashboard/account', exact: false, icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>, onClick: () => router.push('/dashboard/account') },
            { label: 'Settings', path: '/dashboard/settings', exact: false, icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>, onClick: () => router.push('/dashboard/settings') },
          ].map(item => {
            const active = isActive(item.path, item.exact)
            return (
              <button key={item.label} onClick={item.onClick}
                className="flex flex-col items-center gap-0.5 px-3 py-1"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: active ? '#f9d174' : 'rgba(237,219,195,0.4)', minWidth: '56px' }}>
                {item.icon}
                <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.6rem', letterSpacing: '0.06em', fontWeight: active ? 700 : 400 }}>{item.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </main>
  )
}
