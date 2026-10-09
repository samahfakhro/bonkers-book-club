'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// Shown when an admin has opened a family's account with "Log in as this family".
// Remembered for this browser tab, so it stays while moving between dashboard pages.
const KEY = 'bonkers-viewing-as'

export default function ViewingAsBanner() {
  const params = useSearchParams()
  const [name, setName] = useState<string | null>(null)

  useEffect(() => {
    try {
      const fromUrl = params.get('viewingAs')
      if (fromUrl) sessionStorage.setItem(KEY, fromUrl)
      setName(sessionStorage.getItem(KEY))
    } catch { /* storage blocked — no banner */ }
  }, [params])

  if (!name) return null
  const signOut = async () => {
    try { sessionStorage.removeItem(KEY) } catch {}
    await supabase.auth.signOut()
    window.location.href = '/login'
  }
  return (
    <div style={{ position: 'sticky', top: 0, zIndex: 1000, background: '#1a2744', color: '#fff', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '10px', fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.8rem' }}>
      <span style={{ flex: 1 }}>👀 You’re viewing <strong>{name}</strong>’s account as admin. Anything you change is real.</span>
      <button onClick={signOut} style={{ background: '#fee297', color: '#1a2744', border: 'none', borderRadius: '999px', padding: '6px 12px', fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>Sign out</button>
    </div>
  )
}
