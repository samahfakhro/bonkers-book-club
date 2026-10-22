'use client'

import { useCallback, useEffect, useState } from 'react'
import { ROLE_HINT, ROLE_LABEL, type TeamRole } from '@/lib/team'

// Team — who can use the admin, driver and warehouse screens.
// Staff without email log in at /team with their mobile number and the password set here.

type Member = { id: string; name: string; phone: string | null; email: string | null; role: TeamRole; is_owner: boolean; active: boolean; created_at: string }
const ROLES: TeamRole[] = ['admin', 'driver', 'warehouse']

const card: React.CSSProperties = { border: '1px solid #e5e5e5', borderRadius: '10px', padding: '18px 20px', backgroundColor: '#fff' }
const inp: React.CSSProperties = { color: '#1a1a1a', width: '100%', padding: '9px 10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box', backgroundColor: '#fff' }
const lbl: React.CSSProperties = { display: 'block', fontSize: '12px', fontWeight: 600, color: '#1a1a1a', marginBottom: '4px' }
const btn = (primary = false): React.CSSProperties => ({ padding: '8px 14px', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', border: primary ? 'none' : '1px solid #ddd', background: primary ? '#1a1a1a' : '#fff', color: primary ? '#fff' : '#1a1a1a' })
const badge = (bg: string, fg: string): React.CSSProperties => ({ display: 'inline-block', padding: '2px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: 700, backgroundColor: bg, color: fg })

const showPhone = (d: string | null) => d ? (d.startsWith('971') ? `0${d.slice(3)}` : `+${d}`) : null
const blank = { name: '', phone: '', email: '', role: 'driver' as TeamRole, password: '' }

export default function TeamPage() {
  const [team, setTeam] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(blank)
  const [useEmail, setUseEmail] = useState(false)
  const [adding, setAdding] = useState(false)
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null)
  const [resetFor, setResetFor] = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState('')

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/team')
    const body = await res.json()
    if (res.ok) setTeam(body.team)
    else setMsg({ text: body.error || 'Could not load the team', bad: true })
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  async function send(method: 'POST' | 'PATCH', payload: Record<string, unknown>, done: string) {
    setMsg(null)
    const res = await fetch('/api/admin/team', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) { setMsg({ text: body.error || 'Something went wrong', bad: true }); return false }
    setMsg({ text: done })
    await load()
    return true
  }

  async function add() {
    setAdding(true)
    const ok = await send('POST', { name: form.name, role: form.role, password: form.password, ...(useEmail ? { email: form.email } : { phone: form.phone }) }, `${form.name.trim()} has been added.`)
    if (ok) setForm(blank)
    setAdding(false)
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px', backgroundColor: '#fafafa', color: '#1a1a1a' }}>
      <h1 style={{ margin: '0 0 4px', fontSize: '22px', fontWeight: 700, color: '#1a1a1a' }}>Team</h1>
      <p style={{ margin: '0 0 20px', fontSize: '14px', color: '#1a1a1a', maxWidth: '640px', lineHeight: 1.5 }}>
        Everyone who can use the admin, driver or warehouse screens. Staff log in at <strong>/team</strong> with their mobile number (or email) and the password you set here.
      </p>

      {msg && <p style={{ margin: '0 0 16px', padding: '10px 14px', borderRadius: '8px', fontSize: '14px', backgroundColor: msg.bad ? '#fdecea' : '#e6f6ec', color: msg.bad ? '#b3261e' : '#1e7a3c' }}>{msg.text}</p>}

      {/* Add someone */}
      <div style={{ ...card, marginBottom: '20px', maxWidth: '760px' }}>
        <h2 style={{ margin: '0 0 14px', fontSize: '16px', fontWeight: 700, color: '#1a1a1a' }}>Add a team member</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          <div><label style={lbl}>Name</label><input style={inp} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Ahmed" /></div>
          <div>
            <label style={lbl}>{useEmail ? 'Email' : 'Mobile number'}</label>
            {useEmail
              ? <input style={inp} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="name@example.com" />
              : <input style={inp} type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="050 123 4567" />}
            <button type="button" onClick={() => setUseEmail(u => !u)} style={{ background: 'none', border: 'none', padding: 0, marginTop: '4px', fontSize: '12px', color: '#1a56b0', cursor: 'pointer' }}>
              {useEmail ? 'Use a mobile number instead' : 'They have an email — use that instead'}
            </button>
          </div>
          <div>
            <label style={lbl}>Role</label>
            <select style={inp} value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as TeamRole }))}>
              {ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]} — {ROLE_HINT[r]}</option>)}
            </select>
          </div>
          <div><label style={lbl}>Starting password (8+ characters)</label><input style={inp} type="text" autoComplete="off" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} /></div>
        </div>
        <button type="button" onClick={add} disabled={adding} style={{ ...btn(true), marginTop: '14px', opacity: adding ? 0.6 : 1 }}>{adding ? 'Adding…' : 'Add to team'}</button>
      </div>

      {/* The team */}
      <div style={{ ...card, maxWidth: '960px', padding: 0, overflow: 'hidden' }}>
        {loading ? <p style={{ padding: '18px 20px', margin: 0, color: '#1a1a1a' }}>Loading…</p> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', color: '#1a1a1a' }}>
            <thead>
              <tr style={{ backgroundColor: '#f7f7f7', textAlign: 'left', color: '#1a1a1a', fontSize: '12px' }}>
                <th style={{ padding: '10px 16px' }}>Name</th><th style={{ padding: '10px 16px' }}>Logs in with</th>
                <th style={{ padding: '10px 16px' }}>Role</th><th style={{ padding: '10px 16px' }}>Access</th><th style={{ padding: '10px 16px' }} />
              </tr>
            </thead>
            <tbody>
              {team.map(m => (
                <tr key={m.id} style={{ borderTop: '1px solid #eee', backgroundColor: m.active ? '#fff' : '#f4f4f4' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>{m.name} {m.is_owner && <span style={badge('#fff8e6', '#7a5a00')}>OWNER</span>}</td>
                  <td style={{ padding: '12px 16px', color: '#1a1a1a' }}>{showPhone(m.phone) || m.email}</td>
                  <td style={{ padding: '12px 16px' }}>
                    {m.is_owner ? ROLE_LABEL[m.role] : (
                      <select style={{ ...inp, width: 'auto', padding: '5px 8px' }} value={m.role} onChange={e => send('PATCH', { id: m.id, role: e.target.value }, `${m.name} is now ${ROLE_LABEL[e.target.value as TeamRole]}.`)}>
                        {ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                      </select>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px' }}>{m.active ? <span style={badge('#e6f6ec', '#1e7a3c')}>ON</span> : <span style={badge('#f0f0f0', '#1a1a1a')}>SWITCHED OFF</span>}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {resetFor === m.id ? (
                      <span style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                        <input style={{ ...inp, width: '170px', padding: '6px 8px' }} type="text" autoComplete="off" placeholder="New password (8+)" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                        <button style={btn(true)} onClick={async () => { if (await send('PATCH', { id: m.id, password: newPassword }, `New password set for ${m.name}.`)) { setResetFor(null); setNewPassword('') } }}>Save</button>
                        <button style={btn()} onClick={() => { setResetFor(null); setNewPassword('') }}>Cancel</button>
                      </span>
                    ) : (
                      <span style={{ display: 'inline-flex', gap: '6px' }}>
                        <button style={btn()} onClick={() => { setResetFor(m.id); setNewPassword('') }}>New password</button>
                        {!m.is_owner && (
                          <button style={btn()} onClick={() => send('PATCH', { id: m.id, active: !m.active }, m.active ? `${m.name} has been switched off.` : `${m.name} has been switched back on.`)}>
                            {m.active ? 'Switch off' : 'Switch on'}
                          </button>
                        )}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
