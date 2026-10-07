'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const BOOK_SLOTS = [
  {l:'0.0%',t:'17.2%',h:'16.7%'},{l:'1.1%',t:'18.1%',h:'16.4%'},{l:'3.0%',t:'18.7%',h:'16.2%'},
  {l:'4.1%',t:'21.3%',h:'13.9%'},{l:'6.2%',t:'20.8%',h:'15.1%'},{l:'7.7%',t:'22.4%',h:'14.0%'},
  {l:'9.3%',t:'22.1%',h:'14.6%'},{l:'10.5%',t:'22.4%',h:'14.7%'},{l:'11.8%',t:'23.9%',h:'13.5%'},
  {l:'13.7%',t:'24.0%',h:'13.7%'},{l:'14.7%',t:'24.5%',h:'13.9%'},{l:'17.6%',t:'26.1%',h:'12.5%'},
  {l:'18.8%',t:'26.5%',h:'12.4%'},{l:'20.2%',t:'27.5%',h:'11.6%'},{l:'20.1%',t:'26.6%',h:'12.8%'},
  {l:'22.2%',t:'27.1%',h:'12.5%'},{l:'23.0%',t:'28.8%',h:'11.2%'},{l:'24.0%',t:'28.3%',h:'12.1%'},
  {l:'26.3%',t:'29.4%',h:'10.9%'},{l:'26.8%',t:'29.5%',h:'11.3%'},{l:'27.8%',t:'30.2%',h:'10.9%'},
  {l:'28.3%',t:'30.0%',h:'11.5%'},{l:'30.3%',t:'31.4%',h:'10.4%'},{l:'31.8%',t:'32.2%',h:'9.7%'},
  {l:'31.6%',t:'31.2%',h:'10.7%'},{l:'33.3%',t:'32.5%',h:'9.8%'},{l:'34.1%',t:'32.5%',h:'9.8%'},
  {l:'34.3%',t:'32.3%',h:'10.3%'},{l:'35.9%',t:'33.7%',h:'9.2%'},{l:'36.7%',t:'33.6%',h:'9.2%'},
  {l:'36.7%',t:'33.2%',h:'9.9%'},{l:'38.3%',t:'34.2%',h:'9.2%'},{l:'40.0%',t:'34.5%',h:'8.7%'},
  {l:'40.6%',t:'35.1%',h:'8.9%'},{l:'41.6%',t:'35.7%',h:'8.2%'},{l:'42.5%',t:'35.9%',h:'8.5%'},
  {l:'42.8%',t:'35.7%',h:'8.8%'},{l:'44.2%',t:'35.9%',h:'8.2%'},{l:'44.7%',t:'36.6%',h:'8.0%'},
  {l:'45.5%',t:'37.2%',h:'7.4%'},{l:'45.9%',t:'36.9%',h:'7.9%'},{l:'46.7%',t:'37.5%',h:'7.3%'},
  {l:'47.1%',t:'37.0%',h:'7.8%'},
  {l:'0.0%',t:'40.3%',h:'15.8%'},{l:'0.6%',t:'39.7%',h:'16.3%'},{l:'3.3%',t:'40.7%',h:'14.9%'},
  {l:'4.5%',t:'40.3%',h:'15.4%'},{l:'7.4%',t:'40.9%',h:'14.9%'},{l:'8.8%',t:'42.3%',h:'13.4%'},
  {l:'10.2%',t:'41.9%',h:'13.8%'},{l:'11.2%',t:'41.3%',h:'14.1%'},{l:'14.4%',t:'43.0%',h:'12.6%'},
  {l:'16.1%',t:'43.1%',h:'12.3%'},{l:'17.6%',t:'43.6%',h:'11.7%'},{l:'19.0%',t:'43.7%',h:'11.7%'},
  {l:'20.4%',t:'43.7%',h:'11.6%'},{l:'21.8%',t:'43.8%',h:'11.4%'},{l:'23.1%',t:'44.6%',h:'10.5%'},
  {l:'24.4%',t:'44.2%',h:'11.1%'},{l:'26.0%',t:'44.4%',h:'10.7%'},{l:'27.0%',t:'44.6%',h:'10.5%'},
  {l:'28.5%',t:'44.9%',h:'10.5%'},{l:'29.8%',t:'45.5%',h:'9.7%'},{l:'30.1%',t:'44.3%',h:'10.7%'},
  {l:'31.6%',t:'45.4%',h:'9.9%'},{l:'32.8%',t:'45.9%',h:'9.5%'},{l:'33.9%',t:'45.6%',h:'9.5%'},
  {l:'34.4%',t:'45.7%',h:'9.1%'},{l:'34.8%',t:'45.3%',h:'9.8%'},{l:'36.3%',t:'45.4%',h:'9.8%'},
  {l:'37.8%',t:'45.6%',h:'9.2%'},{l:'38.3%',t:'45.7%',h:'9.2%'},{l:'39.3%',t:'46.0%',h:'9.2%'},
  {l:'40.4%',t:'46.0%',h:'9.2%'},{l:'41.1%',t:'46.0%',h:'9.0%'},{l:'42.6%',t:'46.2%',h:'8.4%'},
  {l:'43.3%',t:'46.5%',h:'8.5%'},{l:'44.2%',t:'46.1%',h:'9.0%'},{l:'44.9%',t:'46.2%',h:'8.7%'},
  {l:'45.8%',t:'46.5%',h:'8.4%'},{l:'46.3%',t:'47.1%',h:'7.9%'},{l:'46.7%',t:'47.1%',h:'7.7%'},
  {l:'47.4%',t:'47.0%',h:'7.9%'},
]

