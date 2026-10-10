'use client'

import { useEffect, useState } from 'react'

// Manage Delivery — after a missed visit the parent tells us what to do; the driver sees it straight away.
// Used by the no-login WhatsApp/email link (/m/<token>) and the signed-in dashboard page.

const navy = '#1a2f51'
const heading: React.CSSProperties = { fontFamily: 'var(--font-cormorant), serif', color: navy, fontWeight: 700, lineHeight: 1.1 }
const body: React.CSSProperties = { fontFamily: 'var(--font-montserrat), sans-serif', color: navy, fontSize: '0.95rem', lineHeight: 1.55 }

type Info = {
  missedDelivery: boolean; missedCollection: boolean; noReturn?: boolean; deliveredAfterAll: boolean; open: boolean; routeDate: string
  parentName: string | null; childNames: string[]; isApartment: boolean; savedSafeSpot: string; savedNeighbour: string
  response: string | null; responseDetails: string | null; respondedAt: string | null
}

const OPTIONS: { value: string; label: string; sub: string; needs?: 'neighbour' | 'safe_drop'; apartmentOnly?: boolean }[] = [
  { value: 'retry_today', label: 'Please try again today', sub: 'We’ll do our very best to come back — but we can’t promise it today.' },
  { value: 'neighbour', label: 'Leave them with a neighbour', sub: 'Just this once — tell us who.', needs: 'neighbour' },
  { value: 'concierge', label: 'Leave them with reception / concierge', sub: 'Just this once.', apartmentOnly: true },
  { value: 'safe_drop', label: 'Leave them in a safe spot', sub: 'Just this once — tell us where.', needs: 'safe_drop' },
  { value: 'next_bonkers_day', label: 'Wait for my next Bonkers Day', sub: 'Your books stay reserved — you’ll just need to confirm them again.' },
]

