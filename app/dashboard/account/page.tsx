'use client'

import { avatarRef } from '@/lib/avatars'
import AvatarPicker, { AvatarFace } from '@/components/AvatarPicker'
import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import CuriousLogo from '@/components/CuriousLogo'
import ParentBottomNav from '@/components/ParentBottomNav'


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

  const parentAvatar = avatarRef(parent?.avatarId)

  const isActive = (path: string, exact = false) =>
    exact ? pathname === path : pathname.startsWith(path)

  return (
    <main className="min-h-screen pb-32" style={{ backgroundColor: '#080402' }}>
      <div style={{ position: 'absolute', top: '24px', left: '20px', lineHeight: 1, zIndex: 10 }}>
        <CuriousLogo height={72} light />
      </div>

      <div className="max-w-lg mx-auto px-5" style={{ paddingTop: '100px' }}>
        {loading ? (
          <p style={{ color: '#eddbc3', opacity: 0.5, fontFamily: 'var(--font-montserrat), sans-serif', textAlign: 'center', marginTop: '60px' }}>Loading…</p>
        ) : (
          <>
            {/* Parent row */}
            <div className="flex items-center gap-4" style={{ marginBottom: '48px' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'rgba(237,219,195,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', flexShrink: 0, border: '3px solid rgba(237,219,195,0.2)' }}>
                <AvatarFace id={parentAvatar?.id} fallback={<span style={{ fontFamily: 'var(--font-cormorant), serif', color: '#eddbc3', fontSize: '1.6rem', fontWeight: 700 }}>{parent?.firstName?.[0] || '?'}</span>} />
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
      <ParentBottomNav />
    </main>
  )
}
