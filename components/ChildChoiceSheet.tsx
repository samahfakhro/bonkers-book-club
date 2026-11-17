'use client'
// "Who is it for?" — parents with more than one reader choose a child when adding a book (+) or saving it (♡).
// Shared by the library grid and the book's own page. Sizes are in px so it looks the same on phones and iPads.
// It opens as a small card next to where the + or ♡ was tapped (kept inside the screen).
import { useLayoutEffect, useRef, useState } from 'react'
import { AvatarFace } from '@/components/AvatarPicker'

// where the screen was last touched or clicked, so the card can open there
let lastPoint: { x: number; y: number } | null = null
if (typeof window !== 'undefined') window.addEventListener('pointerdown', e => { lastPoint = { x: e.clientX, y: e.clientY } }, true)

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
  const cardRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  useLayoutEffect(() => {
    const el = cardRef.current
    if (!el) return
    const { width: w, height: h } = el.getBoundingClientRect()
    const vw = window.innerWidth, vh = window.innerHeight, pad = 12
    const p = lastPoint || { x: vw / 2, y: vh / 2 }
    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(v, hi))
    // centred on the tap sideways; its top just above the tap, or moved up if it would run off the bottom
    setPos({ left: clamp(p.x - w / 2, pad, vw - w - pad), top: clamp(p.y - 40, pad, vh - h - pad) })
  }, [])
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, backgroundColor: 'rgba(26,47,81,0.45)' }} onClick={onClose}>
      {/* phones get the smaller text; iPads and computers a size up */}
      <style>{`@media (min-width: 600px) { .ccs-heading { font-size: 30px !important; } .ccs-name { font-size: 25px !important; } }`}</style>
      <div ref={cardRef} onClick={e => e.stopPropagation()}
        style={{ position: 'fixed', top: pos?.top ?? 0, left: pos?.left ?? 0, visibility: pos ? 'visible' : 'hidden', width: 'min(400px, calc(100vw - 24px))', maxHeight: '80vh', overflowY: 'auto', backgroundColor: '#fefaf2', borderRadius: '24px', padding: '22px 20px 22px', boxShadow: '0 12px 40px rgba(26,47,81,0.28)' }}>
        <button onClick={onClose} aria-label="Close" style={{ position: 'absolute', top: '16px', right: '16px', background: 'rgba(26,47,81,0.08)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', color: '#1a2f51', fontSize: '16px' }}>✕</button>
        <p className="ccs-heading" style={{ fontFamily: 'var(--font-cormorant), serif', fontSize: '24px', fontWeight: 700, color: '#1a2f51', margin: '0 40px 16px 0', lineHeight: 1.15 }}>
          {action === 'heart' ? 'Save it for…' : 'Add it for…'}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {readers.map(r => {
            const name = r.nickname || r.name
            const saved = action === 'heart' && !!savedFor?.includes(r.id)
            return (
              <button key={r.id} onClick={e => onChoose(r, e)}
                style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '10px 14px', borderRadius: '16px', cursor: 'pointer', textAlign: 'left',
                  backgroundColor: saved ? 'rgba(224,85,119,0.08)' : '#ffffff', border: `1.5px solid ${saved ? 'rgba(224,85,119,0.35)' : 'rgba(26,47,81,0.12)'}` }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '50%', backgroundColor: 'rgba(26,47,81,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <AvatarFace id={r.avatar_id} fallback={<span style={{ fontFamily: 'var(--font-cormorant), serif', fontSize: '20px', fontWeight: 700, color: '#1a2f51' }}>{name[0]?.toUpperCase()}</span>} />
                </div>
                <span className="ccs-name" style={{ flex: 1, fontFamily: 'var(--font-cormorant), serif', fontSize: '20px', fontWeight: 700, color: '#1a2f51', lineHeight: 1 }}>{name}</span>
                {action === 'heart'
                  ? saved
                    ? <span style={{ fontFamily: font, fontSize: '13px', fontWeight: 600, color: '#c0405e' }}>Remove</span>
                    : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1a2f51" strokeWidth="2" style={{ opacity: 0.45 }}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                  : <span style={{ fontFamily: font, fontSize: '22px', fontWeight: 600, color: '#1a2f51', opacity: 0.5, lineHeight: 1 }}>+</span>}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
