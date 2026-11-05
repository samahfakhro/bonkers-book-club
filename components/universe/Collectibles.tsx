'use client'
// Collectibles a child has unlocked by reading (child_collectibles).
// They arrive wrapped (an egg for creatures, a parcel for everything else). In the expanded Universe the child
// opens each one, then drags it to a spot and taps "Put it here". Once it's out, it's out; it can only be moved.
// Positions are stored as % of the Universe picture, so they line up on every screen.
import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

export type Collectible = {
  id: string; name: string; image_url: string; lore: string | null; kind: 'creature' | 'thing'; wrapper: string
  pos_x: number | null; pos_y: number | null; opened_at: string | null; book_title: string | null
}

export function useChildCollectibles(childId: string) {
  const [items, setItems] = useState<Collectible[]>([])
  const reload = useCallback(async () => {
    const { data } = await supabase.from('child_collectibles')
      .select('id, name, image_url, kind, wrapper, pos_x, pos_y, opened_at, books(title, collectible_lore, collectible_lore_live)')
      .eq('child_id', childId).order('unlocked_at')
    // the lore line only shows once the team has reviewed and published it (and it's always the current version)
    setItems((data || []).map((c: any) => ({ ...c, book_title: c.books?.title ?? null, lore: c.books?.collectible_lore_live ? (c.books.collectible_lore || null) : null })))
  }, [childId])
  useEffect(() => { reload() }, [reload])
  return { items, setItems, reload }
}

export const wrapperSrc = (w: string) => `/universe/${/^(egg|parcel)-[123]$/.test(w) ? w : 'parcel-1'}.png`

const ITEM_HEIGHT = '16%'   // of the Universe picture's height (a little bigger than Bonky)

// ── Placed collectibles, drawn inside the Universe picture (read-only on the home page) ──
export function PlacedCollectibles({ items, onTap, hideId }: { items: Collectible[]; onTap?: (c: Collectible) => void; hideId?: string | null }) {
  return (
    <>
      {items.filter(c => c.pos_x != null && c.pos_y != null && c.id !== hideId).map(c => (
        <img key={c.id} src={c.image_url} alt={c.name} draggable={false}
          onClick={onTap ? e => { e.stopPropagation(); onTap(c) } : undefined}
          style={{ position: 'absolute', left: `${c.pos_x}%`, top: `${c.pos_y}%`, height: ITEM_HEIGHT, width: 'auto', transform: 'translate(-50%, -50%)',
            cursor: onTap ? 'pointer' : 'default', pointerEvents: onTap ? 'auto' : 'none', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.45))', zIndex: 5 }} />
      ))}
    </>
  )
}

