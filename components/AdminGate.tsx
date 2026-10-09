'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { isAdminEmail } from '@/lib/admin-emails'
import { installAuthFetch } from '@/lib/auth-fetch'

// Wraps the admin and driver areas: only a signed-in admin sees anything.
export default function AdminGate({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [state, setState] = useState<'checking' | 'ok' | 'denied'>('checking')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace(`/login?next=${encodeURIComponent(pathname)}`); return }
      if (!isAdminEmail(session.user.email)) { setState('denied'); return }
      installAuthFetch()
      setState('ok')
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (state === 'ok') return <>{children}</>
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', color: '#4a4a4a', textAlign: 'center' }}>
      {state === 'checking' ? 'Checking access…' : (
        <div>
          <p style={{ fontWeight: 600, margin: '0 0 8px' }}>This area is for the Bonkers team only.</p>
          <a href="/dashboard" style={{ color: '#1a2f51' }}>Go to your dashboard</a>
        </div>
      )}
    </div>
  )
}
