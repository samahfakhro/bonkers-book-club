'use client'

import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'

const FAQS = [
  {
    category: 'How it works',
    items: [
      {
        q: 'How does Bonkers — The Children\'s Library work?',
        a: 'Every Bonkers Day, a fresh selection of books is delivered to your door. You choose which books you want before the cutoff, they arrive, your kids read them, and they go back in the next delivery. Simple.',
      },
      {
        q: 'How do I choose books?',
        a: 'Browse the library, save books you like, and add them to your coming next pile before the cutoff deadline. Once the cutoff passes, your selection is locked in for delivery.',
      },
      {
        q: 'What happens if I don\'t choose before the cutoff?',
        a: 'If you haven\'t selected books before the cutoff, we\'ll do our best to send something we think your readers will love based on their interests.',
      },
    ],
  },
  {
    category: 'Deliveries & Returns',
    items: [
      {
        q: 'When is my Bonkers Day?',
        a: 'Your Bonkers Day is shown at the top of your dashboard. It\'s the same day every week — set by your community.',
      },
      {
        q: 'How do I return books?',
        a: 'Mark any book as "Returning" on your dashboard. The books go back in the delivery bag on your next Bonkers Day.',
      },
      {
        q: 'What if a book is damaged?',
        a: 'Accidents happen! Just let us know via WhatsApp and we\'ll sort it out — no stress.',
      },
    ],
  },
  {
    category: 'My Account',
    items: [
      {
        q: 'How do I change my plan?',
        a: 'Head to Settings and tap on your current plan to see upgrade or change options.',
      },
      {
        q: 'Can I pause my subscription?',
        a: 'Yes — contact us via WhatsApp and we can pause your account for up to 4 weeks.',
      },
      {
        q: 'How do I add another child?',
        a: 'Tap "+ Add a Reader" on your dashboard home screen.',
      },
    ],
  },
]

export default function SupportPage() {
  const router = useRouter()
  const pathname = usePathname()
  const [openFaq, setOpenFaq] = useState<string | null>(null)

  const navItems = [
    { label: 'Home', path: '/dashboard', exact: true, icon: <svg className="nav-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>, onClick: () => router.push('/dashboard') },
    { label: 'Library', path: '/dashboard/library', exact: false, icon: <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>, onClick: () => router.push('/dashboard/library?from=parent') },
    { label: 'Settings', path: '/dashboard/settings', exact: false, icon: <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>, onClick: () => router.push('/dashboard/settings') },
    { label: 'Support', path: '/dashboard/support', exact: false, icon: <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>, onClick: () => router.push('/dashboard/support') },
  ]

  const heading: React.CSSProperties = { fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#1a2f51', margin: '0 0 12px' }

  return (
    <main style={{ minHeight: '100svh', backgroundColor: '#fefaf2', paddingBottom: 'calc(72px + env(safe-area-inset-bottom))' }}>
      <style>{`
        .nav-icon { width: 22px; height: 22px; }
        @media (min-width: 600px) { .nav-icon { width: 24px; height: 24px; } }
      `}</style>

      <div className="max-w-xl mx-auto px-5" style={{ paddingTop: '48px' }}>
        <h1 style={{ fontFamily: 'var(--font-cormorant), serif', fontWeight: 700, color: '#1a2f51', fontSize: '2.4rem', margin: '0 0 6px', lineHeight: 1 }}>Support</h1>
        <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#1a2f51', fontSize: '0.78rem', opacity: 0.5, margin: '0 0 32px' }}>We're here to help.</p>

        {/* Contact */}
        <section style={{ marginBottom: '32px' }}>
          <p style={heading}>Get in touch</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <a href="https://wa.me/971XXXXXXXXX" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '16px', borderRadius: '16px', border: '2px solid #e8e0d4', backgroundColor: 'transparent', textDecoration: 'none' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#25D366', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              </div>
              <div>
                <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 700, color: '#1a2f51', fontSize: '0.82rem', margin: 0 }}>WhatsApp us</p>
                <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#1a2f51', fontSize: '0.7rem', opacity: 0.5, margin: '2px 0 0' }}>Fastest way to reach us</p>
              </div>
            </a>
            <a href="mailto:hello@bonkersbookclub.com" style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '16px', borderRadius: '16px', border: '2px solid #e8e0d4', backgroundColor: 'transparent', textDecoration: 'none' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#1a2f51', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
              </div>
              <div>
                <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 700, color: '#1a2f51', fontSize: '0.82rem', margin: 0 }}>Email us</p>
                <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#1a2f51', fontSize: '0.7rem', opacity: 0.5, margin: '2px 0 0' }}>hello@bonkersbookclub.com</p>
              </div>
            </a>
          </div>
        </section>

        {/* FAQs */}
        {FAQS.map(group => (
          <section key={group.category} style={{ marginBottom: '28px' }}>
            <p style={heading}>{group.category}</p>
            <div style={{ borderRadius: '16px', border: '2px solid #e8e0d4', overflow: 'hidden' }}>
              {group.items.map((faq, i) => {
                const key = `${group.category}-${i}`
                const isOpen = openFaq === key
                return (
                  <div key={key}>
                    {i > 0 && <div style={{ borderTop: '1px solid #e8e0d4' }} />}
                    <button onClick={() => setOpenFaq(isOpen ? null : key)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                      <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600, color: '#1a2f51', fontSize: '0.8rem', margin: 0, lineHeight: 1.4 }}>{faq.q}</p>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1a2f51" strokeWidth="2.5" style={{ flexShrink: 0, opacity: 0.5, transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}><polyline points="6 9 12 15 18 9"/></svg>
                    </button>
                    {isOpen && (
                      <div style={{ padding: '0 16px 14px' }}>
                        <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#1a2f51', fontSize: '0.75rem', opacity: 0.65, margin: 0, lineHeight: 1.6 }}>{faq.a}</p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        ))}
      </div>

      {/* Bottom nav */}
      <div className="fixed bottom-0 left-0 right-0" style={{ backgroundColor: '#1a2f51', zIndex: 40 }}>
        <div className="max-w-xl mx-auto flex items-center justify-around px-2" style={{ paddingTop: '8px', paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}>
          {navItems.map((item, i) => {
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
    </main>
  )
}
