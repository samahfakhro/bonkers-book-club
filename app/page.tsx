'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Book = { id: string; title: string; author: string; cover_image_url: string | null }
type ReadingLevel = { id: string; name: string }
type Category = { id: string; name: string }

function getCategoryBlob(name: string): string | null {
  const n = name.toLowerCase()
  if (n.includes('adventure')) return '/blob_adventure.png'
  if (n.includes('magic') || n.includes('mayhem')) return '/blob_magic.png'
  if (n.includes('heart')) return '/blob_heart.png'
  if (n.includes('laugh')) return '/blob_laugh.png'
  if (n.includes('weird')) return '/blob_weird.png'
  if (n.includes('true') || n.includes('bonkers')) return '/blob_true.png'
  if (n.includes('hero') || n.includes('legend')) return '/blob_hero.png'
  if (n.includes('mystery') || n.includes('mischief')) return '/blob_mystery.png'
  if (n.includes('spooky') || n.includes('scary')) return '/blob_spooky.png'
  return null
}

const AGE_MAP: Record<string, string> = { hatchling: '3–5 yrs', hatchlings: '3–5 yrs', '3-5': '3–5 yrs', chick: '5–7 yrs', chicks: '5–7 yrs', '5-7': '5–7 yrs', bird: '8–10 yrs', birds: '8–10 yrs', '8-10': '8–10 yrs' }
const DISPLAY_NAME_MAP: Record<string, string> = { '3-5': 'Hatchling', '5-7': 'Chick', '8-10': 'Bird' }

const GUEST_MESSAGES = [
  "Ooh, great choice!",
  "Love that one!",
  "Such a good pick!",
  "This one's a gem!",
  "Your kids are going to LOVE this!",
  "Excellent taste!",
  "A top-tier pick right there!",
  "We love this book too!",
  "This is such a good one!",
  "Brilliant choice!",
]

const FAQS = [
  { q: 'How often can we get new books?', a: 'As often as every week. Just open the app, choose your new books and let us know which ones you\'re returning. You can keep any you\'re still reading for as long as you like. On your community\'s next Bonkers Day, we\'ll collect the books you\'re returning and deliver your new ones.' },
  { q: 'What if we lose or damage a book?', a: 'We understand — kids and books can be a messy combination. Minor wear is totally fine. For lost or heavily damaged books, we may charge a replacement fee.' },
  { q: 'Can siblings share a membership?', a: 'Absolutely — that\'s how most families use Bonkers. You can set up a profile for each child and allocate books across them based on your plan.' },
  { q: 'Which areas do you deliver to?', a: 'We currently deliver across selected communities in Dubai. Hit "Check My Area" to see if we cover yours — and if we don\'t yet, you can join our waitlist and we\'ll let you know when we arrive.' },
  { q: 'Can I cancel anytime?', a: 'Yes, no questions asked. You can pause, change your plan, or cancel at any time from your account. If you cancel, books should be returned within 14 days.' },
]

