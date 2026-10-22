'use client'

import { usePathname, useRouter } from 'next/navigation'

// The kids' bottom navigation — one copy, used on every child-facing screen.
// Matches the parent navigation's look; Home is the child's own profile, Library opens in child mode.
export default function ChildBottomNav({ childId }: { childId: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const home = `/dashboard/children/${childId}`
  const items = [
    { label: 'Home', active: pathname === home, onClick: () => router.push(home),
      icon: <svg className="nav-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg> },
    { label: 'Library', active: pathname.startsWith('/dashboard/library'), onClick: () => router.push(`/dashboard/library?from=child&childId=${childId}`),
      icon: <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg> },
  ]
  return (
    <div className="fixed bottom-0 left-0 right-0" style={{ backgroundColor: '#1a2f51', borderTop: 'none', zIndex: 55 }}>
      <div className="max-w-xl mx-auto flex items-center justify-around px-2" style={{ paddingTop: '8px', paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}>
        {items.map(item => (
          <button key={item.label} onClick={item.onClick} className="flex flex-col items-center gap-1 flex-1" style={{ background: 'none', border: 'none', cursor: 'pointer', color: item.active ? '#f9d174' : '#fefaf2', padding: '6px 0' }}>
            {item.icon}
            <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.58rem', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700 }}>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
