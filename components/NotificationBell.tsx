'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// Envelope on the parent dashboard (not a bell — the bell is Notify Me on books).
// Green count = unread messages. Security rules only return this family's messages.
export default function NotificationBell() {
  const router = useRouter()
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    supabase.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null)
      .then(({ count }) => setUnread(count ?? 0))
  }, [])

  return (
    <button onClick={() => router.push('/dashboard/notifications')} aria-label={unread ? `Messages, ${unread} unread` : 'Messages'}
      style={{ position: 'relative', background: 'none', border: 'none', cursor: 'pointer', padding: '10px 4px 0', lineHeight: 0 }}>
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1a2f51" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2.5" y="5" width="19" height="14" rx="2" />
        <polyline points="3 6.5 12 13 21 6.5" />
      </svg>
      {unread > 0 && (
        <span style={{ position: 'absolute', top: '3px', right: '-5px', minWidth: '18px', height: '18px', padding: '0 5px', borderRadius: '999px', backgroundColor: '#3f9a63', color: '#fff', fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.62rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, border: '2px solid #fefaf2' }}>
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </button>
  )
}
