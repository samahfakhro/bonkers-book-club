'use client'
// Print CUR copy labels on A4 sticker sheets. Each label: "The Curious Library", a barcode, and the code.
// Stick one on each book, then scan it when adding the book (Admin → Books).
import { Suspense, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import JsBarcode from 'jsbarcode'
import { supabase } from '@/lib/supabase'
import { copyCode, normaliseCopyLabel } from '@/lib/copy-codes'

// standard Avery layouts (mm)
const LAYOUTS = {
  '24': { name: '24 per sheet · 63.5 × 33.9 mm (Avery L7159)', cols: 3, rows: 8, w: 63.5, h: 33.9, top: 12.9, left: 6.4, pitchX: 66.0, pitchY: 33.9 },
  '40': { name: '40 per sheet · 45.7 × 25.4 mm (Avery L7654)', cols: 4, rows: 10, w: 45.7, h: 25.4, top: 21.5, left: 9.7, pitchX: 48.3, pitchY: 25.4 },
} as const
type LayoutKey = keyof typeof LAYOUTS

const LAST_PRINTED_KEY = 'curious-labels-last-printed'

function Barcode({ value, height }: { value: string; height: number }) {
  const ref = useRef<SVGSVGElement>(null)
  useEffect(() => {
    if (ref.current) JsBarcode(ref.current, value, { format: 'CODE128', displayValue: false, margin: 0, height, width: 1.4, background: 'transparent' })
  }, [value, height])
  return <svg ref={ref} style={{ display: 'block', maxWidth: '100%', height: 'auto' }} />
}

function LabelsPageInner() {
  // ?codes=CUR-0042 → reprint just those labels (e.g. a label fell off), in any position on a part-used sheet
  const reprint = (useSearchParams().get('codes') || '').split(',').map(c => normaliseCopyLabel(c)).filter((c): c is string => !!c)
  const [layoutKey, setLayoutKey] = useState<LayoutKey>('24')
  const [start, setStart] = useState(1)
  const [sheets, setSheets] = useState(1)
  const [skip, setSkip] = useState(0)              // labels already used on a partly used sheet
  const [highestUsed, setHighestUsed] = useState(0)
  const layout = LAYOUTS[layoutKey]
  const perSheet = layout.cols * layout.rows

  // start after the highest label already on a book, or already printed on this computer
  useEffect(() => {
    supabase.from('book_copies').select('internal_id').like('internal_id', 'CUR-%').then(({ data }) => {
      const used = Math.max(0, ...(data || []).map((c: any) => parseInt(String(c.internal_id).slice(4), 10)).filter(Number.isFinite))
      let printed = 0
      try { printed = parseInt(localStorage.getItem(LAST_PRINTED_KEY) || '0', 10) || 0 } catch {}
      setHighestUsed(used)
      setStart(Math.max(used, printed) + 1)
    })
  }, [])

  const count = reprint.length ? reprint.length : Math.max(0, sheets * perSheet - skip)
  const codes = reprint.length ? reprint : Array.from({ length: count }, (_, i) => copyCode(start + i))
  const slots: (string | null)[] = [...Array(skip).fill(null), ...codes]
  const pages: (string | null)[][] = []
  for (let i = 0; i < slots.length; i += perSheet) pages.push(slots.slice(i, i + perSheet))

  function print() {
    if (!reprint.length) try { localStorage.setItem(LAST_PRINTED_KEY, String(start + count - 1)) } catch {}
    window.print()
  }

  const small = layoutKey === '40'
  const inp: React.CSSProperties = { padding: '8px 10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', width: '100%' }

  return (
    <div>
      <style>{`
        @page { size: A4; margin: 0; }
        @media print {
          body * { visibility: hidden; }
          .label-sheets, .label-sheets * { visibility: visible; }
          .label-sheets { position: absolute; left: 0; top: 0; }
          .sheet { box-shadow: none !important; margin: 0 !important; border: none !important; }
          .label { outline: none !important; }
        }
      `}</style>

      <div style={{ padding: '24px', maxWidth: '760px' }}>
        <h1 style={{ fontSize: '22px', margin: '0 0 6px', color: '#1a1a1a' }}>{reprint.length ? `Reprint ${reprint.join(', ')}` : 'Print copy labels'}</h1>
        <p style={{ fontSize: '13px', color: '#6b6b6b', margin: '0 0 18px', lineHeight: 1.5 }}>
          Stick one label on each book, then scan it when you add the book in Books. Highest label already on a book: <strong>{highestUsed ? copyCode(highestUsed) : 'none yet'}</strong>.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '10px', alignItems: 'end' }}>
          <label style={{ fontSize: '12px', color: '#6b6b6b' }}>Sticker sheet
            <select style={inp} value={layoutKey} onChange={e => { setLayoutKey(e.target.value as LayoutKey); setSkip(0) }}>
              {(Object.keys(LAYOUTS) as LayoutKey[]).map(k => <option key={k} value={k}>{LAYOUTS[k].name}</option>)}
            </select>
          </label>
          {!reprint.length && <><label style={{ fontSize: '12px', color: '#6b6b6b' }}>First number
            <input style={inp} type="number" min={1} value={start} onChange={e => setStart(Math.max(1, parseInt(e.target.value, 10) || 1))} />
          </label>
          <label style={{ fontSize: '12px', color: '#6b6b6b' }}>Sheets
            <input style={inp} type="number" min={1} max={20} value={sheets} onChange={e => setSheets(Math.min(20, Math.max(1, parseInt(e.target.value, 10) || 1)))} />
          </label></>}
          <label style={{ fontSize: '12px', color: '#6b6b6b' }}>{reprint.length ? 'Print in position (skip this many)' : 'Skip used labels'}
            <input style={inp} type="number" min={0} max={perSheet - 1} value={skip} onChange={e => setSkip(Math.min(perSheet - 1, Math.max(0, parseInt(e.target.value, 10) || 0)))} />
          </label>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '14px' }}>
          <button onClick={print} disabled={!count} style={{ padding: '10px 20px', borderRadius: '999px', border: 'none', background: '#1a2f51', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
            Print {count} label{count === 1 ? '' : 's'}
          </button>
          <span style={{ fontSize: '13px', color: '#1a1a1a' }}>{count ? `${codes[0]} → ${codes[codes.length - 1]}` : ''}</span>
        </div>
        <p style={{ fontSize: '12px', color: '#6b6b6b', margin: '12px 0 0', lineHeight: 1.5 }}>
          Tip: print the first page on plain paper and hold it against a sticker sheet to check it lines up. In the print window choose <strong>A4</strong>, <strong>Actual size / 100%</strong> (not “Fit to page”) and no margins.
        </p>
      </div>

      <div className="label-sheets">
        {pages.map((page, p) => (
          <div key={p} className="sheet" style={{ position: 'relative', width: '210mm', height: '297mm', background: '#fff', margin: '0 24px 24px', boxShadow: '0 1px 6px rgba(0,0,0,0.15)', overflow: 'hidden', pageBreakAfter: 'always', breakAfter: 'page' }}>
            {page.map((code, i) => {
              const col = i % layout.cols, row = Math.floor(i / layout.cols)
              return (
                <div key={i} className="label" style={{
                  position: 'absolute', left: `${layout.left + col * layout.pitchX}mm`, top: `${layout.top + row * layout.pitchY}mm`,
                  width: `${layout.w}mm`, height: `${layout.h}mm`, outline: '1px dashed #e5e5e5', boxSizing: 'border-box',
                  padding: small ? '1.5mm 2.5mm' : '2.5mm 4mm', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: small ? '0.6mm' : '1mm',
                }}>
                  {code && <>
                    <div style={{ fontFamily: 'Georgia, serif', fontSize: small ? '6.5pt' : '8pt', fontWeight: 700, color: '#1a2f51', letterSpacing: '0.02em' }}>The Curious Library</div>
                    <Barcode value={code} height={small ? 28 : 40} />
                    <div style={{ fontFamily: 'Arial, sans-serif', fontSize: small ? '8pt' : '10pt', fontWeight: 700, color: '#1a2f51', letterSpacing: '0.08em' }}>{code}</div>
                  </>}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function LabelsPage() {
  return <Suspense fallback={null}><LabelsPageInner /></Suspense>
}
