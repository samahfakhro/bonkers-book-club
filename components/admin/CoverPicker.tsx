'use client'
// Book cover from a photo of your own copy or an uploaded image, with a crop step so table edges and fingers don't show.
// Calls onPicked with a JPEG data URL (at most 1200px tall).
import { useCallback, useState } from 'react'
import Cropper, { type Area } from 'react-easy-crop'

const SHAPES = [
  { label: 'Book', aspect: 2 / 3 },
  { label: 'Tall', aspect: 3 / 4 },
  { label: 'Square', aspect: 1 },
  { label: 'Wide', aspect: 4 / 3 },
]

async function cropToDataUrl(src: string, area: Area): Promise<string> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = src })
  const scale = Math.min(1, 1200 / area.height)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(area.width * scale); canvas.height = Math.round(area.height * scale)
  canvas.getContext('2d')!.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.88)
}

const btn: React.CSSProperties = { fontSize: '12px', fontWeight: 600, color: '#1a2f51', border: '1px solid #d4d4d4', borderRadius: '8px', padding: '7px 10px', cursor: 'pointer', backgroundColor: '#fff' }
const pickBtn: React.CSSProperties = { ...btn, backgroundColor: '#1a2f51', color: '#fff', border: 'none', padding: '9px 14px', display: 'inline-block' }

export default function CoverPicker({ onPicked, busy = false, title }: { onPicked: (dataUrl: string) => void; busy?: boolean; title?: string }) {
  const [src, setSrc] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [aspect, setAspect] = useState(2 / 3)
  const [area, setArea] = useState<Area | null>(null)
  const onComplete = useCallback((_: Area, px: Area) => setArea(px), [])

  const choose = (file?: File) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => { setSrc(String(reader.result)); setZoom(1); setCrop({ x: 0, y: 0 }) }
    reader.readAsDataURL(file)
  }

  return (
    <>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        <label style={{ ...pickBtn, opacity: busy ? 0.5 : 1 }}>
          📷 Take photo
          <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} disabled={busy} onChange={e => { choose(e.target.files?.[0]); e.target.value = '' }} />
        </label>
        <label style={{ ...pickBtn, opacity: busy ? 0.5 : 1 }}>
          ⬆ Upload image
          <input type="file" accept="image/*" style={{ display: 'none' }} disabled={busy} onChange={e => { choose(e.target.files?.[0]); e.target.value = '' }} />
        </label>
      </div>

      {src && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1100, backgroundColor: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ width: '100%', maxWidth: '560px', backgroundColor: '#fff', borderRadius: '14px', overflow: 'hidden' }}>
            <div style={{ position: 'relative', height: 'min(60vh, 460px)', backgroundColor: '#111' }}>
              <Cropper image={src} crop={crop} zoom={zoom} aspect={aspect} onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={onComplete} />
            </div>
            <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {title && <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#1a2f51' }}>Cover for: {title}</p>}
              <p style={{ margin: 0, fontSize: '12px', color: '#6b6b6b' }}>Drag to position the cover inside the box, pinch or use the slider to zoom.</p>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                {SHAPES.map(s => (
                  <button key={s.label} type="button" onClick={() => setAspect(s.aspect)}
                    style={{ ...btn, backgroundColor: aspect === s.aspect ? '#1a2f51' : '#fff', color: aspect === s.aspect ? '#fff' : '#1a2f51' }}>{s.label}</button>
                ))}
                <input type="range" min={1} max={4} step={0.05} value={zoom} onChange={e => setZoom(Number(e.target.value))} style={{ flex: 1, minWidth: '120px' }} aria-label="Zoom" />
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setSrc(null)} style={btn}>Cancel</button>
                <button type="button" disabled={!area}
                  onClick={async () => { if (!area) return; const url = await cropToDataUrl(src, area); setSrc(null); onPicked(url) }}
                  style={{ ...btn, backgroundColor: '#1a2f51', color: '#fff', border: 'none' }}>Use this cover</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
