'use client'

import { useEffect, useMemo, useState } from 'react'
import { getPublicSettings } from '@/lib/public-settings'
import ParentBottomNav from '@/components/ParentBottomNav'
import CuriousLogo from '@/components/CuriousLogo'
import { HELP_TOPICS, searchHelp } from '@/lib/help-articles'

// Support: search the help answers, browse them by topic, or get in touch.
const font = 'var(--font-montserrat), sans-serif'
const heading: React.CSSProperties = { fontFamily: font, fontWeight: 700, fontSize: '0.8rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#1a2f51', margin: '0 0 12px' }

function Answer({ id, q, a, open, onToggle, topic }: { id: string; q: string; a: string; open: boolean; onToggle: (id: string) => void; topic?: string }) {
  return (
    <div>
      <button onClick={() => onToggle(id)} aria-expanded={open}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '15px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
        <span>
          {topic && <span style={{ display: 'block', fontFamily: font, fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#5a8a5a', marginBottom: '3px' }}>{topic}</span>}
          <span style={{ fontFamily: font, fontWeight: 600, color: '#1a2f51', fontSize: '0.95rem', lineHeight: 1.4 }}>{q}</span>
        </span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1a2f51" strokeWidth="2.5" style={{ flexShrink: 0, transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'none' }}><polyline points="6 9 12 15 18 9" /></svg>
      </button>
      {open && <p style={{ fontFamily: font, color: '#1a2f51', fontSize: '0.92rem', margin: 0, padding: '0 16px 16px', lineHeight: 1.6 }}>{a}</p>}
    </div>
  )
}

export default function SupportPage() {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  // contact details are set in admin → Settings
  const [contact, setContact] = useState<{ whatsapp: string; email: string }>({ whatsapp: '', email: 'hello@curiouslibrary.ae' })
  useEffect(() => { getPublicSettings().then(st => setContact({ whatsapp: st.contactWhatsapp, email: st.contactEmail })).catch(() => {}) }, [])
  const waDigits = contact.whatsapp.replace(/\D/g, '').replace(/^0/, '971')

  const results = useMemo(() => searchHelp(query), [query])
  const searching = query.trim().length > 1
  const toggle = (id: string) => setOpen(o => o === id ? null : id)
  const box: React.CSSProperties = { borderRadius: '16px', border: '2px solid #e8e0d4', overflow: 'hidden', backgroundColor: '#fffef9' }
  const divider = <div style={{ borderTop: '1px solid #e8e0d4' }} />

  return (
    <main style={{ minHeight: '100svh', backgroundColor: '#fefaf2', paddingBottom: 'calc(88px + env(safe-area-inset-bottom))' }}>
      <div style={{ padding: '24px 20px 0', lineHeight: 1 }}>
        <CuriousLogo height={72} />
      </div>
      <div className="max-w-xl mx-auto px-5" style={{ paddingTop: '24px' }}>
        <h1 style={{ fontFamily: 'var(--font-cormorant), serif', fontWeight: 700, color: '#1a2f51', fontSize: '2.4rem', margin: '0 0 6px', lineHeight: 1 }}>Support</h1>
        <p style={{ fontFamily: font, color: '#1a2f51', fontSize: '0.95rem', margin: '0 0 22px' }}>Ask a question, or browse the answers below.</p>

        {/* Search */}
        <div style={{ position: 'relative', marginBottom: '28px' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1a2f51" strokeWidth="2.2" style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          <input type="search" value={query} onChange={e => { setQuery(e.target.value); setOpen(null) }} placeholder="e.g. how do we return books?"
            style={{ width: '100%', boxSizing: 'border-box', padding: '15px 16px 15px 44px', borderRadius: '999px', border: '2px solid #e8e0d4', backgroundColor: '#fff', fontFamily: font, fontSize: '1rem', color: '#1a2744', outline: 'none' }} />
        </div>

        {searching ? (
          <section style={{ marginBottom: '32px' }}>
            {results.length > 0 ? (
              <>
                <p style={heading}>{results.length === 1 ? '1 answer' : `${results.length} answers`}</p>
                <div style={box}>
                  {results.map((r, i) => (
                    <div key={r.q}>{i > 0 && divider}<Answer id={`s-${r.q}`} q={r.q} a={r.a} topic={r.topic} open={open === `s-${r.q}`} onToggle={toggle} /></div>
                  ))}
                </div>
              </>
            ) : (
              <p style={{ fontFamily: font, color: '#1a2f51', fontSize: '0.95rem', lineHeight: 1.6, margin: 0 }}>
                We couldn’t find an answer for that. Try different words, or get in touch below and we’ll help.
              </p>
            )}
          </section>
        ) : HELP_TOPICS.map(t => (
          <section key={t.topic} style={{ marginBottom: '26px' }}>
            <p style={heading}>{t.topic}</p>
            <div style={box}>
              {t.articles.map((art, i) => (
                <div key={art.q}>{i > 0 && divider}<Answer id={`${t.topic}-${i}`} q={art.q} a={art.a} open={open === `${t.topic}-${i}`} onToggle={toggle} /></div>
              ))}
            </div>
          </section>
        ))}

        {/* Still stuck */}
        <section style={{ marginTop: '8px' }}>
          <p style={heading}>Still need help?</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {waDigits && <a href={`https://wa.me/${waDigits}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '16px', borderRadius: '16px', border: '2px solid #e8e0d4', backgroundColor: '#fffef9', textDecoration: 'none' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#25D366', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              </div>
              <div>
                <p style={{ fontFamily: font, fontWeight: 700, color: '#1a2f51', fontSize: '0.95rem', margin: 0 }}>WhatsApp us</p>
                <p style={{ fontFamily: font, color: '#1a2f51', fontSize: '0.85rem', margin: '2px 0 0' }}>Fastest way to reach us</p>
              </div>
            </a>}
            <a href={`mailto:${contact.email}`} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '16px', borderRadius: '16px', border: '2px solid #e8e0d4', backgroundColor: '#fffef9', textDecoration: 'none' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#1a2f51', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
              </div>
              <div>
                <p style={{ fontFamily: font, fontWeight: 700, color: '#1a2f51', fontSize: '0.95rem', margin: 0 }}>Email us</p>
                <p style={{ fontFamily: font, color: '#1a2f51', fontSize: '0.85rem', margin: '2px 0 0' }}>{contact.email}</p>
              </div>
            </a>
          </div>
        </section>
      </div>

      <ParentBottomNav />
    </main>
  )
}
