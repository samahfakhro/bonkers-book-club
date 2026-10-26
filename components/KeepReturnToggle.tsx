'use client'
// Keep / Return slider under a book at home: both choices always visible, navy slides to the chosen one.
// Used on the child profile, the parent's Home ("Your Readers") and the "next delivery is full" sheet.

export default function KeepReturnToggle({ returning, onChange, disabled = false }: {
  returning: boolean
  onChange: (returning: boolean) => void
  disabled?: boolean
}) {
  const half: React.CSSProperties = {
    position: 'relative', zIndex: 1, flex: 1, textAlign: 'center', padding: '5px 0',
    fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 700, fontSize: '0.62rem', letterSpacing: '0.04em',
    transition: 'color 0.2s',
  }
  return (
    <button type="button" role="switch" aria-checked={returning} aria-label={returning ? 'Returning — tap to keep' : 'Keeping — tap to return'}
      onClick={() => !disabled && onChange(!returning)} disabled={disabled}
      style={{ position: 'relative', display: 'flex', width: '100%', maxWidth: '120px', margin: '6px auto 0', padding: '3px', borderRadius: '999px',
        border: 'none', backgroundColor: '#ece5d8', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.6 : 1 }}>
      <span aria-hidden style={{ position: 'absolute', top: '3px', bottom: '3px', left: returning ? '50%' : '3px', width: 'calc(50% - 3px)',
        borderRadius: '999px', backgroundColor: '#1a2f51', transition: 'left 0.2s ease' }} />
      <span style={{ ...half, color: returning ? '#1a2f51' : '#fefaf2' }}>Keep</span>
      <span style={{ ...half, color: returning ? '#fefaf2' : '#1a2f51' }}>Return</span>
    </button>
  )
}
