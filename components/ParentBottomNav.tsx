'use client'

import { usePathname, useRouter } from 'next/navigation'

// The parent dashboard's bottom navigation — one copy, used on every parent screen.
export default function ParentBottomNav() {
  const router = useRouter()
  const pathname = usePathname()
  return (
    <div className="fixed bottom-0 left-0 right-0" style={{ backgroundColor: '#1a2f51', borderTop: 'none', zIndex: 55 }}>
      <div className="max-w-xl mx-auto flex items-center justify-around px-2" style={{ paddingTop: '8px', paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}>
        {[
          { label: 'Home', path: '/dashboard', exact: true, icon: <svg className="nav-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>, onClick: () => router.push('/dashboard') },
          { label: 'Library', path: '/dashboard/library', exact: false, icon: <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>, onClick: () => router.push('/dashboard/library?from=parent') },
          { label: 'Settings', path: '/dashboard/settings', exact: false, icon: <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>, onClick: () => router.push('/dashboard/settings') },
          { label: 'Support', path: '/dashboard/support', exact: false, icon: <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>, onClick: () => router.push('/dashboard/support') },
        ].map((item, i) => {
          const active = item.exact ? pathname === item.path : pathname.startsWith(item.path)
          return (
            <button key={i} onClick={item.onClick} className="flex flex-col items-center gap-1 flex-1" style={{ background: 'none', border: 'none', cursor: 'pointer', color: active ? '#f9d174' : '#fefaf2', opacity: 1, padding: '6px 0' }}>
              {item.icon}
              <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.58rem', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700 }}>{item.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
