'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { installAuthFetch } from '@/lib/auth-fetch'
import { canUsePage, HOME_FOR, type TeamRole } from '@/lib/team'

type Me = { name: string; role: TeamRole; is_owner: boolean }
const TeamContext = createContext<Me | null>(null)
export const useTeamMember = () => useContext(TeamContext)

// Wraps the admin and driver areas: only active team members get in, and each role only sees its own screens.
export default function AdminGate({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [me, setMe] = useState<Me | null>(null)
  const [state, setState] = useState<'checking' | 'ok' | 'denied'>('checking')

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace(`/team?next=${encodeURIComponent(pathname)}`); return }
      const { data } = await supabase.from('team_members').select('name, role, is_owner, active').eq('user_id', session.user.id).maybeSingle()
      if (!data || !data.active) { setState('denied'); return }
      installAuthFetch()
      setMe({ name: data.name, role: data.role as TeamRole, is_owner: data.is_owner })
      setState('ok')
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // someone on a screen their role doesn't cover goes to their own home screen
  const allowed = !!me && canUsePage(me.role, pathname)
  useEffect(() => { if (me && !allowed) router.replace(HOME_FOR[me.role]) }, [me, allowed]) // eslint-disable-line react-hooks/exhaustive-deps

  if (state === 'ok' && allowed) return <TeamContext.Provider value={me}>{children}</TeamContext.Provider>
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', color: '#4a4a4a', textAlign: 'center' }}>
      {state === 'denied' ? (
        <div>
          <p style={{ fontWeight: 600, margin: '0 0 8px' }}>This area is for The Curious Library team only.</p>
          <a href="/dashboard" style={{ color: '#1a2f51' }}>Go to your dashboard</a>
        </div>
      ) : 'Checking access…'}
    </div>
  )
}
