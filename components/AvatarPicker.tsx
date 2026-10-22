'use client'
// "Choose your avatar" — one shared sheet for children (from their profile dropdown) and parents (dropdown + Settings).
// Tapping a picture only highlights it (so a stray tap while scrolling changes nothing); Save at the top makes it stick.
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAvatars } from '@/lib/avatars'

const font = 'var(--font-montserrat), sans-serif'

// the round picture itself, or the fallback (usually their initial) when no avatar is chosen yet
export function AvatarFace({ id, fallback }: { id?: string | null; fallback: React.ReactNode }) {
  const list = useAvatars()
  const url = id ? list.find(a => a.id === id)?.image_url : null
  if (!url) return <>{fallback}</>
  return <img src={url} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', display: 'block' }} />
}

export default function AvatarPicker({ target, currentId, onClose, onSaved }: {
  target: { childId: string } | { householdId: string }
  currentId: string | null
  onClose: () => void
  onSaved: (avatarId: string) => void
}) {
  const list = useAvatars()
  const [picked, setPicked] = useState<string | null>(currentId)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const changed = !!picked && picked !== currentId
  // each illustration style (the part of the file name before the _, e.g. style3) starts on its own row
  const groups = list.reduce<{ style: string; items: typeof list }[]>((acc, av) => {
    const style = av.name.split('_')[0]
    const last = acc[acc.length - 1]
    if (last?.style === style) last.items.push(av); else acc.push({ style, items: [av] })
    return acc
  }, [])

  async function save() {
    if (!changed || !picked) return
    setSaving(true); setError('')
    const { error: upErr } = 'childId' in target
      ? await supabase.from('child_profiles').update({ avatar_id: picked }).eq('id', target.childId)
      : await supabase.from('households').update({ avatar_id: picked }).eq('id', target.householdId)
    setSaving(false)
    if (upErr) { setError('That didn’t save — please try again.'); return }
    onSaved(picked)
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 110, backgroundColor: 'rgba(26,47,81,0.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: '760px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', backgroundColor: '#fefaf2', borderRadius: '24px 24px 0 0', boxShadow: '0 -8px 32px rgba(26,47,81,0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 16px 10px' }}>
          <button onClick={onClose} aria-label="Close" style={{ background: 'rgba(26,47,81,0.08)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', color: '#1a2f51', fontSize: '1rem', flexShrink: 0 }}>✕</button>
          <p style={{ fontFamily: 'var(--font-cormorant), serif', fontWeight: 700, fontSize: '1.7rem', color: '#1a2f51', margin: 0, textAlign: 'center' }}>Choose your avatar</p>
          <button onClick={save} disabled={!changed || saving}
            style={{ fontFamily: font, fontWeight: 700, fontSize: '0.8rem', letterSpacing: '0.06em', padding: '8px 16px', borderRadius: '999px', border: 'none', flexShrink: 0,
              backgroundColor: changed ? '#1a2f51' : 'rgba(26,47,81,0.15)', color: changed ? '#fefaf2' : 'rgba(26,47,81,0.45)', cursor: changed && !saving ? 'pointer' : 'default' }}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
        {error && <p style={{ fontFamily: font, fontSize: '0.8rem', color: '#c0392b', textAlign: 'center', margin: '0 16px 6px' }}>{error}</p>}
        <div style={{ overflowY: 'auto', padding: '6px 20px 34px' }}>
          {groups.map((group, gi) => (
            <div key={group.style} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(clamp(84px, 22vw, 136px), 1fr))', gap: 'clamp(16px, 2.5vw, 22px)', padding: '14px 0', borderTop: gi ? '1px solid rgba(26,47,81,0.12)' : 'none' }}>
              {group.items.map(av => {
                const on = picked === av.id
                return (
                  <button key={av.id} type="button" onClick={() => setPicked(av.id)} aria-label={av.name} aria-pressed={on}
                    style={{ padding: 0, background: 'none', border: 'none', cursor: 'pointer', aspectRatio: '1', borderRadius: '50%',
                      boxShadow: on ? '0 0 0 4px #fefaf2, 0 0 0 7px #1a2f51' : 'none', transform: on ? 'scale(1.06)' : 'scale(1)', transition: 'transform 0.15s, box-shadow 0.15s' }}>
                    <img src={av.image_url} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', display: 'block' }} />
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