// ── Everything for the expanded Universe: opening, placing, moving, and the little info card ──
export function useCollectibleFlow(childId: string, canvasRef: React.RefObject<HTMLDivElement | null>, scrollRef: React.RefObject<HTMLDivElement | null>) {
  const { items, setItems } = useChildCollectibles(childId)
  const [stage, setStage] = useState<'idle' | 'choose' | 'opening' | 'reveal' | 'placing' | 'info'>('idle')
  const [later, setLater] = useState(false)   // "Later" pressed: leave the rest wrapped for now
  const [current, setCurrent] = useState<Collectible | null>(null)
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 50, y: 60 })
  const dragging = useRef(false)

  const waiting = items.filter(c => !c.opened_at)                          // still wrapped
  const unplaced = items.filter(c => c.opened_at && c.pos_x == null)      // opened but never placed (e.g. app closed)

  // start with whatever needs attention: finish placing first, then the next wrapped one
  useEffect(() => {
    if (stage !== 'idle') return
    if (unplaced[0]) { startPlacing(unplaced[0]); return }
    if (waiting.length && !later) { setCurrent(null); setStage('choose') }
  }, [items, stage]) // eslint-disable-line react-hooks/exhaustive-deps

  function visibleCentre() {
    const canvas = canvasRef.current, scroller = scrollRef.current
    if (!canvas || !scroller) return { x: 50, y: 60 }
    const w = canvas.getBoundingClientRect().width || 1
    return { x: Math.min(95, Math.max(5, ((scroller.scrollLeft + scroller.clientWidth / 2) / w) * 100)), y: 62 }
  }

  async function open(c: Collectible) {
    setCurrent(c); setStage('opening')
    const now = new Date().toISOString()
    await supabase.from('child_collectibles').update({ opened_at: now }).eq('id', c.id)
    setItems(prev => prev.map(x => x.id === c.id ? { ...x, opened_at: now } : x))
    setTimeout(() => setStage('reveal'), 1100)
  }

  function startPlacing(c: Collectible) {
    setCurrent(c)
    setPos(c.pos_x != null && c.pos_y != null ? { x: c.pos_x, y: c.pos_y } : visibleCentre())
    setStage('placing')
  }

  async function putItHere() {
    if (!current) return
    const update = { pos_x: Math.round(pos.x * 10) / 10, pos_y: Math.round(pos.y * 10) / 10, placed_at: new Date().toISOString() }
    await supabase.from('child_collectibles').update(update).eq('id', current.id)
    setItems(prev => prev.map(c => c.id === current.id ? { ...c, ...update } : c))
    setCurrent(null); setStage('idle')
  }

  // dragging the collectible while placing (works with a finger or a mouse)
  function onPointerDown(e: React.PointerEvent) {
    dragging.current = true
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    e.preventDefault()
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragging.current || !canvasRef.current) return
    const r = canvasRef.current.getBoundingClientRect()
    setPos({ x: Math.min(98, Math.max(2, ((e.clientX - r.left) / r.width) * 100)), y: Math.min(95, Math.max(5, ((e.clientY - r.top) / r.height) * 100)) })
  }
  function onPointerUp() { dragging.current = false }

  const waitingItems = waiting
  return { items, waitingItems, later, setLater, stage, setStage, current, setCurrent, pos, open, startPlacing, putItHere, onPointerDown, onPointerMove, onPointerUp, waitingCount: waiting.length }
}

export const COLLECTIBLE_CSS = `
@keyframes cc-wobble{0%,100%{transform:rotate(-5deg)}50%{transform:rotate(5deg)}}
@keyframes cc-shake{0%,100%{transform:translateX(0) rotate(0)}15%{transform:translateX(-8px) rotate(-8deg)}30%{transform:translateX(8px) rotate(8deg)}45%{transform:translateX(-10px) rotate(-10deg)}60%{transform:translateX(10px) rotate(10deg)}75%{transform:translateX(-6px) rotate(-5deg)}}
@keyframes cc-burst{0%{transform:scale(1);opacity:1}100%{transform:scale(1.6);opacity:0}}
@keyframes cc-pop{0%{transform:scale(0) rotate(-20deg);opacity:0}60%{transform:scale(1.15) rotate(6deg);opacity:1}100%{transform:scale(1) rotate(0)}}
@keyframes cc-spark{0%{transform:translate(0,0) scale(1);opacity:1}100%{transform:translate(var(--dx),var(--dy)) scale(0.2);opacity:0}}
@keyframes cc-float{0%,100%{transform:translate(-50%,-50%) translateY(0)}50%{transform:translate(-50%,-50%) translateY(-6px)}}
`

const font = 'var(--font-montserrat), sans-serif'
const card: React.CSSProperties = { backgroundColor: '#fefaf2', borderRadius: '18px', padding: '18px 20px', boxShadow: '0 12px 40px rgba(0,0,0,0.5)', textAlign: 'center', maxWidth: '340px', width: 'calc(100% - 40px)' }
const primary: React.CSSProperties = { fontFamily: font, fontWeight: 700, fontSize: '0.9rem', backgroundColor: '#1a2f51', color: '#fefaf2', border: 'none', borderRadius: '999px', padding: '12px 22px', cursor: 'pointer' }

