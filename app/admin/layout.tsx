'use client'

import { usePathname, useRouter } from 'next/navigation'

const NAV = [
  { label: 'Books', path: '/admin/books' },
  { label: 'Operations', path: '/admin/operations' },
  { label: 'Members', path: '/admin/members' },
  { label: 'Zones', path: '/admin/zones' },
  { label: 'Capacity', path: '/admin/capacity' },
  { label: 'Reports', path: '/admin/reports' },
  { label: 'Settings', path: '/admin/settings' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: '#ffffff', zIndex: 50,
      display: 'flex', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      {/* Sidebar */}
      <div style={{
        width: '180px', flexShrink: 0, backgroundColor: '#f7f7f7',
        borderRight: '1px solid #e5e5e5', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '18px 16px 14px', borderBottom: '1px solid #e5e5e5' }}>
          <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 700, color: '#9b9b9b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Admin</p>
        </div>
        <nav style={{ padding: '6px 0', flex: 1 }}>
          {NAV.map(item => {
            const active = pathname.startsWith(item.path)
            return (
              <button
                key={item.path}
                onClick={() => router.push(item.path)}
                style={{
                  width: '100%', textAlign: 'left', padding: '9px 16px',
                  background: active ? '#1a1a1a' : 'none',
                  color: active ? '#ffffff' : '#4a4a4a',
                  border: 'none', cursor: 'pointer',
                  fontSize: '0.85rem', fontWeight: active ? 600 : 400,
                }}
              >
                {item.label}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Page content */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </div>
  )
}
