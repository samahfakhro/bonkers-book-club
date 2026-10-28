'use client'

import { useCallback, useEffect, useState } from 'react'

// Finance — promo codes for now. Payments, invoices and payouts are in the Stripe dashboard.
// 'Free' codes give a membership with no card (e.g. trial families); 'Discount' codes take % off on Stripe's payment page.

type Code = {
  id: string; code: string; kind: 'free' | 'discount'; description: string; max_uses: number | null; times_used: number
  expires_on: string | null; active: boolean; note: string | null; created_at: string
}

const card: React.CSSProperties = { border: '1px solid #e5e5e5', borderRadius: '10px', padding: '18px 20px', backgroundColor: '#fff' }
const inp: React.CSSProperties = { color: '#1a1a1a', width: '100%', padding: '9px 10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box', backgroundColor: '#fff' }
const lbl: React.CSSProperties = { display: 'block', fontSize: '12px', fontWeight: 600, color: '#1a1a1a', marginBottom: '4px' }
const btn = (primary = false): React.CSSProperties => ({ padding: '8px 14px', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', border: primary ? 'none' : '1px solid #ddd', background: primary ? '#1a1a1a' : '#fff', color: primary ? '#fff' : '#1a1a1a' })
const badge = (bg: string, fg: string): React.CSSProperties => ({ display: 'inline-block', padding: '2px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: 700, backgroundColor: bg, color: fg })

const blank = { code: '', kind: 'free' as 'free' | 'discount', percentOff: '', months: '1', maxUses: '', expiresOn: '', note: '' }

export default function FinancePage() {
  const [codes, setCodes] = useState<Code[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(blank)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null)
  const set = (k: keyof typeof blank, v: string) => setForm(f => ({ ...f, [k]: v }))

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/promo-codes')
    const body = await res.json()
    if (res.ok) setCodes(body.codes)
    else setMsg({ text: body.error || 'Could not load promo codes', bad: true })
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  async function add() {
    setSaving(true); setMsg(null)
    const res = await fetch('/api/admin/promo-codes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) setMsg({ text: body.error || 'Something went wrong', bad: true })
    else { setMsg({ text: `${form.code.trim().toUpperCase()} is ready to use.` }); setForm(blank); await load() }
    setSaving(false)
  }

  async function toggle(c: Code) {
    setMsg(null)
    const res = await fetch('/api/admin/promo-codes', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: c.id, active: !c.active }) })
    if (!res.ok) setMsg({ text: 'Could not update that code', bad: true })
    await load()
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px', backgroundColor: '#fafafa', color: '#1a1a1a' }}>
      <h1 style={{ margin: '0 0 4px', fontSize: '22px', fontWeight: 700, color: '#1a1a1a' }}>Finance</h1>
      <p style={{ margin: '0 0 20px', fontSize: '14px', color: '#1a1a1a', maxWidth: '640px', lineHeight: 1.5 }}>
        Promo codes families type when they sign up. Payments, invoices and payouts are in the Stripe dashboard.
      </p>

      {msg && <p style={{ margin: '0 0 16px', fontSize: '14px', fontWeight: 600, color: msg.bad ? '#b42318' : '#067647' }}>{msg.text}</p>}

      <div style={{ ...card, maxWidth: '640px', marginBottom: '24px' }}>
        <h2 style={{ margin: '0 0 14px', fontSize: '16px', fontWeight: 700 }}>New promo code</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label style={lbl}>Code</label>
            <input style={inp} value={form.code} onChange={e => set('code', e.target.value.toUpperCase())} placeholder="e.g. SUMMER20" />
          </div>
          <div>
            <label style={lbl}>What it gives</label>
            <select style={inp} value={form.kind} onChange={e => set('kind', e.target.value)}>
              <option value="free">Free membership, no card</option>
              <option value="discount">Discount on payments</option>
            </select>
          </div>
          {form.kind === 'discount' && <>
            <div>
              <label style={lbl}>% off</label>
              <input style={inp} type="number" min={1} max={100} value={form.percentOff} onChange={e => set('percentOff', e.target.value)} placeholder="e.g. 20" />
            </div>
            <div>
              <label style={lbl}>For how many monthly payments</label>
              <input style={inp} type="number" min={1} value={form.months} onChange={e => set('months', e.target.value)} />
            </div>
          </>}
          <div>
            <label style={lbl}>Max uses <span style={{ fontWeight: 400 }}>(optional)</span></label>
            <input style={inp} type="number" min={1} value={form.maxUses} onChange={e => set('maxUses', e.target.value)} placeholder="No limit" />
          </div>
          <div>
            <label style={lbl}>Expires on <span style={{ fontWeight: 400 }}>(optional)</span></label>
            <input style={inp} type="date" value={form.expiresOn} onChange={e => set('expiresOn', e.target.value)} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={lbl}>Note <span style={{ fontWeight: 400 }}>(only the team sees this)</span></label>
            <input style={inp} value={form.note} onChange={e => set('note', e.target.value)} placeholder="e.g. Instagram campaign, November" />
          </div>
        </div>
        <button style={{ ...btn(true), marginTop: '14px', opacity: saving ? 0.6 : 1 }} disabled={saving || !form.code.trim()} onClick={add}>
          {saving ? 'Saving…' : 'Create code'}
        </button>
      </div>

      <h2 style={{ margin: '0 0 10px', fontSize: '16px', fontWeight: 700 }}>Promo codes</h2>
      {loading ? <p style={{ fontSize: '14px' }}>Loading…</p> : codes.length === 0 ? <p style={{ fontSize: '14px' }}>No codes yet.</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '640px' }}>
          {codes.map(c => (
            <div key={c.id} style={{ ...card, display: 'flex', alignItems: 'center', gap: '14px', opacity: c.active ? 1 : 0.55 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <strong style={{ fontSize: '15px', letterSpacing: '0.04em' }}>{c.code}</strong>
                  {c.kind === 'free' ? <span style={badge('#ecfdf3', '#067647')}>Free</span> : <span style={badge('#eff8ff', '#175cd3')}>Discount</span>}
                  {!c.active && <span style={badge('#f2f4f7', '#344054')}>Off</span>}
                </div>
                <div style={{ fontSize: '13px' }}>{c.description}</div>
                <div style={{ fontSize: '12px', color: '#555', marginTop: '4px' }}>
                  Used {c.times_used}{c.max_uses ? ` of ${c.max_uses}` : ''} times
                  {c.expires_on && ` · expires ${new Date(c.expires_on).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                  {c.note && ` · ${c.note}`}
                </div>
              </div>
              <button style={btn()} onClick={() => toggle(c)}>{c.active ? 'Switch off' : 'Switch on'}</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
