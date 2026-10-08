'use client'

import { useEffect, useRef, useState } from 'react'

// Phone-camera barcode scanner (works on iPhone and Android). Calls onCode for each code it reads;
// the same code is ignored for 2 seconds so one envelope isn't counted repeatedly.
// If the camera can't start, the driver can type the code instead.
export default function EnvelopeScanner({ onCode, onClose, feedback }: { onCode: (code: string) => void; onClose: () => void; feedback?: { ok: boolean; text: string } | null }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [typed, setTyped] = useState('')
  const last = useRef<{ code: string; at: number }>({ code: '', at: 0 })
  const onCodeRef = useRef(onCode)
  onCodeRef.current = onCode

  useEffect(() => {
    let controls: { stop: () => void } | null = null
    let cancelled = false
    ;(async () => {
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/browser')
        const reader = new BrowserMultiFormatReader()
        if (cancelled || !videoRef.current) return
        controls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: 'environment' } } },
          videoRef.current,
          (result) => {
            if (!result) return
            const code = result.getText().trim()
            const now = Date.now()
            if (code === last.current.code && now - last.current.at < 2000) return
            last.current = { code, at: now }
            if (navigator.vibrate) navigator.vibrate(60)
            onCodeRef.current(code)
          },
        )
        if (cancelled) controls.stop()
      } catch (e: any) {
        if (!cancelled) setError(e?.name === 'NotAllowedError'
          ? 'Camera permission was refused. Allow the camera for this site, or type the code below.'
          : 'The camera couldn’t start. Type the code from the label below.')
      }
    })()
    return () => { cancelled = true; controls?.stop() }
  }, [])

  const submitTyped = () => { const c = typed.trim(); if (c) { onCode(c); setTyped('') } }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,16,30,0.94)', zIndex: 100, display: 'flex', flexDirection: 'column', padding: '16px', color: '#fff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <strong style={{ fontSize: '18px' }}>Scan envelope labels</strong>
        <button onClick={onClose} style={{ background: '#fee297', color: '#1a2744', border: 'none', borderRadius: '999px', padding: '12px 22px', fontWeight: 800, fontSize: '16px' }}>Done</button>
      </div>
      {error
        ? <p style={{ background: '#3a1f1f', borderRadius: '12px', padding: '14px', lineHeight: 1.5 }}>{error}</p>
        : <video ref={videoRef} muted playsInline style={{ width: '100%', flex: 1, minHeight: 0, objectFit: 'cover', borderRadius: '16px', background: '#000' }} />}
      {feedback && <p style={{ margin: '12px 0 0', padding: '14px', borderRadius: '12px', fontSize: '18px', fontWeight: 800, textAlign: 'center', background: feedback.ok ? '#1f7a3a' : '#b3261e' }}>{feedback.text}</p>}
      <p style={{ margin: '12px 0 8px', fontSize: '14px', opacity: 0.8 }}>Point the camera at the barcode. Or type the code:</p>
      <div style={{ display: 'flex', gap: '8px' }}>
        <input value={typed} onChange={e => setTyped(e.target.value.toUpperCase())} onKeyDown={e => { if (e.key === 'Enter') submitTyped() }}
          placeholder="e.g. 4F7A2C9E1B3D-1" autoCapitalize="characters"
          style={{ flex: 1, minWidth: 0, padding: '14px', fontSize: '17px', borderRadius: '12px', border: 'none', fontFamily: 'monospace' }} />
        <button onClick={submitTyped} style={{ background: '#fff', color: '#1a2744', border: 'none', borderRadius: '12px', padding: '0 18px', fontWeight: 800, fontSize: '16px' }}>Add</button>
      </div>
    </div>
  )
}
