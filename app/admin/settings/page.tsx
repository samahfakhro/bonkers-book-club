'use client'

import { useEffect, useState } from 'react'

// Admin Settings: plans and prices, choose-by deadline, contact details, signup options, returns and charges.

type Field = { key: string; label: string; type: 'number' | 'text' | 'boolean'; hint?: string }
type Group = { title: string; fields: Field[] }
type Plan = { id?: string; name: string; book_count: number; price_monthly: number; is_active: boolean }
type How = { value?: string; label: string; followUp: string | null }

const font: React.CSSProperties = { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', color: '#1a1a1a' }
const inp: React.CSSProperties = { ...font, padding: '7px 10px', borderRadius: '6px', backgroundColor: '#fff', border: '1px solid #d4d4d4', fontSize: '13px', outline: 'none', boxSizing: 'border-box', minWidth: 0 }
const card: React.CSSProperties = { border: '1px solid #e5e5e5', borderRadius: '10px', padding: '16px 18px', marginBottom: '16px', backgroundColor: '#fff' }
const h2: React.CSSProperties = { ...font, fontSize: '13px', fontWeight: 700, margin: '0 0 12px' }
const hint: React.CSSProperties = { ...font, fontSize: '11px', color: '#9b9b9b', margin: '2px 0 0' }

function Btn({ variant = 'primary', disabled, onClick, children }: { variant?: 'primary' | 'secondary'; disabled?: boolean; onClick?: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} disabled={disabled} style={{ ...font, padding: '7px 14px', borderRadius: '6px', border: 'none', cursor: disabled ? 'default' : 'pointer', fontSize: '13px', fontWeight: 600, backgroundColor: variant === 'primary' ? '#1a1a1a' : '#f0f0f0', color: variant === 'primary' ? '#fff' : '#1a1a1a', opacity: disabled ? 0.5 : 1 }}>{children}</button>
}

export default function AdminSettingsPage() {
  const [groups, setGroups] = useState<Group[]>([])
  const [values, setValues] = useState<Record<string, string>>({})
  const [plans, setPlans] = useState<Plan[]>([])
  const [how, setHow] = useState<How[]>([])
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [dirty, setDirty] = useState(false)

  const load = async () => {
    const r = await fetch('/api/admin/settings', { cache: 'no-store' })
    const b = await r.json()
    if (!r.ok) { setMsg({ ok: false, text: b.error || 'Could not load' }); return }
    setGroups(b.groups); setValues(b.values); setPlans(b.plans); setHow(b.howHeard); setDirty(false)
  }
  useEffect(() => { load() }, [])

  const change = <T,>(fn: (v: T) => void) => (v: T) => { fn(v); setDirty(true); setMsg(null) }
  const setValue = change((p: [string, string]) => setValues(v => ({ ...v, [p[0]]: p[1] })))
  const setPlan = (i: number, patch: Partial<Plan>) => { setPlans(ps => ps.map((p, j) => j === i ? { ...p, ...patch } : p)); setDirty(true); setMsg(null) }
  const setHowAt = (i: number, patch: Partial<How>) => { setHow(hs => hs.map((h, j) => j === i ? { ...h, ...patch } : h)); setDirty(true); setMsg(null) }

  const save = async () => {
    setSaving(true)
    const r = await fetch('/api/admin/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ values, plans, howHeard: how }) })
    const b = await r.json().catch(() => ({}))
    setSaving(false)
    if (!r.ok) { setMsg({ ok: false, text: b.error || 'Not saved' }); return }
    setMsg({ ok: true, text: '✓ Saved' })
    await load()
  }

  return (
    <div style={{ padding: '24px 32px 80px', overflowY: 'auto', height: '100%', maxWidth: '760px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', position: 'sticky', top: 0, background: '#fff', padding: '8px 0', zIndex: 1 }}>
        <h1 style={{ ...font, fontSize: '15px', fontWeight: 700, margin: 0 }}>Settings</h1>
        <span style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {msg && <span style={{ ...font, fontSize: '13px', fontWeight: 600, color: msg.ok ? '#16a34a' : '#dc2626' }}>{msg.text}</span>}
          <Btn onClick={save} disabled={saving || !dirty}>{saving ? 'Saving…' : 'Save changes'}</Btn>
        </span>
      </div>

      <div style={card}>
        <p style={h2}>Plans and prices</p>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 70px', gap: '8px', ...font, fontSize: '11px', fontWeight: 700, color: '#9b9b9b', textTransform: 'uppercase', marginBottom: '6px' }}>
          <span>Name</span><span>Books at a time</span><span>AED / month</span><span>Offered</span>
        </div>
        {plans.map((p, i) => (
          <div key={p.id || `new-${i}`} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 70px', gap: '8px', marginBottom: '6px', alignItems: 'center' }}>
            <input style={{ ...inp, width: '100%' }} value={p.name} onChange={e => setPlan(i, { name: e.target.value })} />
            <input style={{ ...inp, width: '100%' }} type="number" min={1} value={p.book_count} onChange={e => setPlan(i, { book_count: Number(e.target.value) })} />
            <input style={{ ...inp, width: '100%' }} type="number" min={0} value={p.price_monthly} onChange={e => setPlan(i, { price_monthly: Number(e.target.value) })} />
            <input type="checkbox" checked={p.is_active} onChange={e => setPlan(i, { is_active: e.target.checked })} />
          </div>
        ))}
        <Btn variant="secondary" onClick={() => { setPlans(ps => [...ps, { name: '', book_count: 4, price_monthly: 0, is_active: false }]); setDirty(true) }}>+ Add plan</Btn>
        <p style={hint}>Untick “Offered” to stop a plan appearing at signup (families already on it keep it).</p>
      </div>

      {groups.map(g => (
        <div key={g.title} style={card}>
          <p style={h2}>{g.title}</p>
          {g.fields.map(f => (
            <div key={f.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginBottom: '10px' }}>
              <div>
                <p style={{ ...font, fontSize: '13px', margin: 0 }}>{f.label}</p>
                {f.hint && <p style={hint}>{f.hint}</p>}
              </div>
              {f.type === 'boolean'
                ? <input type="checkbox" checked={values[f.key] !== 'false'} onChange={e => setValue([f.key, e.target.checked ? 'true' : 'false'])} />
                : <input style={{ ...inp, width: f.type === 'number' ? '90px' : '240px' }} type={f.type === 'number' ? 'number' : 'text'} min={0}
                    value={values[f.key] ?? ''} onChange={e => setValue([f.key, e.target.value])} />}
            </div>
          ))}
        </div>
      ))}

      <BioLinks />

      <div style={card}>
        <p style={h2}>“How did you hear about us?” options</p>
        {how.map((h, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 30px', gap: '8px', marginBottom: '6px' }}>
            <input style={{ ...inp, width: '100%' }} value={h.label} placeholder="Option" onChange={e => setHowAt(i, { label: e.target.value })} />
            <input style={{ ...inp, width: '100%' }} value={h.followUp || ''} placeholder="Follow-up question (optional)" onChange={e => setHowAt(i, { followUp: e.target.value || null })} />
            <button onClick={() => { setHow(hs => hs.filter((_, j) => j !== i)); setDirty(true) }} title="Remove" style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9b9b9b', fontSize: '16px' }}>×</button>
          </div>
        ))}
        <Btn variant="secondary" onClick={() => { setHow(hs => [...hs, { label: '', followUp: null }]); setDirty(true) }}>+ Add option</Btn>
      </div>
    </div>
  )
}

// Tagged links for bios and posts, so visits are counted under the right source
const LINK_SOURCES = ['instagram', 'tiktok', 'facebook', 'whatsapp', 'google', 'flyer', 'school']
function BioLinks() {
  const [base, setBase] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  useEffect(() => { setBase(window.location.origin) }, [])
  return (
    <div style={card}>
      <p style={h2}>Links for your bios and posts</p>
      <p style={{ ...hint, margin: '0 0 10px' }}>Use these so we know where visitors came from. ChatGPT, Perplexity, Gemini, Claude and Google searches are recognised automatically. Once curiouslibrary.ae is live these will start with https://curiouslibrary.ae.</p>
      {LINK_SOURCES.map(src => {
        const url = `${base}/?src=${src}`
        return (
          <div key={src} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
            <span style={{ ...font, fontSize: '13px' }}><strong style={{ textTransform: 'capitalize' }}>{src}</strong> <span style={{ color: '#6b6b6b' }}>{url}</span></span>
            <Btn variant="secondary" onClick={() => { navigator.clipboard.writeText(url); setCopied(src); setTimeout(() => setCopied(null), 1500) }}>{copied === src ? 'Copied ✓' : 'Copy'}</Btn>
          </div>
        )
      })}
    </div>
  )
}
