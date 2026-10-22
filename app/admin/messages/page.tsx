'use client'

import { useCallback, useEffect, useState } from 'react'
import { fillPlaceholders, type Placeholder } from '@/lib/message-templates'

// Messages — every automatic message, with its wording editable. {words in curly brackets} are filled in per family.
type Msg = {
  key: string; group: string; name: string; when: string; placeholders: Placeholder[]; whatsapp?: boolean
  title: string | null; body: string; original: { title: string | null; body: string }; edited: boolean; updatedAt: string | null
}

const inp: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '9px 10px', border: '1px solid #ccc', borderRadius: '6px', fontSize: '14px', color: '#1a1a1a', backgroundColor: '#fff', fontFamily: 'inherit' }
const btn = (primary = false): React.CSSProperties => ({ padding: '7px 14px', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', border: primary ? 'none' : '1px solid #ccc', background: primary ? '#1a1a1a' : '#fff', color: primary ? '#fff' : '#1a1a1a' })

export default function MessagesPage() {
  const [messages, setMessages] = useState<Msg[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState<string | null>(null)
  const [draft, setDraft] = useState<{ title: string; body: string }>({ title: '', body: '' })
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/messages')
    const body = await res.json()
    if (res.ok) setMessages(body.messages)
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const startEdit = (m: Msg) => { setOpen(m.key); setDraft({ title: m.title ?? '', body: m.body }); setMsg(null) }

  async function save(m: Msg) {
    setBusy(true); setMsg(null)
    const res = await fetch('/api/admin/messages', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: m.key, title: draft.title, body: draft.body }) })
    const b = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setMsg({ text: b.error || 'Could not save', bad: true }); return }
    setMsg({ text: `Saved “${m.name}”.${m.whatsapp ? ' The WhatsApp version will need re-approval by Meta before it changes.' : ''}` })
    setOpen(null); load()
  }

  async function reset(m: Msg) {
    if (!confirm(`Put “${m.name}” back to the original wording?`)) return
    await fetch(`/api/admin/messages?key=${m.key}`, { method: 'DELETE' })
    setMsg({ text: `“${m.name}” is back to the original wording.` })
    setOpen(null); load()
  }

  const groups = [...new Set(messages.map(m => m.group))]
  const samples = (m: Msg) => Object.fromEntries(m.placeholders.map(p => [p.key, p.sample]))

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px', backgroundColor: '#fafafa', color: '#1a1a1a' }}>
      <h1 style={{ margin: '0 0 4px', fontSize: '22px', fontWeight: 700, color: '#1a1a1a' }}>Messages</h1>
      <p style={{ margin: '0 0 18px', fontSize: '14px', maxWidth: '700px', lineHeight: 1.5 }}>
        Every message the app sends to families. Words in <strong>{'{curly brackets}'}</strong> are filled in for each family — the ones a message can use are listed under it.
        Changes apply straight away in the app and by email. Messages marked <strong>WhatsApp</strong> also need Meta to approve new wording (usually a day or two).
      </p>
      {msg && <p style={{ margin: '0 0 16px', padding: '10px 14px', borderRadius: '8px', fontSize: '14px', backgroundColor: msg.bad ? '#fdecea' : '#e6f6ec', color: msg.bad ? '#b3261e' : '#1e7a3c', maxWidth: '820px' }}>{msg.text}</p>}

      {loading ? <p style={{ fontSize: '14px' }}>Loading…</p> : groups.map(g => (
        <section key={g} style={{ marginBottom: '26px', maxWidth: '820px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 10px', color: '#1a1a1a' }}>{g}</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {messages.filter(m => m.group === g).map(m => {
              const editing = open === m.key
              const preview = editing ? { title: fillPlaceholders(draft.title, samples(m)), body: fillPlaceholders(draft.body, samples(m)) } : { title: fillPlaceholders(m.title ?? '', samples(m)), body: fillPlaceholders(m.body, samples(m)) }
              return (
                <div key={m.key} style={{ border: '1px solid #e5e5e5', borderRadius: '10px', backgroundColor: '#fff', padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: '14px', fontWeight: 700 }}>
                        {m.name}
                        {m.edited && <span style={{ marginLeft: '8px', padding: '2px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: 700, backgroundColor: '#fff8e6', color: '#7a5a00' }}>EDITED</span>}
                        {m.whatsapp && <span style={{ marginLeft: '6px', padding: '2px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: 700, backgroundColor: '#e6f6ec', color: '#1e7a3c' }}>WHATSAPP</span>}
                      </p>
                      <p style={{ margin: '2px 0 8px', fontSize: '13px' }}>{m.when}</p>
                      {!editing && (
                        <div style={{ padding: '10px 12px', borderRadius: '8px', backgroundColor: '#f7f7f7', fontSize: '14px', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                          {m.title && <strong style={{ display: 'block', marginBottom: '2px' }}>{m.title}</strong>}
                          {m.body}
                        </div>
                      )}
                    </div>
                    {!editing && <button style={btn()} onClick={() => startEdit(m)}>Edit</button>}
                  </div>

                  {editing && (
                    <div style={{ marginTop: '6px' }}>
                      {m.original.title !== null && (
                        <>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, margin: '0 0 4px' }}>Headline (in-app title / email subject)</label>
                          <input style={{ ...inp, marginBottom: '10px' }} value={draft.title} onChange={e => setDraft(d => ({ ...d, title: e.target.value }))} />
                        </>
                      )}
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, margin: '0 0 4px' }}>Message</label>
                      <textarea style={{ ...inp, minHeight: '90px', resize: 'vertical' }} value={draft.body} onChange={e => setDraft(d => ({ ...d, body: e.target.value }))} />
                      {m.placeholders.length > 0 && (
                        <div style={{ margin: '8px 0 0', fontSize: '12px', lineHeight: 1.6 }}>
                          <strong>Words you can use:</strong>{' '}
                          {m.placeholders.map(p => (
                            <button key={p.key} type="button" onClick={() => setDraft(d => ({ ...d, body: `${d.body}{${p.key}}` }))} title={`${p.label} — e.g. ${p.sample}`}
                              style={{ margin: '2px 4px 2px 0', padding: '2px 8px', borderRadius: '999px', border: '1px solid #ccc', background: '#f7f7f7', cursor: 'pointer', fontSize: '12px', color: '#1a1a1a' }}>
                              {`{${p.key}}`}
                            </button>
                          ))}
                          <span style={{ display: 'block' }}>Tap a word to add it to the end of the message. Hover for what it means.</span>
                        </div>
                      )}
                      <p style={{ margin: '12px 0 4px', fontSize: '12px', fontWeight: 600 }}>Preview (with sample details)</p>
                      <div style={{ padding: '10px 12px', borderRadius: '8px', backgroundColor: '#fefaf2', border: '1px solid #eee2c8', fontSize: '14px', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                        {preview.title && <strong style={{ display: 'block', marginBottom: '2px' }}>{preview.title}</strong>}
                        {preview.body}
                      </div>
                      <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
                        <button disabled={busy} style={btn(true)} onClick={() => save(m)}>{busy ? 'Saving…' : 'Save'}</button>
                        <button style={btn()} onClick={() => setOpen(null)}>Cancel</button>
                        {m.edited && <button style={btn()} onClick={() => reset(m)}>Reset to original</button>}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
