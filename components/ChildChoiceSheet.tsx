'use client'
// "Who is it for?" — parents with more than one reader choose a child when adding a book (+) or saving it (♡).
// Shared by the library grid and the book's own page.
import { AvatarFace } from '@/components/AvatarPicker'

const font = 'var(--font-montserrat), sans-serif'
type Reader = { id: string; name: string; nickname?: string | null; avatar_id?: string | null }

export default function ChildChoiceSheet({ action, bookTitle, readers, savedFor, onChoose, onClose }: {
  action: 'heart' | 'basket'
  bookTitle: string
  readers: Reader[]
  savedFor?: string[]                       // children who already have it saved (heart only) → tapping removes
  onChoose: (reader: Reader, e: React.MouseEvent<HTMLButtonElement>) => void
  onClose: () => void
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, backgroundColor: 'rgba(26,47,81,0.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: '576px', maxHeight: '85vh', overflowY: 'auto', backgroundColor: '#fefaf2', borderRadius: '24px 24px 0 0', padding: '26px 20px 30px', boxShadow: '0 -8px 32px rgba(26,47,81,0.2)', position: 'relative' }}>
        <button onClick={onClose} aria-label="Close" style={{ position: 'absolute', top: '16px', right: '16px', background: 'rgba(26,47,81,0.08)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', color: '#1a2f51', fontSize: '1rem' }}>✕</button>
        <p style={{ fontFamily: 'var(--font-patrick-hand)', fontSize: '1.7rem', color: '#1a2f51', margin: '0 40px 2px 0', lineHeight: 1.15 }}>
          {action === 'heart' ? 'Save it for…' : 'Add it to the next delivery for…'}
        </p>
        <p style={{ fontFamily: font, fontSize: '0.85rem', color: '#1a2f51', opacity: 0.6, margin: '0 0 18px' }}>{bookTitle}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {readers.map(r => {
            const name = r.nickname || r.name
            const saved = action === 'heart' && !!savedFor?.includes(r.id)
            return (
              <button key={r.id} onClick={e => onChoose(r, e)}
                style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '10px 14px', borderRadius: '16px', cursor: 'pointer', textAlign: 'left',
                  backgroundColor: saved ? 'rgba(224,85,119,0.08)' : '#ffffff', border: `1.5px solid ${saved ? 'rgba(224,85,119,0.35)' : 'rgba(26,47,81,0.12)'}` }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '50%', backgroundColor: 'rgba(26,47,81,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <AvatarFace id={r.avatar_id} fallback={<span style={{ fontFamily: 'var(--font-patrick-hand)', fontSize: '1.3rem', color: '#1a2f51' }}>{name[0]?.toUpperCase()}</span>} />
                </div>
                <span style={{ flex: 1, fontFamily: 'var(--font-patrick-hand)', fontSize: '1.4rem', color: '#1a2f51', lineHeight: 1 }}>{name}</span>
                {action === 'heart'
                  ? saved
                    ? <span style={{ fontFamily: font, fontSize: '0.75rem', fontWeight: 600, color: '#c0405e' }}>Remove</span>
                    : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1a2f51" strokeWidth="2" style={{ opacity: 0.45 }}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                  : <span style={{ fontFamily: font, fontSize: '1.3rem', fontWeight: 600, color: '#1a2f51', opacity: 0.5, lineHeight: 1 }}>+</span>}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
