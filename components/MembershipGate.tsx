'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import CuriousLogo from '@/components/CuriousLogo'
import ParentBottomNav from '@/components/ParentBottomNav'

// When a membership has ended, families can still log in: Settings (rejoin, details, delete account), Support,
// Messages and their children's profiles and worlds stay open. Everything else shows "Your membership has ended".
const OPEN_WHEN_ENDED = ['/dashboard/settings', '/dashboard/support', '/dashboard/notifications']
const isOpen = (path: string) =>
  OPEN_WHEN_ENDED.some(p => path === p || path.startsWith(p + '/')) ||
  (/^\/dashboard\/children\/[^/]+(\/universe)?$/.test(path) && !path.startsWith('/dashboard/children/new'))

export default function MembershipGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [ended, setEnded] = useState(false)
  const [readers, setReaders] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    let alive = true
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { data: hh } = await supabase.from('households').select('id').eq('user_id', session.user.id).maybeSingle()
      if (!hh) return
      const { data: subs } = await supabase.from('subscriptions').select('status').eq('household_id', hh.id)
      const isEnded = !!subs?.length && !subs.some(s => s.status !== 'cancelled')
      if (!alive) return
      setEnded(isEnded)
      if (isEnded) {
        const { data: kids } = await supabase.from('child_profiles').select('id, name, nickname').eq('household_id', hh.id)
        if (alive) setReaders((kids || []).map(k => ({ id: k.id, name: k.nickname || k.name })))
      }
    })()
    return () => { alive = false }
  }, [])

  if (!ended || isOpen(pathname)) return <>{children}</>

  const font = 'var(--font-montserrat), sans-serif'
  const navy = '#1a2f51'
  const btn: React.CSSProperties = { width: '100%', fontFamily: font, fontWeight: 600, fontSize: '0.82rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#fff', backgroundColor: navy, border: 'none', borderRadius: '999px', padding: '15px', cursor: 'pointer' }
  return (
    <main style={{ minHeight: '100svh', backgroundColor: '#fefaf2', padding: '32px 20px calc(110px + env(safe-area-inset-bottom))' }}>
      <div style={{ maxWidth: '480px', margin: '0 auto' }}>
        <CuriousLogo height={64} />
        <h1 style={{ fontFamily: 'var(--font-cormorant), serif', fontWeight: 700, color: navy, fontSize: '2.2rem', lineHeight: 1.1, margin: '28px 0 10px' }}>Your membership has ended</h1>
        <p style={{ fontFamily: font, color: navy, fontSize: '0.98rem', lineHeight: 1.6, margin: '0 0 24px' }}>
          Thank you for being part of The Curious Library. Your readers’ worlds, saved books and reading history are kept safe — you can rejoin any time and carry on right where you left off.
        </p>
        <button onClick={() => router.push('/dashboard/settings')} style={btn}>Rejoin or manage my account</button>

        {readers.length > 0 && (
          <section style={{ marginTop: '32px' }}>
            <p style={{ fontFamily: font, fontWeight: 700, fontSize: '0.8rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: navy, margin: '0 0 12px' }}>Your readers’ worlds</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {readers.map(r => (
                <button key={r.id} onClick={() => router.push(`/dashboard/children/${r.id}`)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', borderRadius: '16px', border: '2px solid #e8e0d4', backgroundColor: '#fffef9', cursor: 'pointer', textAlign: 'left' }}>
                  <span style={{ fontFamily: 'var(--font-cormorant), serif', fontWeight: 700, fontSize: '1.3rem', color: navy }}>{r.name}</span>
                  <span style={{ fontFamily: font, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: navy }}>Visit →</span>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
      <ParentBottomNav />
    </main>
  )
}
