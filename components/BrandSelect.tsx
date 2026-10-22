'use client'

import { useEffect, useRef, useState } from 'react'

// A dropdown in the Curious Library style. The browser's own <select> list can't be styled
// (phones draw it themselves), so this one draws its own menu.
type Option = { value: string; label: string }

export default function BrandSelect({ value, options, onChange, placeholder = 'Choose one…', fontSize = '1rem' }: {
  value: string; options: Option[]; onChange: (value: string) => void; placeholder?: string; fontSize?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selected = options.find(o => o.value === value)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent | TouchEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', close)
    document.addEventListener('touchstart', close)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('touchstart', close); document.removeEventListener('keydown', esc) }
  }, [open])

  const font = 'var(--font-montserrat), sans-serif'
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" onClick={() => setOpen(o => !o)} aria-haspopup="listbox" aria-expanded={open}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
          padding: '12px 16px', borderRadius: '12px', cursor: 'pointer', textAlign: 'left',
          border: open ? '2px solid #fee297' : '1px solid #ddd6cc', backgroundColor: '#fff',
          fontFamily: font, fontSize, color: selected ? '#1a2744' : '#9a9187', transition: 'border-color 0.15s',
        }}>
        <span>{selected ? selected.label : placeholder}</span>
        <svg width="12" height="8" viewBox="0 0 12 8" fill="none" style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
          <path d="M1 1l5 5 5-5" stroke="#1a2f51" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div role="listbox" style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 20,
          backgroundColor: '#fffef9', border: '2px solid #fee297', borderRadius: '16px', padding: '6px',
          boxShadow: '0 10px 28px rgba(26,47,81,0.14)', maxHeight: '280px', overflowY: 'auto',
        }}>
          {options.map(o => {
            const isSel = o.value === value
            return (
              <button key={o.value} type="button" role="option" aria-selected={isSel}
                onClick={() => { onChange(o.value); setOpen(false) }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: '10px', textAlign: 'left',
                  padding: '11px 12px', border: 'none', borderRadius: '10px', cursor: 'pointer',
                  backgroundColor: isSel ? '#fef3cd' : 'transparent', fontFamily: font, fontSize,
                  color: '#1a2744', fontWeight: isSel ? 600 : 500,
                }}
                onMouseEnter={e => { if (!isSel) e.currentTarget.style.backgroundColor = '#fdf8ea' }}
                onMouseLeave={e => { if (!isSel) e.currentTarget.style.backgroundColor = 'transparent' }}>
                <img src="/sparklestar_yellow.png" alt="" style={{ width: '16px', height: '16px', flexShrink: 0, opacity: isSel ? 1 : 0 }} />
                {o.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