export default function LandingPage() {
  const router = useRouter()
  const [books, setBooks] = useState<Book[]>([])
  const [readingLevels, setReadingLevels] = useState<ReadingLevel[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [activeLevels, setActiveLevels] = useState<ReadingLevel[]>([])
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Book[] | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const [phIdx, setPhIdx] = useState(0)
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [guestPopup, setGuestPopup] = useState<{ type: 'wishlist' | 'delivery'; message: string } | null>(null)
  const [showAllCategories, setShowAllCategories] = useState(false)
  const [showLibraryExpand, setShowLibraryExpand] = useState(false)
  const [isTablet, setIsTablet] = useState(false)
  useEffect(() => {
    const check = () => setIsTablet(window.innerWidth >= 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    supabase.from('reading_levels').select('id, name').order('display_order')
      .then(({ data }) => setReadingLevels(data || []))
    supabase.from('categories').select('id, name').order('display_order')
      .then(({ data }) => setCategories(data || []))
  }, [])

  useEffect(() => {
    async function loadBooks() {
      // Get book IDs matching selected categories (union: any matching category)
      let bookIdFilter: string[] | null = null
      if (selectedCategoryIds.length > 0) {
        const { data: bc } = await supabase.from('book_categories').select('book_id').in('category_id', selectedCategoryIds)
        if (!bc || bc.length === 0) { setBooks([]); return }
        bookIdFilter = [...new Set(bc.map(r => r.book_id))]
      }

      let query = supabase.from('books').select('id, title, author, cover_image_url').eq('is_active', true)
      if (bookIdFilter) query = query.in('id', bookIdFilter)
      if (activeLevels.length > 0) query = query.in('reading_level_id', activeLevels.map(l => l.id))

      query = query.order('total_ratings_count', { ascending: false })

      const { data } = await query
      setBooks(data || [])
    }
    loadBooks()
  }, [activeLevels, selectedCategoryIds, readingLevels])

  const PLACEHOLDERS = ['Looking for dinosaurs?', 'Looking for unicorns?', 'Looking for space adventures?', 'Looking for pirates?', 'Looking for football stories?', 'Looking for cats?', 'Looking for fairies?', 'Looking for mermaids?', 'Looking for bears?', 'Looking for dragons?', 'Looking for robots?', 'Looking for witches?']

  useEffect(() => {
    const t = setInterval(() => setPhIdx(i => (i + 1) % PLACEHOLDERS.length), 4000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults(null); return }
    const t = setTimeout(async () => {
      setSearchLoading(true)
      const { data } = await supabase.from('books').select('id, title, author, cover_image_url').eq('is_active', true)
        .or(`title.ilike.%${searchQuery}%,author.ilike.%${searchQuery}%`).limit(20)
      setSearchResults(data ?? [])
      setSearchLoading(false)
    }, 300)
    return () => clearTimeout(t)
  }, [searchQuery])

  const toggleLevel = (level: ReadingLevel) =>
    setActiveLevels(prev => prev.some(l => l.id === level.id) ? prev.filter(l => l.id !== level.id) : [...prev, level])

  const toggleCategory = (id: string) =>
    setSelectedCategoryIds(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id])

  const openGuestPopup = (type: 'wishlist' | 'delivery') => {
    const message = GUEST_MESSAGES[Math.floor(Math.random() * GUEST_MESSAGES.length)]
    setGuestPopup({ type, message })
  }

  const goCheck = () => router.push('/signup')

  return (
    <>
    <style>{`
      @media (min-width: 768px) {
        .lp-hero-section { zoom: 1.35; }
        .lp-hero-content { max-width: 560px !important; }
      }
    `}</style>
    <main style={{ backgroundColor: '#080402', backgroundImage: 'url(/Background_3.png)', backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed', minHeight: '100vh', overflowX: 'hidden', fontFamily: 'var(--font-montserrat), sans-serif', position: 'relative' }}>
      {/* ── STICKY HEADER ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', backgroundColor: 'transparent' }}>
        <div style={{ lineHeight: 1 }}>
          <p style={{ fontFamily: 'var(--font-amatic)', fontWeight: 700, fontSize: '3.2rem', color: '#eddbc3', letterSpacing: '0.04em', margin: 0 }}>BOOKY</p>
          <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600, fontSize: '0.58rem', color: '#eddbc3', letterSpacing: '0.18em', textTransform: 'uppercase', margin: '2px 0 0', lineHeight: 1.4 }}>THE CHILDREN'S<br />LIBRARY</p>
        </div>
        <button onClick={() => router.push('/login')} style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.85rem', color: '#eddbc3', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, letterSpacing: '0.04em' }}>
          <span style={{ borderBottom: '2px solid #f9ce71', paddingBottom: '1px' }}>Log in</span>
        </button>
      </div>

      {/* ── 1. HERO ── */}
      <section className="lp-hero-section" style={{ minHeight: '70svh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: isTablet ? 'flex-start' : 'center', position: 'relative', backgroundColor: 'transparent', padding: isTablet ? '0 44px 60px' : '0 24px 60px', marginTop: isTablet ? '-40px' : '0' }}>

        <div className="lp-hero-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', width: '100%', position: 'relative' }}>

          {isTablet ? (
            <>
              <img src="/bgnew.png" alt="Bonkers" style={{ width: '120%', maxWidth: '1000px', height: 'auto', marginTop: '60px', marginBottom: '-90px', alignSelf: 'flex-end', marginRight: '-110px' }} />
              <div style={{ position: 'absolute', left: '-80px', top: '120px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left', maxWidth: '65%' }}>
                <h1 style={{ fontFamily: 'var(--font-cormorant), serif', color: '#eddbc3', fontWeight: 700, lineHeight: 1.05, margin: '0 0 14px' }}>
                  <span style={{ fontSize: '2.2rem', display: 'block', whiteSpace: 'nowrap', marginTop: '-35px' }}>Brilliant books.</span>
                  <span style={{ fontSize: '1.25rem', display: 'block', marginTop: '28px' }}>Delivered &amp; collected<br />from your <span style={{ display: 'inline-block', position: 'relative' }}>doorstep<img src="/underline_yellow.png" alt="" style={{ position: 'absolute', bottom: '-18px', left: 0, width: '100%', height: 'auto', pointerEvents: 'none' }} /></span>.</span>
                </h1>
                <p style={{ color: '#eddbc3', fontSize: '0.65rem', lineHeight: 1.5, letterSpacing: '0.02em', marginBottom: '28px', marginTop: '36px' }}>
                  Curated by kids.<br />Approved by parents.<br />No commitment.<br />No late fees.
                </p>
                <div style={{ marginTop: '36px' }}><CheckAreaButton onClick={goCheck} /></div>
              </div>
            </>
          ) : (
            <>
              <h1 style={{ fontFamily: 'var(--font-cormorant), serif', color: '#eddbc3', fontWeight: 700, lineHeight: 1.05, margin: '140px 0 14px' }}>
                <span style={{ fontSize: 'clamp(3rem, 10vw, 4.2rem)', display: 'block' }}>Brilliant books.</span>
                <span style={{ fontSize: 'clamp(1.7rem, 6vw, 2.6rem)', display: 'block' }}>Delivered &amp; collected from your <span style={{ display: 'inline-block', position: 'relative' }}>doorstep<img src="/underline_yellow.png" alt="" style={{ position: 'absolute', bottom: '-18px', left: 0, width: '100%', height: 'auto', pointerEvents: 'none' }} /></span>.</span>
              </h1>
              <img src="/bgnew.png" alt="Bonkers" style={{ width: 'calc(100% + 80px)', maxWidth: 'none', height: 'auto', marginTop: '-20px', marginLeft: '-40px' }} />
              <p style={{ color: '#eddbc3', fontSize: '0.92rem', lineHeight: 1.5, letterSpacing: '0.02em', marginBottom: '28px', maxWidth: '320px', marginTop: '32px' }}>
                Curated by kids. Approved by parents.<br />No commitment. No late fees.
              </p>
              <div style={{ marginTop: '16px' }}><CheckAreaButton onClick={goCheck} /></div>
            </>
          )}

        </div>

        {/* Wavy cream transition */}
        <div style={{ position: 'absolute', bottom: isTablet ? '310px' : '300px', left: 0, right: 0, lineHeight: 0, pointerEvents: 'none' }}>
          <svg viewBox="0 0 1200 80" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '80px', display: 'block' }}>
            <path d="M0,40 C150,80 300,0 450,40 C600,80 750,0 900,40 C1050,80 1150,20 1200,40 L1200,80 L0,80 Z" fill="#fdf5e9" />
          </svg>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section style={{ backgroundColor: '#fdf5e9', padding: isTablet ? '60px 44px 60px' : '40px 24px 40px', marginTop: isTablet ? '-430px' : '-300px', paddingTop: isTablet ? 'calc(60px + 430px)' : 'calc(40px + 300px)' }}>
        <div style={{ maxWidth: isTablet ? '100%' : '480px', margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontFamily: 'var(--font-cormorant), serif', color: '#080402', fontSize: 'clamp(1.6rem, 5vw, 2.2rem)', fontWeight: 700, lineHeight: 1.1, marginBottom: '20px', marginTop: isTablet ? '-460px' : '0', textAlign: 'left' }}>
            How Booky Works
          </h2>

          {/* Steps */}
          {isTablet ? (
            <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'flex-end', gap: '8px', marginTop: '56px', width: '100%' }}>
              {[
                { num: '1', label: 'Choose books', img: '/bonky_choosingbooks.png', ml: '-16px', mr: '0' },
                { num: '2', label: 'Bonkers Day!', img: '/bonky_delivering2.png', ml: '-12px', mr: '0' },
                { num: '3', label: 'Keep Reading', img: '/bonky_reading.png', ml: '0', mr: '-28px' },
              ].map((step, i) => (
                <>
                  <div key={step.num} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', flex: 1 }}>
                    <div style={{ width: '52px', height: '52px', borderRadius: '50%', border: '1.5px solid #080402', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontFamily: 'var(--font-cormorant), serif', fontSize: '2rem', fontWeight: 700, color: '#080402', lineHeight: 1 }}>{step.num}</span>
                    </div>
                    <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.85rem', fontWeight: 600, color: '#080402', letterSpacing: '0.08em', textTransform: 'uppercase', margin: 0, textAlign: 'center', whiteSpace: 'nowrap' }}>{step.label}</p>
                    <img src={step.img} alt="" style={{ height: '200px', width: 'auto', marginLeft: step.ml, marginRight: step.mr }} />
                  </div>
                  {i < 2 && <img key={`a${i}`} src="/arrow_cream.png" alt="" style={{ width: '48px', height: 'auto', alignSelf: 'flex-start', marginTop: '12px', flexShrink: 0, filter: 'brightness(0)' }} />}
                </>
              ))}
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: '8px' }}>
                {[
                  { num: '1', label: 'Choose books' },
                  { num: '2', label: 'Bonkers Day!' },
                  { num: '3', label: 'Keep Reading' },
                ].map((step, i) => (
                  <>
                    <div key={step.num} style={{ width: '80px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '52px', height: '52px', borderRadius: '50%', border: '1.5px solid #080402', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontFamily: 'var(--font-cormorant), serif', fontSize: '2rem', fontWeight: 700, color: '#080402', lineHeight: 1 }}>{step.num}</span>
                      </div>
                      <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.65rem', fontWeight: 600, color: '#080402', letterSpacing: '0.08em', textTransform: 'uppercase', margin: 0, textAlign: 'center', width: '100%', whiteSpace: 'nowrap' }}>{step.label}</p>
                    </div>
                    {i < 2 && (
                      <img key={`a${i}`} src="/arrow_cream.png" alt="" style={{ width: '32px', height: 'auto', marginTop: '12px', flexShrink: 0, filter: 'brightness(0)' }} />
                    )}
                  </>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '16px', width: '100%' }}>
                <img src="/bonky_choosingbooks.png" alt="" style={{ height: '110px', width: 'auto', marginLeft: '-16px' }} />
                <img src="/bonky_delivering2.png" alt="" style={{ height: '110px', width: 'auto', marginLeft: '-12px' }} />
                <img src="/bonky_reading.png" alt="" style={{ height: '110px', width: 'auto', marginRight: '-28px' }} />
              </div>
            </>
          )}
          <div style={{ marginTop: isTablet ? '80px' : '52px', textAlign: 'left' }}>
            <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#080402', fontSize: isTablet ? '1.1rem' : '0.9rem', lineHeight: 1.6, marginBottom: '16px', fontWeight: 700 }}>
              Every community has a weekly Bonkers Day, when we deliver new books and collect the ones you're returning.
            </p>
            <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#080402', fontSize: isTablet ? '1.1rem' : '0.9rem', lineHeight: 1.6 }}>
              Still halfway through a dragon battle? Keep the book. A week, a month, until someone finally finds out what happens to the dragon — we don't mind.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: '6px', marginTop: isTablet ? '100px' : '32px' }}>
            {[
              { star: '/sparklestar_yellow.png', label: 'No due dates' },
              { star: '/sparklestar_turquoise.png', label: 'No late fees' },
              { star: '/sparklestar_pink.png', label: 'Cancel anytime' },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <img src={item.star} alt="" style={{ height: isTablet ? '48px' : '26px', width: 'auto' }} />
                <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 400, color: '#080402', fontSize: '1rem', letterSpacing: '0.04em' }}>{item.label}</span>
                {i < 2 && <span style={{ color: '#080402', opacity: 0.4, marginLeft: '2px' }}>·</span>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 3. THE BOOKS ── */}
      <section style={{ backgroundColor: 'transparent', padding: 0 }}>
        <div style={{ maxWidth: isTablet ? '100%' : '480px', margin: '0 auto', textAlign: 'center', padding: isTablet ? '0 44px' : '0 24px' }}>

          {/* Divider with star */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', maxWidth: isTablet ? '620px' : '440px', margin: isTablet ? '140px auto 50px' : '50px auto 50px' }}>
            <img src="/underline_divider.png" alt="" style={{ width: '100%', height: 'auto', transform: 'scaleY(2)', transformOrigin: 'center' }} />
            <img src="/star_button_on.png" alt="" style={{ position: 'absolute', width: isTablet ? '40px' : '20px', height: isTablet ? '40px' : '20px', transform: 'translateY(-4px)' }} />
          </div>

          {/* Take a peek */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px', marginTop: isTablet ? '100px' : '56px' }}>
            <img src="/whiskers_left.png" alt="" style={{ height: isTablet ? '48px' : '32px', width: 'auto', pointerEvents: 'none' }} />
            <p style={{ fontFamily: 'var(--font-amatic)', fontWeight: 700, color: '#eddbc3', fontSize: '1.8rem', letterSpacing: '0.04em', margin: 0, lineHeight: 1 }}>
              Take a peek
            </p>
            <img src="/whiskers_right.png" alt="" style={{ height: isTablet ? '48px' : '32px', width: 'auto', pointerEvents: 'none' }} />
          </div>
          <h2 style={{ fontFamily: 'var(--font-cormorant), serif', color: '#eddbc3', fontSize: 'clamp(2.8rem, 9vw, 4rem)', fontWeight: 700, lineHeight: 1.1, marginBottom: '12px', marginTop: isTablet ? '48px' : '0' }}>
            What's on our shelves?
          </h2>
          <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#eddbc3', fontSize: isTablet ? '1.1rem' : '1.05rem', lineHeight: 1.6, marginBottom: '24px', marginTop: isTablet ? '24px' : '0' }}>
            Every book in Bonkers is handpicked. Popular favourites, hidden gems and wonderfully weird discoveries, organised so kids can find something they genuinely want to read.
          </p>

          {/* Reading level selector — artwork cards */}
          <div style={{ marginBottom: '36px', marginTop: isTablet ? '80px' : '0' }}>
            <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#eddbc3', fontSize: isTablet ? '0.85rem' : '0.75rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: '12px', textAlign: 'left' }}>Browse by Age</p>
            <div style={{ display: 'flex', flexDirection: 'row', gap: '10px' }}>
              {readingLevels.map(level => {
                const key = level.name.toLowerCase()
                const isSelected = activeLevels.some(l => l.id === level.id)
                const artMap: Record<string, string> = { hatchling: '/age_hatchling.png', hatchlings: '/age_hatchling.png', '3-5': '/age_hatchling.png', chick: '/age_chick.png', chicks: '/age_chick.png', '5-7': '/age_chick.png', bird: '/age_bird.png', birds: '/age_bird.png', '8-10': '/age_bird.png' }
                const art = artMap[key]
                if (!art) return null
                const displayName = DISPLAY_NAME_MAP[key] ?? (key.charAt(0).toUpperCase() + key.slice(1))
                const age = AGE_MAP[key] ?? ''
                return (
                  <button key={level.id} onClick={() => toggleLevel(level)}
                    style={{ background: 'transparent', border: `1.5px solid ${isSelected ? '#f9ce71' : 'rgba(237,219,195,0.3)'}`, borderRadius: '12px', cursor: 'pointer', padding: 0, display: 'flex', flexDirection: 'row', alignItems: 'center', overflow: 'hidden', transition: 'border-color 0.15s', flex: 1, flexDirection: 'column', alignItems: 'center', padding: '10px 8px', gap: '6px' }}>
                    <div style={{ height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <img src={art} alt={level.name} style={{ width: isTablet ? (key.startsWith('hatchling') || key === '3-5' ? '70px' : key.startsWith('chick') || key === '5-7' ? '66px' : '88px') : (key.startsWith('hatchling') ? '44px' : key.startsWith('chick') ? '42px' : '58px'), height: isTablet ? (key.startsWith('hatchling') || key === '3-5' ? '70px' : key.startsWith('chick') || key === '5-7' ? '66px' : '88px') : (key.startsWith('hatchling') ? '44px' : key.startsWith('chick') ? '42px' : '58px'), objectFit: 'contain', display: 'block' }} />
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#eddbc3', fontSize: isTablet ? '1rem' : '0.78rem', fontWeight: 700, margin: 0, lineHeight: 1.2 }}>{displayName}</p>
                      <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#eddbc3', fontSize: isTablet ? '0.88rem' : '0.76rem', fontWeight: 400, margin: 0 }}>{age}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Category blob filter */}
          {categories.length > 0 && (
            <div style={{ marginBottom: '16px', marginTop: isTablet ? '48px' : '0' }}>
              <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#eddbc3', fontSize: isTablet ? '0.85rem' : '0.75rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: '10px', textAlign: 'left' }}>Browse by Category</p>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', flexWrap: 'wrap', overflowX: 'visible', padding: '4px 2px' }}>
                {(() => {
                  const visible = categories.filter(c => getCategoryBlob(c.name))
                  const shown = visible
                  const hasMore = false
                  return (
                    <>
                      {shown.map(cat => {
                    const blob = getCategoryBlob(cat.name)!
                    const isSelected = selectedCategoryIds.includes(cat.id)
                    return (
                      <button key={cat.id} onClick={() => toggleCategory(cat.id)}
                        style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                        <div style={{ borderRadius: '50%', padding: '3px', boxShadow: isSelected ? '0 0 0 2px #eddbc3' : 'none', transition: 'box-shadow 0.15s', display: 'inline-flex', position: 'relative' }}>
                          <img src={blob} alt={cat.name} style={{ width: isTablet ? '96px' : '54px', height: isTablet ? '96px' : '54px', objectFit: 'contain', display: 'block' }} />
                          {cat.name.toLowerCase().includes('adventure') && (
                            <img src="/symbol_rocket.png" alt="" style={{ position: 'absolute', inset: 0, width: '60%', height: '60%', objectFit: 'contain', pointerEvents: 'none', margin: 'auto' }} />
                          )}
                          {(cat.name.toLowerCase().includes('spooky') || cat.name.toLowerCase().includes('scary')) && (
                            <img src="/symbol_spooky1.png" alt="" style={{ position: 'absolute', inset: 0, width: '60%', height: '60%', objectFit: 'contain', pointerEvents: 'none', margin: 'auto', filter: 'brightness(0)', opacity: 1 }} />
                          )}
                          {(cat.name.toLowerCase().includes('hero') || cat.name.toLowerCase().includes('legend')) && (
                            <img src="/symbol_hero.png" alt="" style={{ position: 'absolute', inset: 0, width: '60%', height: '60%', objectFit: 'contain', pointerEvents: 'none', margin: 'auto', filter: 'brightness(0)', opacity: 1 }} />
                          )}
                          {(cat.name.toLowerCase().includes('mystery') || cat.name.toLowerCase().includes('mischief')) && (
                            <img src="/symbol_mystery.png" alt="" style={{ position: 'absolute', inset: 0, width: '52%', height: '52%', objectFit: 'contain', pointerEvents: 'none', margin: 'auto', filter: 'brightness(0)', opacity: 1 }} />
                          )}
                          {(cat.name.toLowerCase().includes('true') || cat.name.toLowerCase().includes('bonkers')) && (
                            <img src="/symbol_true.png" alt="" style={{ position: 'absolute', inset: 0, width: '48%', height: '48%', objectFit: 'contain', pointerEvents: 'none', margin: 'auto', filter: 'brightness(0)', opacity: 1 }} />
                          )}
                          {cat.name.toLowerCase().includes('laugh') && (
                            <img src="/symbol_laugh.png" alt="" style={{ position: 'absolute', inset: 0, width: '52%', height: '52%', objectFit: 'contain', pointerEvents: 'none', margin: 'auto', filter: 'brightness(0)', opacity: 1 }} />
                          )}
                          {cat.name.toLowerCase().includes('weird') && (
                            <img src="/symbol_weird.png" alt="" style={{ position: 'absolute', inset: 0, width: '53%', height: '53%', objectFit: 'contain', pointerEvents: 'none', margin: 'auto', filter: 'brightness(0)', opacity: 1 }} />
                          )}
                          {cat.name.toLowerCase().includes('heart') && (
                            <img src="/symbol_heart.png" alt="" style={{ position: 'absolute', inset: 0, width: '45%', height: '45%', objectFit: 'contain', pointerEvents: 'none', margin: 'auto', filter: 'brightness(0)', opacity: 1 }} />
                          )}
                          {(cat.name.toLowerCase().includes('magic') || cat.name.toLowerCase().includes('mayhem')) && (
                            <img src="/symbol_magichat.png" alt="" style={{ position: 'absolute', inset: 0, width: '75%', height: '75%', objectFit: 'contain', pointerEvents: 'none', margin: 'auto', filter: 'brightness(0)' }} />
                          )}
                        </div>
                        <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: isTablet ? '0.78rem' : '0.7rem', fontWeight: 600, color: '#eddbc3', letterSpacing: '0.04em', lineHeight: 1.2, textAlign: 'center' }}>
                          {cat.name.toLowerCase().startsWith('heartwarming') ? 'Heart' : cat.name.toLowerCase().startsWith('amazing') ? 'Adventure' : cat.name.toLowerCase().startsWith('magical') ? 'Magic' : cat.name.split(' ')[0]}
                        </span>
                      </button>
                      )
                    })}
                      {hasMore && (
                        <button onClick={() => setShowAllCategories(true)}
                          style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                          <div style={{ width: '44px', height: '44px', borderRadius: '50%', border: '1.5px solid rgba(237,219,195,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span style={{ color: '#eddbc3', fontSize: '1rem', letterSpacing: '2px', lineHeight: 1 }}>···</span>
                          </div>
                          <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.6rem', fontWeight: 600, color: '#eddbc3', opacity: 0.6, letterSpacing: '0.04em' }}>more</span>
                        </button>
                      )}
                    </>
                  )
                })()}
              </div>
            </div>
          )}

        </div>

        {/* Bookshelf with scrollable covers behind transparent windows */}
        <div style={{ position: 'relative', width: '100%', marginTop: '52px' }}>
          {/* Scrollable book strip — sits behind the PNG overlay */}
          <div style={{ position: 'absolute', top: '3%', left: 0, right: 0, height: '67%', display: 'flex', gap: '2%', overflowX: 'auto', scrollbarWidth: 'none', paddingLeft: '8%', paddingRight: '8%', zIndex: 3, boxSizing: 'border-box', alignItems: 'flex-end' }}>
            {books.map(book => (
              <div key={book.id} style={{ flexShrink: 0, width: 'auto', height: '100%' }}>
                {book.cover_image_url && (
                  <img src={book.cover_image_url} alt={book.title} style={{ width: 'auto', height: '100%', display: 'block' }} />
                )}
              </div>
            ))}
          </div>
          {/* Bookshelf PNG — transparent cream areas let covers show through */}
          <img src="/bookshelf.png" alt="" style={{ width: '100%', height: 'auto', display: 'block', position: 'relative', zIndex: 2, pointerEvents: 'none' }} />
        </div>

        <div style={{ textAlign: 'center', padding: '10px 24px 8px' }}>
          <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src="/whiskers_left.png" alt="" style={{ position: 'absolute', left: '-36px', height: '48px', width: 'auto', zIndex: 1, pointerEvents: 'none', filter: 'none' }} />
            <button onClick={() => setShowLibraryExpand(v => !v)}
              style={{ background: 'transparent', border: '1.5px solid #eddbc3', borderRadius: '999px', cursor: 'pointer', padding: '14px 32px' }}>
              <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600, fontSize: '0.7rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#eddbc3' }}>
                Explore the Whole Library
              </span>
            </button>
            <img src="/whiskers_right.png" alt="" style={{ position: 'absolute', right: '-36px', height: '48px', width: 'auto', zIndex: 1, pointerEvents: 'none', filter: 'none' }} />
          </div>

          {/* Inline expand */}
          <div style={{ overflow: 'hidden', maxHeight: showLibraryExpand ? '200px' : '0', transition: 'max-height 0.4s ease', marginTop: showLibraryExpand ? '20px' : '0' }}>
            <p style={{ fontFamily: 'var(--font-cormorant), serif', color: '#eddbc3', fontSize: '1.6rem', fontWeight: 700, lineHeight: 1.2, margin: '0 0 6px' }}>Like what you see?</p>
            <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: 'rgba(237,219,195,0.7)', fontSize: '0.82rem', lineHeight: 1.6, margin: '0 0 20px' }}>There are plenty more where those came from.</p>
            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
              <img src="/whiskers_left.png" alt="" style={{ position: 'absolute', left: '-32px', height: '44px', width: 'auto', pointerEvents: 'none', zIndex: 1, filter: 'brightness(0) saturate(100%) invert(87%) sepia(33%) saturate(762%) hue-rotate(339deg) brightness(103%) contrast(98%)' }} />
              <button onClick={goCheck}
                style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#fff', backgroundImage: 'url(/button2.png)', backgroundSize: '300% 300%', backgroundPosition: 'center', backgroundRepeat: 'no-repeat', backgroundColor: 'transparent', border: 'none', borderRadius: '999px', padding: '12px 28px', cursor: 'pointer' }}>
                Join Bonkers
              </button>
              <img src="/whiskers_right.png" alt="" style={{ position: 'absolute', right: '-32px', height: '44px', width: 'auto', pointerEvents: 'none', zIndex: 1, filter: 'brightness(0) saturate(100%) invert(87%) sepia(33%) saturate(762%) hue-rotate(339deg) brightness(103%) contrast(98%)' }} />
            </div>
          </div>
        </div>
      </section>

      {/* Guest popup */}
      {guestPopup && (
        <div onClick={() => setGuestPopup(null)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '0 0 40px' }}>
          <div onClick={e => e.stopPropagation()} style={{ backgroundColor: '#efe7dd', borderRadius: '24px', padding: '32px 24px 28px', maxWidth: '360px', width: '90%', textAlign: 'center' }}>
            <img src="/star_button_on.png" alt="" style={{ width: '28px', height: '28px', marginBottom: '12px' }} />
            <p style={{ fontFamily: 'var(--font-cormorant), serif', color: '#1a0a00', fontSize: '1.8rem', fontWeight: 700, lineHeight: 1.1, marginBottom: '12px' }}>
              {guestPopup.message}
            </p>
            <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#4a3728', fontSize: '0.88rem', lineHeight: 1.5, marginBottom: '24px' }}>
              {guestPopup.type === 'wishlist'
                ? 'Join Bonkers to save this book to your wishlist.'
                : 'Join Bonkers to add this book to your next delivery.'}
            </p>
            <button onClick={goCheck}
              style={{ backgroundImage: 'url(/button2.png)', backgroundSize: '300% 300%', backgroundPosition: 'center', border: 'none', borderRadius: '999px', color: '#fff', fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600, fontSize: '0.85rem', letterSpacing: '0.15em', textTransform: 'uppercase', padding: '14px 36px', cursor: 'pointer', width: '100%' }}>
              Join Here
            </button>
            <button onClick={() => setGuestPopup(null)} style={{ marginTop: '12px', background: 'none', border: 'none', color: '#4a3728', opacity: 0.5, fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'var(--font-montserrat), sans-serif' }}>
              Keep browsing
            </button>
          </div>
        </div>
      )}

      {/* ── 4. WHY BONKERS ── */}
      <section style={{ backgroundColor: 'transparent', padding: isTablet ? '0 44px 0' : '0 24px 0' }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', maxWidth: isTablet ? '620px' : '440px', margin: isTablet ? '140px auto 50px' : '50px auto 50px' }}>
          <img src="/underline_divider.png" alt="" style={{ width: '100%', height: 'auto', transform: 'scaleY(2)', transformOrigin: 'center' }} />
          <img src="/star_button_on.png" alt="" style={{ position: 'absolute', width: isTablet ? '40px' : '20px', height: isTablet ? '40px' : '20px', transform: 'translateY(-4px)' }} />
        </div>
        <div style={{ maxWidth: isTablet ? '100%' : '480px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px', marginTop: isTablet ? '100px' : '40px' }}>
            <img src="/whiskers_left.png" alt="" style={{ height: isTablet ? '48px' : '32px', width: 'auto', pointerEvents: 'none' }} />
            <p style={{ fontFamily: 'var(--font-amatic), sans-serif', color: '#eddbc3', fontSize: '1.8rem', fontWeight: 700, letterSpacing: '0.04em', margin: 0 }}>
              Why Bonkers?
            </p>
            <img src="/whiskers_right.png" alt="" style={{ height: isTablet ? '48px' : '32px', width: 'auto', pointerEvents: 'none' }} />
          </div>
          <h2 style={{ fontFamily: 'var(--font-cormorant), serif', color: '#eddbc3', fontSize: 'clamp(2.16rem, 7.2vw, 3.12rem)', fontWeight: 700, lineHeight: 1.1, marginBottom: '36px', marginTop: isTablet ? '48px' : '16px', textAlign: 'center' }}>
            The 'Great Book' Hunt
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', marginTop: isTablet ? '48px' : '0' }}>
            {[
              { title: 'Nine billion books. Good luck.', desc: 'There are approximately nine billion children\'s books to choose from.* You have twenty minutes in the bookshop, and one increasingly bored child. Let Bonkers do the digging for you. Every Bonkers book is handpicked, read and judged by actual kids, with the boring ones shown the door.\n\n* Possibly an exaggeration.' },
              { title: 'The AED 50+ Gamble', desc: 'They begged for it. They read six pages. They never touched it again. Joining Bonkers means kids can experiment with new books and genres without every experiment costing AED 50+.' },
              { title: 'Your bookshelf called. It\'s full.', desc: 'Books are wonderful. Four hundred books your children have outgrown are... storage. Joining Bonkers means they can keep the books they can\'t part with as long as they like, and exchange the rest for fresh new stories.' },
              { title: '"Muuuum, can I get this?"', desc: 'No dragging everyone around a bookshop and mysteriously leaving with 7 squishies and a slime kit. Independent readers can choose their own Bonkers books and even arrange their own delivery and collection.' },
            ].map((reason, i) => (
              <div key={i} style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                <img src="/star_button_on.png" alt="" style={{ width: isTablet ? '26px' : '18px', height: isTablet ? '26px' : '18px', flexShrink: 0, marginTop: isTablet ? '22px' : '10px' }} />
                <div>
                  <p style={{ fontFamily: 'var(--font-cormorant), serif', color: '#eddbc3', fontSize: '1.61rem', fontWeight: 700, marginBottom: '4px' }}>{reason.title}</p>
                  <p style={{ color: '#eddbc3', fontSize: '1rem', lineHeight: 1.5, opacity: 0.9, whiteSpace: 'pre-line' }}>{reason.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', maxWidth: isTablet ? '620px' : '440px', margin: isTablet ? '140px auto 50px' : '50px auto 50px' }}>
            <img src="/underline_divider.png" alt="" style={{ width: '100%', height: 'auto', transform: 'scaleY(2)', transformOrigin: 'center' }} />
            <img src="/star_button_on.png" alt="" style={{ position: 'absolute', width: isTablet ? '40px' : '20px', height: isTablet ? '40px' : '20px', transform: 'translateY(-4px)' }} />
          </div>
        </div>
      </section>

      {/* ── 5. PRICING ── */}
      <section style={{ backgroundColor: 'transparent', padding: isTablet ? '0 44px 0' : '0 24px 0', borderTop: '1px solid rgba(237,219,195,0.1)' }}>
        <div style={{ maxWidth: isTablet ? '100%' : '480px', margin: '0 auto', textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '4px', marginTop: isTablet ? '80px' : '0' }}>
            <img src="/whiskers_left.png" alt="" style={{ height: isTablet ? '48px' : '32px', width: 'auto', pointerEvents: 'none' }} />
            <p style={{ fontFamily: 'var(--font-amatic)', fontWeight: 700, color: '#eddbc3', fontSize: '1.8rem', letterSpacing: '0.04em', margin: 0 }}>
              How bonkers are you?
            </p>
            <img src="/whiskers_right.png" alt="" style={{ height: isTablet ? '48px' : '32px', width: 'auto', pointerEvents: 'none' }} />
          </div>
          <h2 style={{ fontFamily: 'var(--font-cormorant), serif', color: '#eddbc3', fontSize: 'clamp(3.2rem, 10vw, 4.8rem)', fontWeight: 700, lineHeight: 1.1, marginBottom: '8px', marginTop: isTablet ? '48px' : '0' }}>
            Our Bonkers Plans
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginTop: isTablet ? '80px' : '44px' }}>
            {[
              { label: 'A Little Bonkers', price: 149, books: 8, swaps: 2, badge: null },
              { label: 'Quite Bonkers', price: 199, books: 16, swaps: 4, badge: 'Most popular' },
              { label: 'Absolutely Bonkers', price: 249, books: 24, swaps: 6, badge: null },
            ].map((plan, i) => (
              <div key={plan.label} style={{ position: 'relative', fontFamily: 'var(--font-cormorant), serif', backgroundColor: 'transparent', border: i === 1 ? '2px solid #fecf57' : '1.5px solid rgba(237,219,195,0.3)', borderRadius: '16px', padding: i === 2 ? '20px 20px 30px' : '20px 20px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                {i === 0 && (
                  <>
                    <img src="/sparklestar_yellow.png" alt="" style={{ position: 'absolute', bottom: '68px', right: '90px', height: '18px', width: '18px' }} />
                    <img src="/sparklestar_orange.png" alt="" style={{ position: 'absolute', bottom: '58px', right: '68px', height: '18px', width: '18px', zIndex: 2 }} />
                    <img src="/books_2a.png" alt="" style={{ position: 'absolute', bottom: '8px', right: '10px', height: '52px', width: 'auto', objectFit: 'contain' }} />
                  </>
                )}
                {i === 1 && (
                  <>
                    <img src="/whiskers_left.png" alt="" style={{ position: 'absolute', bottom: '48px', right: '105px', height: '36px', width: 'auto', pointerEvents: 'none', filter: 'brightness(0) saturate(100%) invert(87%) sepia(33%) saturate(762%) hue-rotate(339deg) brightness(103%) contrast(98%)' }} />
                    <img src="/whiskers_right.png" alt="" style={{ position: 'absolute', bottom: '20px', right: '2px', height: '26px', width: 'auto', pointerEvents: 'none', filter: 'brightness(0) saturate(100%) invert(87%) sepia(33%) saturate(762%) hue-rotate(339deg) brightness(103%) contrast(98%)' }} />
                    <img src="/books_4a.png" alt="" style={{ position: 'absolute', bottom: '-2px', right: '10px', height: '80px', width: 'auto', objectFit: 'contain' }} />
                  </>
                )}
                {i === 2 && (
                  <>
                    <img src="/whiskers_left.png" alt="" style={{ position: 'absolute', bottom: '38px', right: '110px', height: '32px', width: 'auto', pointerEvents: 'none', filter: 'brightness(0) saturate(100%) invert(87%) sepia(33%) saturate(762%) hue-rotate(339deg) brightness(103%) contrast(98%)' }} />
                    <img src="/whiskers_right.png" alt="" style={{ position: 'absolute', bottom: '38px', right: '-4px', height: '32px', width: 'auto', pointerEvents: 'none', filter: 'brightness(0) saturate(100%) invert(87%) sepia(33%) saturate(762%) hue-rotate(339deg) brightness(103%) contrast(98%)' }} />
                    <img src="/books_6a.png" alt="" style={{ position: 'absolute', bottom: '8px', right: '10px', height: '110px', width: 'auto', objectFit: 'contain' }} />
                  </>
                )}
                {plan.badge && (
                  <span style={{ position: 'absolute', top: '-14px', left: '16px', backgroundColor: '#fecf57', color: '#374151', fontSize: '1rem', fontWeight: 900, padding: '3px 12px', borderRadius: '999px', whiteSpace: 'nowrap', fontFamily: 'var(--font-cormorant), serif', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <img src="/star_button_on.png" alt="" style={{ height: '16px', width: '16px' }} />
                    {plan.badge}
                  </span>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left', width: '100%', gap: '8px' }}>
                  {/* Title row with price aligned right */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', width: '100%' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <span style={{ fontWeight: 700, color: '#eddbc3', fontSize: isTablet ? '1.6rem' : '2rem', lineHeight: 1 }}>{plan.label}</span>
                      <span style={{ fontSize: isTablet ? '0.95rem' : '1.1rem', fontWeight: 400, color: '#eddbc3', fontFamily: 'var(--font-montserrat), sans-serif' }}>{plan.swaps} books at a time</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0 }}>
                      <span style={{ fontSize: isTablet ? '1.8rem' : '2.2rem', fontWeight: 900, color: '#eddbc3', lineHeight: 1, display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                        {plan.price}<span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#eddbc3', fontFamily: 'var(--font-cormorant), serif' }}>AED</span>
                      </span>
                      <span style={{ fontSize: '0.75rem', color: '#eddbc3', fontFamily: 'var(--font-montserrat), sans-serif' }}>/month</span>
                    </div>
                  </div>
                  {/* Big book count */}
                  <div style={{ display: 'flex', alignItems: 'baseline', width: '100%', gap: '6px' }}>
                    <span style={{ fontSize: isTablet ? '0.85rem' : '0.95rem', color: 'rgba(237,219,195,0.7)', fontFamily: 'var(--font-montserrat), sans-serif' }}>Up to</span>
                    <span style={{ fontSize: isTablet ? '1.6rem' : '1.9rem', fontWeight: 900, color: '#eddbc3', lineHeight: 1 }}>{plan.books}</span>
                    <span style={{ fontSize: isTablet ? '0.85rem' : '0.95rem', color: 'rgba(237,219,195,0.7)', fontFamily: 'var(--font-montserrat), sans-serif' }}>books / month*</span>
                  </div>
                </div>
              </div>
            ))}
          </div>



          <p style={{ color: '#eddbc3', fontSize: '0.82rem', fontFamily: 'var(--font-montserrat), sans-serif', marginTop: '10px', opacity: 0.9 }}>
            *Based on choosing new books each week
          </p>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: isTablet ? '64px' : '28px', marginBottom: '8px' }}>
            <img src="/whiskers_left.png" alt="" style={{ height: isTablet ? '48px' : '28px', width: 'auto', pointerEvents: 'none' }} />
            <p style={{ fontFamily: 'var(--font-amatic)', fontWeight: 700, color: '#eddbc3', fontSize: '1.6rem', letterSpacing: '0.04em', margin: 0, lineHeight: 1 }}>All plans include:</p>
            <img src="/whiskers_right.png" alt="" style={{ height: isTablet ? '48px' : '28px', width: 'auto', pointerEvents: 'none' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', textAlign: 'left', marginTop: isTablet ? '24px' : '0' }}>
            {[
              { star: '/sparklestar_yellow.png', size: 24, label: 'Weekly Bonkers Day delivery & collection' },
              { star: '/sparklestar_orange.png', size: 22, label: 'No due dates or late fees' },
              { star: '/sparklestar_turquoise.png', size: 22, label: 'Keep books as long as you like' },
              { star: '/sparklestar_pink.png', size: 22, label: 'Upgrade/downgrade or cancel anytime' },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                <img src={item.star} alt="" style={{ height: isTablet ? `${item.size + 10}px` : `${item.size}px`, width: isTablet ? `${item.size + 10}px` : `${item.size}px`, objectFit: 'contain', flexShrink: 0 }} />
                <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 400, color: '#eddbc3', fontSize: isTablet ? '1.05rem' : '0.88rem', letterSpacing: '0.02em' }}>{item.label}</span>
              </div>
            ))}
          </div>

          <div style={{ marginTop: isTablet ? '100px' : '56px' }}>
            <CheckAreaButton onClick={goCheck} />
          </div>

          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', maxWidth: isTablet ? '620px' : '440px', margin: isTablet ? '140px auto 50px' : '80px auto 50px' }}>
            <img src="/underline_divider.png" alt="" style={{ width: '100%', height: 'auto', transform: 'scaleY(2)', transformOrigin: 'center' }} />
            <img src="/star_button_on.png" alt="" style={{ position: 'absolute', width: isTablet ? '40px' : '20px', height: isTablet ? '40px' : '20px', transform: 'translateY(-4px)' }} />
          </div>
        </div>
      </section>

      {/* ── 6. FAQ ── */}
      <section style={{ backgroundColor: 'transparent', padding: isTablet ? '0 44px 60px' : '0 24px 60px', borderTop: '1px solid rgba(237,219,195,0.1)' }}>
        <div style={{ maxWidth: isTablet ? '680px' : '480px', margin: '0 auto' }}>
          <h2 style={{ fontFamily: 'var(--font-cormorant), serif', color: '#eddbc3', fontSize: 'clamp(1.8rem, 6vw, 2.4rem)', fontWeight: 700, marginBottom: '28px', textAlign: 'center' }}>
            Questions
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {FAQS.map((faq, i) => (
              <div key={i} style={{ borderBottom: '1px solid rgba(237,219,195,0.35)', overflow: 'hidden' }}>
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: '16px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontFamily: 'var(--font-cormorant), serif', color: '#eddbc3', fontSize: isTablet ? '1.35rem' : '1.15rem', fontWeight: 600, lineHeight: 1.3 }}>{faq.q}</span>
                  <span style={{ color: '#eddbc3', fontSize: '1.2rem', flexShrink: 0, transition: 'transform 0.2s', transform: openFaq === i ? 'rotate(45deg)' : 'none' }}>+</span>
                </button>
                {openFaq === i && (
                  <p style={{ color: '#eddbc3', fontSize: isTablet ? '1.05rem' : '0.9rem', lineHeight: 1.6, paddingBottom: '16px' }}>
                    {faq.a}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 7. FINAL CTA ── */}
      <section style={{ backgroundColor: 'transparent', padding: '60px 24px 48px', borderTop: '1px solid rgba(237,219,195,0.1)', textAlign: 'center' }}>
        <div style={{ maxWidth: '400px', margin: '0 auto' }}>
          <img src="/logo11.png" alt="" style={{ width: '140px', height: 'auto', display: 'block', margin: '0 auto 8px' }} />
          <h2 style={{ fontFamily: 'var(--font-cormorant), serif', color: '#eddbc3', fontSize: 'clamp(2rem, 7vw, 2.8rem)', fontWeight: 700, lineHeight: 1.05, marginBottom: '28px' }}>
            Ready to go Bonkers?
          </h2>

          <CheckAreaButton onClick={goCheck} />

          <button onClick={() => router.push('/login')}
            style={{ display: 'block', margin: '16px auto 0', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-montserrat), sans-serif', color: '#eddbc3', opacity: 0.5, fontSize: '0.85rem', letterSpacing: '0.04em' }}>
            Already a member? Log in
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ backgroundColor: '#040201', padding: '24px', textAlign: 'center', borderTop: '1px solid rgba(237,219,195,0.08)' }}>
        <p style={{ color: '#eddbc3', opacity: 0.35, fontSize: '0.75rem', letterSpacing: '0.06em' }}>
          © {new Date().getFullYear()} Bonkers The Children's Library · Dubai · hello@bonkers.ae
        </p>
      </footer>

      <style>{`
        section::-webkit-scrollbar { display: none; }
        div::-webkit-scrollbar { display: none; }
      `}</style>
    </main>
    </>
  )
}

function CheckAreaButton({ onClick }: { onClick: () => void }) {
  const whiskerFilter = 'brightness(0) saturate(100%) invert(87%) sepia(33%) saturate(762%) hue-rotate(339deg) brightness(103%) contrast(98%)'
  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      <button onClick={onClick}
        style={{ backgroundColor: '#f9ce71', border: 'none', borderRadius: '999px', cursor: 'pointer', padding: '14px 32px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600, fontSize: '0.75rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#080402' }}>
          Join Booky
        </span>
      </button>
    </div>
  )
}
