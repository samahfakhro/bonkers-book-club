'use client'

import { useEffect, useState } from 'react'

// The landing page artwork, with the eye in the "O" coming to life: now and then it blinks,
// and now and then it glances right and back. Random timing, never busy.
// The overlays (right.png / closed.png) are cut from the artwork at the same scale; they sit at
// x 810, y 462 on the 1536 × 1024 picture and are 216 × 284.
const ART = { src: '/The%20Curious%20Library%20Adventure(1).png', w: 1536, h: 1024 }
const EYE = { x: 810, y: 462, w: 216, h: 284 }

type Look = 'left' | 'right' | 'closed'
const wait = (ms: number) => new Promise(r => setTimeout(r, ms))
const between = (a: number, b: number) => a + Math.random() * (b - a)

export default function CuriousHero() {
  const [look, setLook] = useState<Look>('left')

  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    let alive = true
    const blink = async () => { setLook('closed'); await wait(140); if (alive) setLook('left') }
    ;(async () => {
      await wait(between(2500, 4500))
      while (alive) {
        const r = Math.random()
        if (r < 0.55) await blink()
        else if (r < 0.7) { await blink(); await wait(180); if (alive) await blink() }            // double blink
        else {                                                                                       // glance right, then back
          setLook('right'); await wait(between(1200, 2600))
          if (!alive) break
          if (Math.random() < 0.4) { setLook('closed'); await wait(140); if (alive) setLook('right'); await wait(500) }
          if (alive) setLook('left')
        }
        await wait(between(3500, 8000))
      }
    })()
    return () => { alive = false }
  }, [])

  const pct = (v: number, of: number) => `${(v / of) * 100}%`
  const overlay = (src: string, show: boolean) => (
    <img src={src} alt="" aria-hidden style={{
      position: 'absolute', left: pct(EYE.x, ART.w), top: pct(EYE.y, ART.h), width: pct(EYE.w, ART.w), height: 'auto',
      display: 'block', pointerEvents: 'none', opacity: show ? 1 : 0,
    }} />
  )

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <img src={ART.src} alt="The Curious Library" style={{ width: '100%', display: 'block', height: 'auto' }} />
      {/* both overlays stay loaded so switching is instant */}
      {overlay('/right.png', look === 'right')}
      {overlay('/closed.png', look === 'closed')}
    </div>
  )
}
