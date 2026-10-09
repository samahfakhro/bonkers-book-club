'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Message = { id: string; title: string | null; message: string | null; action_link: string | null; read_at: string | null; created_at: string }

function timeAgo(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'} ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return days === 1 ? 'Yesterday' : `${days} days ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

const navy = '#1a2f51'
const montserrat = 'var(--font-montserrat), sans-serif'

export default function MessagesPage() {
  const router = useRouter()
  const [messages, setMessages] = useState<Message[] | null>(null)

  useEffect(() => {
    supabase.from('notifications').select('id, title, message, action_link, read_at, created_at')
      .order('created_at', { ascending: false }).limit(100)
      .then(({ data }) => setMessages(data ?? []))
  }, [])

  const markRead = async (ids: string[]) => {
    if (!ids.length) return
    const now = new Date().toISOString()
    setMessages(m => m?.map(x => ids.includes(x.id) ? { ...x, read_at: x.read_at ?? now } : x) ?? null)
    await supabase.from('notifications').update({ read_at: now }).in('id', ids)
  }

  const open = async (m: Message) => {
    if (!m.read_at) await markRead([m.id])
    if (m.action_link) router.push(m.action_link)
  }

  const unreadIds = (messages ?? []).filter(m => !m.read_at).map(m => m.id)

  return (
    <main className="min-h-screen pb-28" style={{ backgroundColor: '#fefaf2' }}>
      <div className="max-w-xl mx-auto px-4 pt-6">
        <button onClick={() => router.push('/dashboard')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: navy, fontFamily: montserrat, fontSize: '0.8rem', padding: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
          ← Back
        </button>

        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '20px 0 20px' }}>
          <h1 style={{ fontFamily: 'var(--font-cormorant), serif', color: navy, fontSize: '2.4rem', fontWeight: 700, lineHeight: 1, margin: 0 }}>Messages</h1>
          {unreadIds.length > 0 && (
            <button onClick={() => markRead(unreadIds)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: navy, opacity: 0.7, fontFamily: montserrat, fontSize: '0.75rem', textDecoration: 'underline', padding: 0 }}>
              Mark all as read
            </button>
          )}
        </div>

        {messages === null && <p style={{ fontFamily: montserrat, color: navy, opacity: 0.6, fontSize: '0.85rem' }}>Loading…</p>}

        {messages?.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 16px' }}>
            <p style={{ fontSize: '2.4rem', margin: '0 0 8px' }}>📬</p>
            <p style={{ fontFamily: montserrat, color: navy, fontSize: '0.9rem', opacity: 0.75, margin: 0 }}>No messages yet. We&apos;ll pop updates here.</p>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {messages?.map(m => (
            <button key={m.id} onClick={() => open(m)}
              style={{ textAlign: 'left', width: '100%', padding: '14px 16px', borderRadius: '14px', border: `1px solid ${m.read_at ? '#ece4d6' : '#cfe6d7'}`, backgroundColor: m.read_at ? '#fffdf8' : '#f1f8f3', cursor: m.action_link ? 'pointer' : 'default', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <span style={{ width: '9px', height: '9px', borderRadius: '50%', backgroundColor: m.read_at ? 'transparent' : '#3f9a63', flexShrink: 0, marginTop: '6px' }} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'baseline' }}>
                  <span style={{ fontFamily: montserrat, fontWeight: m.read_at ? 600 : 700, fontSize: '0.88rem', color: navy }}>{m.title || 'Message from Bonkers'}</span>
                  <span style={{ fontFamily: montserrat, fontSize: '0.68rem', color: navy, opacity: 0.55, whiteSpace: 'nowrap' }}>{timeAgo(m.created_at)}</span>
                </span>
                {m.message && <span style={{ display: 'block', fontFamily: montserrat, fontSize: '0.8rem', color: navy, opacity: 0.8, lineHeight: 1.5, marginTop: '4px' }}>{m.message}</span>}
                {m.action_link && <span style={{ display: 'block', fontFamily: montserrat, fontSize: '0.75rem', fontWeight: 600, color: '#3f9a63', marginTop: '6px' }}>Open →</span>}
              </span>
            </button>
          ))}
        </div>
      </div>
    </main>
  )
}
