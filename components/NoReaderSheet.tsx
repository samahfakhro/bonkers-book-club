'use client'

// Shown when a family with no reader profiles taps a heart or basket in the library.
export default function NoReaderSheet({ onAdd, onClose }: { onAdd: () => void; onClose: () => void }) {
  const font = 'var(--font-montserrat), sans-serif'
  const whisker = { position: 'absolute' as const, height: '44px', width: 'auto', pointerEvents: 'none' as const, zIndex: 1 }
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, backgroundColor: 'rgba(26,47,81,0.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: '576px', backgroundColor: '#fefaf2', borderRadius: '24px 24px 0 0', padding: '32px 24px 40px', boxShadow: '0 -8px 32px rgba(26,47,81,0.2)', textAlign: 'center' }}>
        <img src="/bonky_family.png" alt="" style={{ height: '72px', width: 'auto', marginBottom: '16px' }} />
        <p style={{ fontFamily: 'var(--font-cormorant), serif', color: '#1a2f51', fontSize: '1.6rem', fontWeight: 700, margin: '0 0 10px', lineHeight: 1.15 }}>Tiny problem. No tiny humans.</p>
        <p style={{ fontFamily: font, color: '#1a2f51', fontSize: '0.95rem', lineHeight: 1.6, margin: '0 0 4px' }}>We need at least one child profile before the book choosing can begin.</p>
        <p style={{ fontFamily: font, color: '#1a2f51', fontSize: '0.95rem', lineHeight: 1.6, margin: '0 0 26px' }}>Add your reader and we&apos;ll take it from there.</p>
        <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
          <img src="/whiskers_left.png" alt="" style={{ ...whisker, left: '-34px' }} />
          <button onClick={onAdd}
            style={{ fontFamily: font, fontWeight: 600, fontSize: '0.85rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#fff', backgroundColor: '#1a2f51', border: 'none', borderRadius: '999px', padding: '14px 32px', cursor: 'pointer' }}>
            Add a reader
          </button>
          <img src="/whiskers_right.png" alt="" style={{ ...whisker, right: '-34px' }} />
        </div>
        <button onClick={onClose}
          style={{ display: 'block', margin: '18px auto 0', background: 'none', border: 'none', fontFamily: font, fontSize: '0.9rem', color: '#1a2f51', textDecoration: 'underline', textUnderlineOffset: '3px', cursor: 'pointer' }}>
          I&apos;ll do it later
        </button>
      </div>
    </div>
  )
}