export default function ManageDelivery({ apiPath, headers, footer }: { apiPath: string; headers?: () => Promise<Record<string, string>>; footer?: React.ReactNode }) {
  const [info, setInfo] = useState<Info | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [choice, setChoice] = useState<string | null>(null)
  const [details, setDetails] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const call = async (init?: RequestInit) => fetch(apiPath, { ...init, headers: { 'Content-Type': 'application/json', ...(headers ? await headers() : {}) } })

  useEffect(() => {
    call().then(async res => {
      const b = await res.json()
      if (!res.ok) { setError(b.error || 'We couldn’t find this delivery'); return }
      setInfo(b)
      if (b.response) { setChoice(b.response); setDetails(b.responseDetails || ''); setSaved(true) }
    }).catch(() => setError('No connection — please try again'))
  }, [apiPath]) // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (o: typeof OPTIONS[number]) => {
    setChoice(o.value)
    setSaved(false)
    if (o.needs === 'neighbour') setDetails(d => d || info?.savedNeighbour || '')
    else if (o.needs === 'safe_drop') setDetails(d => d || info?.savedSafeSpot || '')
    else setDetails('')
  }

  const save = async () => {
    if (!choice) return
    setSaving(true); setError(null)
    try {
      const res = await call({ method: 'POST', body: JSON.stringify({ response: choice, details }) })
      const b = await res.json()
      if (!res.ok) throw new Error(b.error)
      setSaved(true)
    } catch (e: any) { setError(e.message || 'Not sent — please try again') }
    setSaving(false)
  }

  const kids = info?.childNames.length ? `${info.childNames.join(' and ')}’s` : 'your'
  const selected = OPTIONS.find(o => o.value === choice)

  return (
    <main style={{ minHeight: '100vh', padding: '28px 20px 80px', background: '#fefaf2' }}>
      <p style={{ fontFamily: 'var(--font-amatic)', fontWeight: 700, fontSize: '2.4rem', color: '#1a2744', margin: 0, lineHeight: 1 }}>BONKERS</p>
      <p style={{ ...body, fontSize: '0.55rem', fontWeight: 600, letterSpacing: '0.18em', margin: '2px 0 0' }}>THE CHILDREN’S LIBRARY</p>

      {error && !info && <p style={{ ...body, marginTop: '28px', color: '#e05c3a' }}>{error}</p>}
      {!info && !error && <p style={{ ...body, marginTop: '28px', opacity: 0.6 }}>Loading…</p>}

      {info && (
        <>
          <h1 style={{ ...heading, fontSize: '2.4rem', margin: '26px 0 10px' }}>
            {info.deliveredAfterAll ? 'All sorted! 🎉' : info.noReturn ? 'We couldn’t swap your books' : info.missedDelivery ? 'We missed you today!' : 'We couldn’t collect your books'}
          </h1>

          {info.deliveredAfterAll ? (
            <p style={body}>Good news — our driver managed to come back. Everything’s done for today.</p>
          ) : !info.open ? (
            <p style={body}>Today’s round has finished. {info.missedDelivery ? `${kids.charAt(0).toUpperCase() + kids.slice(1)} books are still reserved — you’ll find them on your dashboard ready to confirm for your next Bonkers Day.` : 'Please pop the books in your tote for your next Bonkers Day.'}</p>
          ) : (
            <>
              <p style={{ ...body, marginBottom: '20px' }}>
                {info.parentName ? `Hi ${info.parentName}! ` : ''}
                {info.noReturn
                  ? `There were no books out for our driver to collect, so ${kids} new books stayed in the van. Pop the books out and let us know — we’ll try to come back today.`
                  : info.missedDelivery
                  ? `Our driver came by with ${kids} new books but couldn’t deliver them. Tell us what you’d like us to do — our driver will see it straight away.`
                  : 'Some of your returning books weren’t there when our driver called. Let us know what you’d like us to do.'}
              </p>

              {OPTIONS.filter(o => (!o.apartmentOnly || info.isApartment) && (!info.noReturn || o.value === 'retry_today' || o.value === 'next_bonkers_day')).map(o => (
                <button key={o.value} type="button" onClick={() => pick(o)}
                  style={{ display: 'flex', gap: '12px', alignItems: 'center', width: '100%', textAlign: 'left', padding: '14px 16px', marginBottom: '10px', borderRadius: '14px', cursor: 'pointer',
                    border: choice === o.value ? '4px solid #fee297' : '2px solid #e8e0d4', backgroundColor: choice === o.value ? '#fffef9' : 'transparent' }}>
                  <img src={choice === o.value ? '/star_yellow.png' : '/star_cream.png'} alt="" style={{ width: '28px', height: '28px', objectFit: 'contain', flexShrink: 0 }} />
                  <span>
                    <span style={{ ...body, display: 'block', fontWeight: 700 }}>{info.noReturn && o.value === 'retry_today' ? 'I’ve put the books out — please come back today' : o.label}</span>
                    <span style={{ ...body, display: 'block', fontSize: '0.78rem', opacity: 0.8 }}>{o.sub}</span>
                  </span>
                </button>
              ))}

              {selected?.needs && (
                <input value={details} onChange={e => { setDetails(e.target.value); setSaved(false) }}
                  placeholder={selected.needs === 'neighbour' ? 'e.g. Sarah, Villa 31' : 'e.g. behind the side gate'}
                  className="w-full border border-[#ddd6cc] rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-300 bg-white text-[#1a2744]"
                  style={{ marginBottom: '14px' }} />
              )}

              {error && <p style={{ ...body, color: '#e05c3a', marginBottom: '10px' }}>{error}</p>}
              {saved ? (
                <p style={{ ...body, fontWeight: 700, color: '#2e5c3a', textAlign: 'center', marginTop: '14px' }}>✓ Thanks — our driver can see your answer.</p>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '18px' }}>
                  <button type="button" disabled={!choice || saving} onClick={save}
                    style={{ backgroundColor: navy, border: 'none', borderRadius: '999px', padding: '14px 40px', cursor: choice ? 'pointer' : 'not-allowed', opacity: !choice || saving ? 0.5 : 1 }}>
                    <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600, fontSize: '0.85rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#fff' }}>{saving ? 'Sending…' : 'Send'}</span>
                  </button>
                </div>
              )}
              <p style={{ ...body, fontSize: '0.78rem', opacity: 0.7, marginTop: '22px', textAlign: 'center' }}>
                Tip: add backup options in Settings → Delivery Info, so next time we can leave your books safely without needing to check.
              </p>
            </>
          )}
          {footer}
        </>
      )}
    </main>
  )
}