const SPINE_COLOURS = ['#7C3D6B', '#2F5C8B', '#4A7A3E', '#7A3C2F', '#5A4A8B', '#2F7070', '#8B5C2F', '#3A5C4A']
function spineColor(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = ((h * 31) + id.charCodeAt(i)) & 0xffffffff
  return SPINE_COLOURS[Math.abs(h) % SPINE_COLOURS.length]
}

type ReadBook = {
  loanId: string
  book: { id: string; title: string; cover_url: string | null; author: string | null }
  returnedAt: string | null
  rating: number | null
}

export default function UniversePage() {
  const router = useRouter()
  const params = useParams()
  const childId = params.id as string

  const universeRef = useRef<HTMLDivElement>(null)
  const roomScrollRef = useRef<HTMLDivElement>(null)

  const [readBooks, setReadBooks] = useState<ReadBook[]>([])
  const [childName, setChildName] = useState('')

  const [insideHouse, setInsideHouse] = useState(false)
  const [doorOpen, setDoorOpen] = useState(false)
  const [roomSpineSelected, setRoomSpineSelected] = useState<number | null>(null)

  const bonkyHour = new Date().getHours()
  const isBonkyTime = bonkyHour >= 6 && bonkyHour < 19
  const [bonkyLooking, setBonkyLooking] = useState<'forward' | 'side'>('forward')
  const [bonkyBlink, setBonkyBlink] = useState(false)
  const [bonkyBreathing, setBonkyBreathing] = useState(false)
  const [bonkyZs, setBonkyZs] = useState<{ left: number; rot: number }[]>([])
  const [bonkyZKey, setBonkyZKey] = useState(0)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: child } = await supabase.from('child_profiles').select('name, nickname').eq('id', childId).single()
      if (child) setChildName(child.nickname || child.name || '')

      const { data: returned } = await supabase.from('loans').select('id, returned_at, book_copies(books(id, title, cover_image_url, author))').eq('child_id', childId).eq('status', 'returned').order('returned_at', { ascending: false })
      let reviewMap = new Map<string, number>()
      try {
        const { data: reviews } = await supabase.from('book_reviews').select('book_id, star_rating').eq('child_id', childId)
        for (const r of reviews || []) if (r.star_rating) reviewMap.set(r.book_id, r.star_rating)
      } catch {}
      const read: ReadBook[] = []
      for (const l of returned || []) {
        const raw = (l as any).book_copies?.books
        if (raw) read.push({ loanId: l.id, book: { ...raw, cover_url: raw.cover_image_url ?? null }, returnedAt: (l as any).returned_at ?? null, rating: reviewMap.get(raw.id) ?? null })
      }
      setReadBooks(read)
    }
    load()
  }, [childId, router])

  // Centre universe once image has loaded
  const centreUniverse = () => {
    if (universeRef.current) {
      const el = universeRef.current
      el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2
    }
  }
  useEffect(() => {
    centreUniverse()
  }, [])

  // Bonky day animations
  useEffect(() => {
    if (!isBonkyTime) return
    const blinkId = setInterval(() => {
      setBonkyBlink(true)
      setTimeout(() => setBonkyBlink(false), 180)
    }, 3200 + Math.random() * 2000)
    const lookId = setInterval(() => {
      setBonkyLooking(p => p === 'forward' ? 'side' : 'forward')
    }, 4000 + Math.random() * 3000)
    return () => { clearInterval(blinkId); clearInterval(lookId) }
  }, [isBonkyTime])

  // Bonky night animations
  useEffect(() => {
    if (isBonkyTime) return
    const breathId = setInterval(() => {
      setBonkyBreathing(p => !p)
    }, 2200)
    const zsId = setInterval(() => {
      setBonkyZs([{ left: 60 + Math.random() * 20, rot: -15 + Math.random() * 30 }, { left: 65 + Math.random() * 20, rot: -10 + Math.random() * 20 }, { left: 70 + Math.random() * 20, rot: -5 + Math.random() * 15 }])
      setBonkyZKey(k => k + 1)
    }, 3000)
    return () => { clearInterval(breathId); clearInterval(zsId) }
  }, [isBonkyTime])

  return (
    <main style={{ width: '100dvw', height: '100dvh', backgroundColor: '#080402', position: 'relative', overflow: 'hidden' }}>
      <style>{`.uni-inner::-webkit-scrollbar{display:none} @keyframes bonky-z{0%{opacity:0;transform:translateY(0) scale(0.8)}15%{opacity:1}85%{opacity:1}100%{opacity:0;transform:translateY(-32px) scale(1.1)}}`}</style>

      {/* Top left: logo */}
      <div style={{ position: 'absolute', top: '20px', left: '16px', zIndex: 20, lineHeight: 1 }}>
        <p style={{ fontFamily: 'var(--font-amatic)', fontWeight: 700, fontSize: '2.4rem', color: '#eddbc3', letterSpacing: '0.04em', margin: 0 }}>BONKERS</p>
        <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600, fontSize: '0.45rem', color: '#eddbc3', letterSpacing: '0.18em', textTransform: 'uppercase', margin: '2px 0 0' }}>THE CHILDREN&apos;S LIBRARY</p>
      </div>

      {/* Bottom right: back button */}
      <button onClick={() => router.push(`/dashboard/children/${childId}`)} style={{ position: 'absolute', bottom: '12px', right: '12px', zIndex: 20, background: 'rgba(8,4,2,0.6)', border: '1px solid rgba(237,219,195,0.3)', borderRadius: '20px', padding: '7px 13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#eddbc3" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.6rem', color: '#eddbc3', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Back</span>
      </button>

      {/* Universe view */}
      <div style={{ position: 'absolute', inset: 0, opacity: insideHouse ? 0 : 1, transform: insideHouse ? 'scale(1.5)' : 'scale(1)', transformOrigin: '33% 55%', transition: 'transform 0.55s ease-in-out, opacity 0.55s ease-in-out', pointerEvents: insideHouse ? 'none' : 'auto' }}>
        <div ref={universeRef} className="uni-inner" style={{ height: '100%', overflowX: 'auto', scrollbarWidth: 'none', cursor: 'grab' }}>
          <div style={{ height: '100%', position: 'relative', display: 'inline-block', flexShrink: 0 }}>
            <div style={{ position: 'absolute', inset: 0, backgroundColor: '#080402' }} />
            <div style={{ position: 'absolute', inset: 0 }} />
            <div style={{ position: 'absolute', inset: 0 }} />
            <div style={{ position: 'relative', height: '100%' }}>
              <img src="/universe_bonky_home.png" alt="Bonky's Home" onLoad={centreUniverse} style={{ display: 'block', height: '100%', width: 'auto', maxWidth: 'none', pointerEvents: 'none' }} />
              <div onClick={() => { if (doorOpen || insideHouse) return; setDoorOpen(true); setTimeout(() => { setInsideHouse(true); setDoorOpen(false); setTimeout(() => { if (roomScrollRef.current) { const el = roomScrollRef.current; el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2 } }, 50) }, 700) }} style={{ position: 'absolute', left: '32.5%', top: '46.5%', height: '12.5%', cursor: 'pointer' }}>
                <img src="/bonkyhouse_opendoor.png" alt="" style={{ height: '100%', width: 'auto', opacity: doorOpen ? 1 : 0, transition: doorOpen ? 'opacity 0.2s ease' : 'opacity 0.6s ease', pointerEvents: 'none', display: 'block' }} />
              </div>
              {isBonkyTime && <div style={{ position: 'absolute', left: '41%', top: '49%', height: '15%', transform: 'translateX(-50%)', pointerEvents: 'none' }}>
                <img src="/bonky_reading2.png" alt="" style={{ display: 'block', height: '100%', width: 'auto', pointerEvents: 'none' }} />
                <img src="/bonky_reading3.png" alt="" style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: 'auto', opacity: bonkyLooking === 'side' && !bonkyBlink ? 1 : 0, display: 'block', pointerEvents: 'none' }} />
                <img src="/bonky_reading5.png" alt="" style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: 'auto', opacity: bonkyBlink ? 1 : 0, display: 'block', pointerEvents: 'none' }} />
              </div>}
              {!isBonkyTime && <div style={{ position: 'absolute', left: '13%', top: '41%', height: '9%', pointerEvents: 'none' }}>
                <img src="/bonky_sleeping1.png" alt="" style={{ display: 'block', height: '100%', width: 'auto', pointerEvents: 'none', transform: 'translateZ(0)' }} />
                <img src="/bonky_sleeping2.png" alt="" style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: 'auto', display: 'block', opacity: bonkyBreathing ? 1 : 0, transition: 'opacity 0.8s ease-in-out', pointerEvents: 'none', transform: 'translateZ(0)', willChange: 'opacity' }} />
                {bonkyZs.map((z, i) => (
                  <span key={`${bonkyZKey}-${i}`} style={{ position: 'absolute', top: `${5 + i * 8}%`, left: `${z.left}%`, fontFamily: 'var(--font-amatic)', fontWeight: 700, fontSize: '0.6rem', color: '#c9b8e8', pointerEvents: 'none', animation: 'bonky-z 2.5s ease-out forwards', transform: `rotate(${z.rot}deg)`, display: 'inline-block', lineHeight: 1 }}>z</span>
                ))}
              </div>}
            </div>
          </div>
        </div>
      </div>

      {/* Room view */}
      <div style={{ position: 'absolute', inset: 0, opacity: insideHouse ? 1 : 0, transform: insideHouse ? 'scale(1)' : 'scale(1.2)', transformOrigin: '90% 50%', transition: 'transform 0.55s ease-in-out, opacity 0.55s ease-in-out', pointerEvents: insideHouse ? 'auto' : 'none' }}>
        <div ref={roomScrollRef} style={{ height: '100%', overflowX: 'auto', scrollbarWidth: 'none' }}>
          <div style={{ height: '100%', position: 'relative', display: 'inline-block', flexShrink: 0 }} onClick={() => setRoomSpineSelected(null)}>
            <img src="/bonkyhouse_room.png" alt="" style={{ display: 'block', height: '100%', width: 'auto', maxWidth: 'none', pointerEvents: 'none' }} />
            {[...readBooks].reverse().slice(0, BOOK_SLOTS.length).map((rb, i) => (
              <img key={rb.loanId} src={`/spines/layer%20${i + 1}.png`} alt="" onClick={e => { e.stopPropagation(); setRoomSpineSelected(roomSpineSelected === i ? null : i) }} style={{ position: 'absolute', left: BOOK_SLOTS[i].l, top: BOOK_SLOTS[i].t, height: BOOK_SLOTS[i].h, width: 'auto', display: 'block', cursor: 'pointer' }} />
            ))}
            {roomSpineSelected !== null && (() => {
              const reversedBooks = [...readBooks].reverse()
              const rb = reversedBooks[roomSpineSelected]
              const spineLeft = parseFloat(BOOK_SLOTS[roomSpineSelected].l)
              const spineTop = parseFloat(BOOK_SLOTS[roomSpineSelected].t)
              const popupLeft = spineLeft > 60 ? spineLeft - 20 : spineLeft + 3
              const popupTop = Math.max(1, spineTop - 3)
              return (
                <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', left: `${popupLeft}%`, top: `${popupTop}%`, width: '18%', backgroundColor: 'rgba(12,6,2,0.95)', border: '1px solid rgba(237,219,195,0.25)', borderRadius: '10px', padding: '10px 10px 12px', zIndex: 20, boxShadow: '0 8px 24px rgba(0,0,0,0.7)' }}>
                  <p style={{ fontFamily: 'var(--font-amatic)', fontWeight: 700, fontSize: '0.8rem', color: '#f9d174', margin: '0 0 5px', lineHeight: 1 }}>Book {roomSpineSelected + 1}</p>
                  {rb ? (
                    <>
                      <button onClick={() => router.push(`/dashboard/library/${rb.book.id}?from=child&childId=${childId}`)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', width: '100%', textAlign: 'left' }}>
                        {rb.book.cover_url && <img src={rb.book.cover_url} alt="" style={{ width: '100%', borderRadius: '6px', display: 'block', marginBottom: '6px' }} />}
                        <p style={{ fontFamily: 'var(--font-cormorant), serif', fontWeight: 700, fontSize: '0.8rem', color: '#eddbc3', margin: '0 0 2px', lineHeight: 1.3 }}>{rb.book.title}</p>
                        {rb.book.author && <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.48rem', color: 'rgba(237,219,195,0.45)', margin: '0 0 4px' }}>{rb.book.author}</p>}
                      </button>
                      {rb.returnedAt && <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.45rem', color: 'rgba(237,219,195,0.35)', margin: '0 0 6px' }}>Read {new Date(rb.returnedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>}
                      <button onClick={() => router.push(`/dashboard/children/${childId}/reviews?bookId=${rb.book.id}`)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', gap: '2px' }}>
                        {[1,2,3,4,5].map(s => <span key={s} style={{ fontSize: '0.7rem', opacity: rb.rating !== null ? (s <= rb.rating! ? 1 : 0.2) : 0.25 }}>⭐</span>)}
                      </button>
                    </>
                  ) : (
                    <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.5rem', color: 'rgba(237,219,195,0.35)', margin: 0 }}>No book data yet</p>
                  )}
                </div>
              )
            })()}
            <div onClick={() => setInsideHouse(false)} style={{ position: 'absolute', right: 0, top: '20%', width: '16%', height: '78%', cursor: 'pointer' }} />
          </div>
        </div>
      </div>
    </main>
  )
}
