'use client'

import { usePathname, useRouter } from 'next/navigation'
import AdminGate, { useTeamMember } from '@/components/AdminGate'
import { supabase } from '@/lib/supabase'
import { canUsePage, ROLE_LABEL } from '@/lib/team'

const NAV = [
  { label: 'Books', path: '/admin/books' },
  { label: 'Operations', path: '/admin/operations' },
  { label: 'Members', path: '/admin/members' },
  { label: 'Reviews', path: '/admin/reviews' },
  { label: 'Requests', path: '/admin/book-requests' },
  { label: 'Messages', path: '/admin/messages' },
  { label: 'Zones', path: '/admin/zones' },
  { label: 'Capacity', path: '/admin/capacity' },
  { label: 'Reports', path: '/admin/reports' },
  { label: 'Finance', path: '/admin/finance' },
  { label: 'Team', path: '/admin/team' },
  { label: 'Settings', path: '/admin/settings' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminGate><AdminShell>{children}</AdminShell></AdminGate>
}

function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const me = useTeamMember()
  // each role only sees the tabs it can use (warehouse: Operations)
  const nav = NAV.filter(item => me && canUsePage(me.role, item.path))

  return (
    <div className="admin-root" style={{
      position: 'fixed', inset: 0, backgroundColor: '#ffffff', zIndex: 50,
      display: 'flex', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      {/* Sidebar */}
      <div style={{
        width: '180px', flexShrink: 0, backgroundColor: '#f7f7f7',
        borderRight: '1px solid #e5e5e5', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '18px 16px 14px', borderBottom: '1px solid #e5e5e5' }}>
          <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 700, color: '#1a1a1a', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Admin</p>
        </div>
        <nav style={{ padding: '6px 0', flex: 1 }}>
          {nav.map(item => {
            const active = pathname.startsWith(item.path)
            return (
              <button
                key={item.path}
                onClick={() => router.push(item.path)}
                style={{
                  width: '100%', textAlign: 'left', padding: '9px 16px',
                  background: active ? '#1a1a1a' : 'none',
                  color: active ? '#ffffff' : '#1a1a1a',
                  border: 'none', cursor: 'pointer',
                  fontSize: '0.85rem', fontWeight: active ? 600 : 400,
                }}
              >
                {item.label}
              </button>
            )
          })}
        </nav>
        {me && (
          <div style={{ padding: '12px 16px', borderTop: '1px solid #e5e5e5', fontSize: '0.75rem', color: '#1a1a1a' }}>
            <p style={{ margin: '0 0 2px', fontWeight: 600, color: '#1a1a1a' }}>{me.name}</p>
            <p style={{ margin: '0 0 8px' }}>{ROLE_LABEL[me.role]}</p>
            <button onClick={async () => { await supabase.auth.signOut(); router.replace('/team') }} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#1a2f51', textDecoration: 'underline', fontSize: '0.75rem' }}>Log out</button>
          </div>
        )}
      </div>

      {/* Page content */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </div>
  )
}