// ── The overlay: a wrapped surprise → opening → "you found…" ──
export function CollectibleOverlay({ flow }: { flow: ReturnType<typeof useCollectibleFlow> }) {
  const { stage, current } = flow
  if (stage === 'choose') {
    const list = flow.waitingItems
    const eggs = list.filter(c => c.kind === 'creature').length
    return (
      <div style={{ position: 'absolute', inset: 0, zIndex: 40, backgroundColor: 'rgba(8,10,30,0.72)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '18px', padding: '20px' }}>
        <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', justifyContent: 'center', maxWidth: '560px' }}>
          {list.map((c, i) => (
            <button key={c.id} onClick={() => flow.open(c)} aria-label="Open this surprise"
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', width: list.length > 3 ? '96px' : '130px', height: list.length > 3 ? '96px' : '130px' }}>
              <img src={wrapperSrc(c.wrapper)} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', animation: `cc-wobble 1.4s ease-in-out ${i * 0.25}s infinite`, filter: 'drop-shadow(0 0 12px rgba(249,209,116,0.6))' }} />
            </button>
          ))}
        </div>
        <div style={card}>
          <p style={{ fontFamily: 'var(--font-patrick-hand)', fontSize: '1.6rem', color: '#1a2f51', margin: '0 0 4px' }}>
            {list.length === 1 ? 'You have unlocked a collectible!' : `You have unlocked ${list.length} collectibles!`}
          </p>
          <p style={{ fontFamily: font, fontSize: '0.85rem', color: '#1a2f51', margin: '0 0 12px' }}>{list.length === 1 ? (eggs ? 'Tap the egg to hatch it.' : 'Tap it to open it.') : 'Tap the one you want to open first.'}</p>
          <button onClick={() => { flow.setLater(true); flow.setStage('idle') }} style={{ fontFamily: font, fontSize: '0.8rem', color: '#1a2f51', background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer' }}>Later</button>
        </div>
      </div>
    )
  }
  if (!current || !['opening', 'reveal'].includes(stage)) return null
  const isEgg = current.kind === 'creature'
  const sparks = Array.from({ length: 14 }, (_, i) => { const a = (i / 14) * Math.PI * 2; return { dx: `${Math.cos(a) * 140}px`, dy: `${Math.sin(a) * 140}px` } })
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 40, backgroundColor: 'rgba(8,10,30,0.72)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '18px' }}>
      <div style={{ position: 'relative', width: '220px', height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {stage === 'opening' && (
          <img src={wrapperSrc(current.wrapper)} alt=""
            style={{ maxWidth: '100%', maxHeight: '100%', animation: 'cc-shake 0.75s ease-in-out, cc-burst 0.35s ease-in 0.75s forwards' }} />
        )}
        {sparks.map((s, i) => (
          <span key={i} style={{ position: 'absolute', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: i % 2 ? '#f9d174' : '#fefaf2',
            boxShadow: '0 0 10px #f9d174', ['--dx' as string]: s.dx, ['--dy' as string]: s.dy, animation: 'cc-spark 0.9s ease-out 0.75s both' }} />
        ))}
        {stage === 'reveal' && (
          <img src={current.image_url} alt={current.name} style={{ maxWidth: '100%', maxHeight: '100%', animation: 'cc-pop 0.6s ease-out both', filter: 'drop-shadow(0 8px 14px rgba(0,0,0,0.5))' }} />
        )}
      </div>

      {stage === 'reveal' && (
        <div style={{ ...card, animation: 'cc-pop 0.5s ease-out 0.2s both' }}>
          <p style={{ fontFamily: 'var(--font-patrick-hand)', fontSize: '1.7rem', color: '#1a2f51', margin: '0 0 2px', lineHeight: 1.1 }}>{isEgg ? 'It hatched! ' : ''}You found {current.name}!</p>
          {current.book_title && <p style={{ fontFamily: font, fontSize: '0.8rem', color: '#1a2f51', opacity: 0.7, margin: '0 0 8px' }}>from <em>{current.book_title}</em></p>}
          {current.lore && <p style={{ fontFamily: font, fontSize: '0.8rem', color: '#1a2f51', fontStyle: 'italic', margin: '0 0 12px' }}>“{current.lore}”</p>}
          <button onClick={() => flow.startPlacing(current)} style={primary}>Where would you like to put it?</button>
        </div>
      )}
    </div>
  )
}

// ── While placing: the collectible itself (inside the picture) ──
export function PlacingCollectible({ flow }: { flow: ReturnType<typeof useCollectibleFlow> }) {
  if (flow.stage !== 'placing' || !flow.current) return null
  return (
    <img src={flow.current.image_url} alt={flow.current.name} draggable={false}
      onPointerDown={flow.onPointerDown} onPointerMove={flow.onPointerMove} onPointerUp={flow.onPointerUp} onPointerCancel={flow.onPointerUp}
      style={{ position: 'absolute', left: `${flow.pos.x}%`, top: `${flow.pos.y}%`, height: ITEM_HEIGHT, width: 'auto', transform: 'translate(-50%, -50%)',
        cursor: 'grab', touchAction: 'none', zIndex: 30, filter: 'drop-shadow(0 0 10px #f9d174) drop-shadow(0 6px 10px rgba(0,0,0,0.5))', animation: 'cc-float 1.6s ease-in-out infinite' }} />
  )
}

// ── While placing: the bar at the bottom of the screen; and the info card for a placed one ──
export function CollectibleControls({ flow }: { flow: ReturnType<typeof useCollectibleFlow> }) {
  const { stage, current } = flow
  // after "Later": a little wobbling surprise in the corner brings the rest back
  if (stage === 'idle' && flow.later && flow.waitingItems.length) return (
    <button onClick={() => flow.setLater(false)} aria-label="Open your surprises"
      style={{ position: 'absolute', left: '14px', bottom: '14px', zIndex: 45, width: '72px', height: '72px', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
      <img src={wrapperSrc(flow.waitingItems[0].wrapper)} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', animation: 'cc-wobble 1.4s ease-in-out infinite', filter: 'drop-shadow(0 0 12px rgba(249,209,116,0.7))' }} />
      <span style={{ position: 'absolute', top: '-4px', right: '-8px', backgroundColor: '#e8533a', color: '#fff', borderRadius: '999px', padding: '3px 8px', fontFamily: font, fontSize: '0.62rem', fontWeight: 800 }}>{flow.waitingItems.length}</span>
    </button>
  )
  if (stage === 'placing' && current) return (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: '16px', zIndex: 45, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
      <div style={{ ...card, pointerEvents: 'auto', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px', textAlign: 'left', maxWidth: '420px' }}>
        <p style={{ flex: 1, fontFamily: font, fontSize: '0.82rem', color: '#1a2f51', margin: 0 }}>Drag <strong>{current.name}</strong> to its new home.</p>
        <button onClick={flow.putItHere} style={{ ...primary, padding: '10px 16px', whiteSpace: 'nowrap' }}>Put it here ✓</button>
      </div>
    </div>
  )
  if (stage === 'info' && current) return (
    <div onClick={() => { flow.setCurrent(null); flow.setStage('idle') }} style={{ position: 'absolute', inset: 0, zIndex: 45, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: '16px' }}>
      <div onClick={e => e.stopPropagation()} style={{ ...card, display: 'flex', gap: '12px', alignItems: 'center', textAlign: 'left', maxWidth: '420px' }}>
        <img src={current.image_url} alt="" style={{ width: '64px', height: '64px', objectFit: 'contain', flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontFamily: 'var(--font-patrick-hand)', fontSize: '1.3rem', color: '#1a2f51', margin: 0, lineHeight: 1.1 }}>{current.name}</p>
          {current.book_title && <p style={{ fontFamily: font, fontSize: '0.72rem', color: '#1a2f51', opacity: 0.7, margin: '2px 0 0' }}>from <em>{current.book_title}</em></p>}
          {current.lore && <p style={{ fontFamily: font, fontSize: '0.72rem', color: '#1a2f51', fontStyle: 'italic', margin: '4px 0 0' }}>“{current.lore}”</p>}
        </div>
        <button onClick={() => flow.startPlacing(current)} style={{ ...primary, padding: '8px 14px', fontSize: '0.75rem' }}>Move</button>
      </div>
    </div>
  )
  return null
}
