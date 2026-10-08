'use client'

// Small shared building blocks for the driver screens: big, high-contrast, hard to mis-tap.
export const navy = '#1a2744'
export const cream = '#fefaf2'
export const yellow = '#fee297'

export function Screen({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: '20px 16px 120px', fontFamily: 'var(--font-montserrat), sans-serif', minHeight: '100vh', background: cream }}>{children}</div>
}

export function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ background: '#fff', border: '1px solid #ece4d6', borderRadius: '16px', padding: '14px 16px', marginBottom: '12px', ...style }}>{children}</div>
}

export function Big({ children, onClick, disabled, tone = 'navy', style }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; tone?: 'navy' | 'green' | 'red' | 'light'; style?: React.CSSProperties }) {
  const bg = tone === 'green' ? '#2e7d32' : tone === 'red' ? '#b3261e' : tone === 'light' ? '#fff' : navy
  const fg = tone === 'light' ? navy : '#fff'
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      style={{ width: '100%', minHeight: '58px', borderRadius: '14px', border: tone === 'light' ? `2px solid ${navy}` : 'none', background: bg, color: fg, fontSize: '18px', fontWeight: 800, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.4 : 1, padding: '10px 14px', ...style }}>
      {children}
    </button>
  )
}

export function Choice({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      style={{ width: '100%', minHeight: '54px', textAlign: 'left', borderRadius: '14px', border: `3px solid ${selected ? navy : '#e8e0d4'}`, background: selected ? '#eef1f8' : '#fff', color: navy, fontSize: '17px', fontWeight: 700, padding: '10px 14px', marginBottom: '8px', cursor: 'pointer' }}>
      {selected ? '● ' : '○ '}{children}
    </button>
  )
}
