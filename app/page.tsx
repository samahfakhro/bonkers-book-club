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
  { q: 'Which areas do you deliver to?', a: 'We deliver across Dubai. If you\'re not sure whether we reach your doorstep, just sign up and we\'ll confirm your delivery details when you join.' },
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
    <main style={{ backgroundColor: '#1a2744', backgroundImage: 'url(/Background_3.png)', backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed', minHeight: '100vh', overflowX: 'hidden', fontFamily: 'var(--font-montserrat), sans-serif', position: 'relative' }}>
      {/* ── HEADER ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: isTablet ? '0 20px' : '16px 20px', position: 'relative', zIndex: 30 }}>
        <div style={{ lineHeight: 1 }}>
          <p style={{ fontFamily: 'var(--font-amatic)', fontWeight: 700, fontSize: '3rem', color: '#eddbc3', letterSpacing: '0.04em', margin: 0 }}>BONKERS</p>
          <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600, fontSize: '0.58rem', color: '#eddbc3', letterSpacing: '0.18em', textTransform: 'uppercase', margin: '2px 0 0', lineHeight: 1.4 }}>THE CHILDREN'S LIBRARY</p>
        </div>
        <button onClick={() => router.push('/login')} style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.85rem', color: '#eddbc3', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, letterSpacing: '0.04em' }}>
          <span style={{ borderBottom: '2px solid #f9ce71', paddingBottom: '1px' }}>Log in</span>
        </button>
      </div>

      {/* ── 1. HERO ── */}
      <section className="lp-hero-section" style={{ position: 'relative', marginTop: isTablet ? '-70px' : '-60px', zIndex: 20 }}>

        {/* Full-width hero image — text flows naturally below it */}
        <img src="/bonkers_mainimagea.png" alt="" style={{ width: '100%', display: 'block', height: 'auto' }} />

        <div className="lp-hero-content" style={{ textAlign: 'center', width: '100%', position: 'relative', padding: isTablet ? '0 44px 60px' : '0 24px 40px' }}>

          {isTablet ? (
            <>
              <h1 style={{ fontFamily: 'var(--font-cormorant), serif', color: '#eddbc3', fontWeight: 700, lineHeight: 1.05, margin: '0 0 14px', textAlign: 'center', width: '100%' }}>
                <span style={{ fontSize: '3.7rem', display: 'block' }}>Brilliant books.</span>
                <span style={{ fontSize: '1.9rem', display: 'block', marginTop: '8px' }}>Delivered &amp; collected from your <span style={{ display: 'inline-block', position: 'relative' }}>doorstep<img src="/underline_yellow.png" alt="" style={{ position: 'absolute', bottom: '-18px', left: 0, width: '100%', height: 'auto', pointerEvents: 'none' }} /></span>.</span>
              </h1>
              <div style={{ position: 'relative', width: '100%' }}>
                <p style={{ color: '#eddbc3', fontSize: '1.1rem', lineHeight: 1.5, letterSpacing: '0.02em', marginBottom: '28px', marginTop: '8px', position: 'relative', zIndex: 1, textAlign: 'center', width: '100%' }}>
                  Curated by kids. Approved by parents.<br />No commitment. No late fees.
                </p>
                <img src="/penguin_sneak.png" alt="" style={{ position: 'absolute', right: '-20px', bottom: '-180px', height: '240px', width: 'auto', zIndex: -1 }} />
              </div>
              <div style={{ marginTop: '56px', transform: 'scale(1.4)', transformOrigin: 'center' }}><CheckAreaButton onClick={goCheck} /></div>
            </>
          ) : (
            <>
              <h1 style={{ fontFamily: 'var(--font-cormorant), serif', color: '#eddbc3', fontWeight: 700, lineHeight: 1.05, margin: '0 0 14px', textAlign: 'center', width: '100%' }}>
                <span style={{ fontSize: 'clamp(3rem, 10vw, 4.2rem)', display: 'block' }}>Brilliant books.</span>
                <span style={{ fontSize: 'clamp(1.7rem, 6vw, 2.6rem)', display: 'block' }}>Delivered &amp; collected from your <span style={{ display: 'inline-block', position: 'relative' }}>doorstep<img src="/underline_yellow.png" alt="" style={{ position: 'absolute', bottom: '-18px', left: 0, width: '100%', height: 'auto', pointerEvents: 'none' }} /></span>.</span>
              </h1>
              <div style={{ position: 'relative' }}>
                <p style={{ color: '#eddbc3', fontSize: '0.92rem', lineHeight: 1.5, letterSpacing: '0.02em', marginBottom: '28px', marginTop: '0', marginLeft: 'auto', marginRight: 'auto', maxWidth: '320px', position: 'relative', zIndex: 2, textAlign: 'center' }}>
                  Curated by kids. Approved by parents.<br />No commitment. No late fees.
                </p>
                <div style={{ marginTop: '16px', position: 'relative', zIndex: 20 }}><CheckAreaButton onClick={goCheck} /></div>
                <img src="/penguin_sneak.png" alt="" style={{ position: 'absolute', right: '-20px', bottom: '-8px', height: '110px', width: 'auto', zIndex: 1, pointerEvents: 'none' }} />
              </div>
            </>
          )}

        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="lp-hiw-section" style={{ position: 'relative', zIndex: isTablet ? 5 : 15 }}>
        {/* Top decorative image — sits over hero with no cream behind it */}
        <img src="/mainimage2a.png" alt="" style={{ width: '100%', display: 'block', height: 'auto' }} />

        {/* Cream starts here, after mainimage2a */}
        <div style={{ backgroundColor: '#faf2e4' }}>

        {/* How It Works label + heading — in normal flow on cream background */}
        <div className="lp-hiw-content" style={{ backgroundColor: '#faf2e4', textAlign: 'center', padding: isTablet ? '0px 44px 24px' : '0px 24px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: isTablet ? '16px' : '10px', marginBottom: '12px' }}>
            <div style={{ width: isTablet ? '50px' : '32px', height: '2px', backgroundColor: '#8ba8b2', borderRadius: '1px' }} />
            <span style={{ fontFamily: 'var(--font-cormorant), serif', color: '#8ba8b2', fontSize: isTablet ? '1.2rem' : '0.95rem', fontWeight: 600, whiteSpace: 'nowrap' }}>How It Works</span>
            <div style={{ width: isTablet ? '50px' : '32px', height: '2px', backgroundColor: '#8ba8b2', borderRadius: '1px' }} />
          </div>
          <h2 style={{ fontFamily: 'var(--font-cormorant), serif', color: '#1a2744', fontSize: isTablet ? 'clamp(2.4rem, 6vw, 3.4rem)' : '1.6rem', fontWeight: 800, lineHeight: 1.1, margin: 0, textAlign: 'center', whiteSpace: isTablet ? 'normal' : 'nowrap' }}>
            Borrow. Read. Return. Repeat.
          </h2>
        </div>

        {/* Middle decorative image */}
        <img src="/mainimage2b.png" alt="" style={{ width: '100%', display: 'block', height: 'auto' }} />

        {/* Steps, stars, pricing — in normal flow on cream background */}
        <div style={{ backgroundColor: '#faf2e4', textAlign: 'center', padding: isTablet ? '32px 44px 0' : '20px 16px 0' }}>
          <div className="lp-hiw-steps" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: isTablet ? '24px' : '8px', textAlign: 'center' }}>
            {[
              { heading: 'Choose books', sub: 'from our curated library', subMobile: 'from our curated' },
              { heading: 'We deliver', sub: "weekly on your Bonkers Day" },
              { heading: 'Read', sub: 'and keep books as long as you like', subMobile: 'and keep as long as you like' },
              { heading: 'Return', sub: "any books you've finished on your Bonkers Day", subMobile: 'books on your Bonkers Day' },
            ].map(({ heading, sub, subMobile }, i) => (
              <div key={i}>
                <p style={{ fontFamily: 'var(--font-cormorant), serif', color: '#1a2744', fontSize: isTablet ? '1.4rem' : '1.25rem', fontWeight: 600, lineHeight: isTablet ? 1.3 : 1.1, margin: '0 0 4px', whiteSpace: isTablet ? 'nowrap' : 'normal' }}>{heading}</p>
                {sub && <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#1a2744', fontSize: '0.78rem', lineHeight: 1.4, margin: 0, marginTop: isTablet ? '0' : '-4px', opacity: 0.8 }}>{!isTablet && subMobile ? subMobile : sub}</p>}
              </div>
            ))}
          </div>
          <div className="lp-hiw-stars" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: '6px', marginTop: isTablet ? '32px' : '24px' }}>
            {[
              { star: '/sparklestar_yellow.png', label: 'Weekly delivery' },
              { star: '/sparklestar_turquoise.png', label: 'No late fees' },
              { star: '/sparklestar_pink.png', label: 'Cancel anytime' },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <img src={item.star} alt="" style={{ height: isTablet ? '48px' : '26px', width: 'auto' }} />
                <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 400, color: '#1a2744', fontSize: '1rem', letterSpacing: '0.04em' }}>{item.label}</span>
                {i < 2 && <img src="/divider_vertical.png" alt="" style={{ height: '32px', width: 'auto', margin: '0 6px', filter: 'brightness(0) saturate(100%)' }} />}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '16px', marginTop: '24px', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center', flex: 1, border: '1.5px solid rgba(26,39,68,0.2)', borderRadius: '12px', padding: '16px 12px' }}>
              <span style={{ fontFamily: 'var(--font-cormorant), serif', color: '#1a2744', fontSize: isTablet ? '2rem' : '1.5rem', fontWeight: 700 }}>AED 149</span>
              <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#1a2744', fontSize: '1rem', fontWeight: 400, marginLeft: '6px' }}>/ month</span>
              <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#1a2744', fontSize: '0.85rem', fontWeight: 400, margin: '4px 0 0', opacity: 0.8 }}>4 books at home at a time</p>
            </div>
            <div style={{ textAlign: 'center', flex: 1, border: '1.5px solid rgba(26,39,68,0.2)', borderRadius: '12px', padding: '16px 12px' }}>
              <span style={{ fontFamily: 'var(--font-cormorant), serif', color: '#1a2744', fontSize: isTablet ? '2rem' : '1.5rem', fontWeight: 700 }}>AED 199</span>
              <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#1a2744', fontSize: '1rem', fontWeight: 400, marginLeft: '6px' }}>/ month</span>
              <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#1a2744', fontSize: '0.85rem', fontWeight: 400, margin: '4px 0 0', opacity: 0.8 }}>6 books at home at a time</p>
            </div>
          </div>
          <div style={{ marginTop: '36px', marginBottom: '0', transform: 'scale(1.15)', transformOrigin: 'center' }}><CheckAreaButton onClick={goCheck} /></div>
        </div>

        {/* Bottom decorative image */}
        <img src="/mainimage2c.png" alt="" style={{ width: '100%', display: 'block', height: 'auto' }} />
        </div>{/* end cream wrapper */}
      </section>

      {/* ── 3. THE BOOKS ── */}
      <section className="lp-books-section" style={{ backgroundColor: 'transparent', padding: 0, marginTop: isTablet ? '-30px' : '0' }}>
        <div style={{ maxWidth: isTablet ? '100%' : '480px', margin: '0 auto', textAlign: 'center', padding: isTablet ? '0 44px' : '0 24px' }}>

          {/* Divider with star */}
          {/* Take a peek */}
          <div className="lp-take-peek" style={{ position: 'relative', display: 'inline-block' }}>
            <img src="/sparklestar_yellow.png" alt="" style={{ position: 'absolute', top: '-88px', left: '-160px', width: '54px', height: '54px', pointerEvents: 'none' }} />
            <img src="/sparklestar_yellow.png" alt="" style={{ position: 'absolute', top: '-90px', right: '-200px', width: '40px', height: '40px', pointerEvents: 'none' }} />
            <img src="/sparklestar_pink.png" alt="" style={{ position: 'absolute', top: '-24px', right: '-320px', width: '40px', height: '40px', pointerEvents: 'none' }} />
            <img src="/sparklestar_turquoise.png" alt="" style={{ position: 'absolute', top: '100px', right: '-360px', width: '40px', height: '40px', pointerEvents: 'none' }} />
            <img src="/sparklestar_blue.png" alt="" style={{ position: 'absolute', top: '-20px', left: '-320px', width: '40px', height: '40px', pointerEvents: 'none' }} />
            <img src="/sparklestar_yellow.png" alt="" style={{ position: 'absolute', top: '100px', left: '-360px', width: '40px', height: '40px', pointerEvents: 'none' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px', marginTop: isTablet ? '-70px' : '24px' }}>
            <img src="/whiskers_left.png" alt="" style={{ height: isTablet ? '48px' : '32px', width: 'auto', pointerEvents: 'none' }} />
            <p style={{ fontFamily: 'var(--font-amatic)', fontWeight: 700, color: '#eddbc3', fontSize: '1.8rem', letterSpacing: '0.04em', margin: 0, lineHeight: 1 }}>
              Take a peek
            </p>
            <img src="/whiskers_right.png" alt="" style={{ height: isTablet ? '48px' : '32px', width: 'auto', pointerEvents: 'none' }} />
          </div>
          </div>
          <div style={{ position: 'relative', display: 'inline-block', width: '100%', marginTop: isTablet ? '20px' : '0', marginBottom: '12px' }}>
            <div style={{ transform: 'translateY(-80px)', position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            {[
              { top: '-60px',  left: '5%',   s: 5, o: 0.6 },
              { top: '-40px',  left: '18%',  s: 4, o: 0.4 },
              { top: '-100px', left: '10%',  s: 3, o: 0.5 },
              { top: '-80px',  left: '30%',  s: 4, o: 0.3 },
              { top: '-120px', left: '2%',   s: 4, o: 0.6 },
              { top: '-150px', left: '8%',   s: 3, o: 0.4 },
              { top: '-170px', left: '22%',  s: 5, o: 0.5 },
              { top: '-140px', left: '35%',  s: 3, o: 0.3 },
              { top: '-200px', left: '5%',   s: 4, o: 0.5 },
              { top: '-180px', left: '15%',  s: 3, o: 0.3 },
              { top: '-80px',  right: '10%', s: 5, o: 0.7 },
              { top: '-50px',  right: '25%', s: 4, o: 0.5 },
              { top: '-110px', right: '3%',  s: 3, o: 0.4 },
              { top: '-70px',  right: '30%', s: 4, o: 0.3 },
              { top: '-130px', right: '18%', s: 5, o: 0.6 },
              { top: '-160px', right: '8%',  s: 3, o: 0.4 },
              { top: '-185px', right: '22%', s: 4, o: 0.5 },
              { top: '-145px', right: '35%', s: 3, o: 0.3 },
              { top: '-210px', right: '12%', s: 4, o: 0.4 },
              { top: '-175px', right: '4%',  s: 3, o: 0.5 },
              { top: '10%',   left: '2%',   s: 5, o: 0.7 },
              { top: '55%',   left: '6%',   s: 4, o: 0.5 },
              { top: '80%',   left: '3%',   s: 6, o: 0.4 },
              { top: '20%',   right: '4%',  s: 5, o: 0.8 },
              { top: '65%',   right: '7%',  s: 4, o: 0.5 },
              { top: '85%',   right: '2%',  s: 5, o: 0.6 },
              { top: '120%',  left: '8%',   s: 5, o: 0.5 },
              { top: '140%',  left: '22%',  s: 4, o: 0.4 },
              { top: '130%',  right: '12%', s: 5, o: 0.6 },
              { top: '150%',  right: '5%',  s: 4, o: 0.5 },
            ].map((d, i) => (
              <span key={i} style={{ position: 'absolute', top: d.top, left: (d as any).left, right: (d as any).right, width: `${d.s}px`, height: `${d.s}px`, borderRadius: '50%', backgroundColor: '#fff', opacity: d.o, pointerEvents: 'none' }} />
            ))}
            </div>
            <h2 style={{ fontFamily: 'var(--font-cormorant), serif', color: '#eddbc3', fontSize: 'clamp(2.8rem, 9vw, 4rem)', fontWeight: 700, lineHeight: 1.1, margin: 0 }}>
              What's on our shelves?
            </h2>
          </div>
          <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#eddbc3', fontSize: isTablet ? '1.1rem' : '1.05rem', lineHeight: 1.6, marginBottom: '24px', marginTop: isTablet ? '24px' : '0' }}>
            Every book in Bonkers is handpicked. Popular favourites, hidden gems and wonderfully weird discoveries, organised so kids can find something they genuinely want to read.
          </p>

          {/* Reading level selector — artwork cards */}
          <div style={{ marginBottom: '36px', marginTop: isTablet ? '80px' : '0' }}>
            <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#eddbc3', fontSize: isTablet ? '0.85rem' : '0.75rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: '12px', textAlign: 'left' }}>Browse by Age</p>
            <div style={{ display: 'flex', flexDirection: 'row', gap: isTablet ? '10px' : '6px', marginLeft: isTablet ? '0' : '-8px', marginRight: isTablet ? '0' : '-8px' }}>
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
                    style={{ background: 'transparent', border: `1.5px solid ${isSelected ? '#f9ce71' : 'rgba(237,219,195,0.3)'}`, borderRadius: '12px', cursor: 'pointer', display: 'flex', flexDirection: 'row', alignItems: 'center', overflow: 'hidden', transition: 'border-color 0.15s', flex: 1, padding: isTablet ? '18px 12px' : '18px 2px', gap: isTablet ? '10px' : '0px' }}>
                    <div style={{ height: '60px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: isTablet ? 'center' : 'flex-start' }}>
                      <img src={art} alt={level.name} style={{ width: isTablet ? (key.startsWith('hatchling') || key === '3-5' ? '70px' : key.startsWith('chick') || key === '5-7' ? '66px' : '88px') : (key.startsWith('hatchling') ? '34px' : key.startsWith('chick') ? '32px' : '46px'), height: isTablet ? (key.startsWith('hatchling') || key === '3-5' ? '70px' : key.startsWith('chick') || key === '5-7' ? '66px' : '88px') : (key.startsWith('hatchling') ? '34px' : key.startsWith('chick') ? '32px' : '46px'), objectFit: 'contain', display: 'block' }} />
                    </div>
                    <div style={{ textAlign: 'left' }}>
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
            <div style={{ marginBottom: '16px', marginTop: isTablet ? '80px' : '0' }}>
              <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#eddbc3', fontSize: isTablet ? '0.85rem' : '0.75rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: '10px', textAlign: 'left' }}>Browse by Category</p>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', flexWrap: isTablet ? 'nowrap' : 'wrap', overflowX: isTablet ? 'auto' : 'visible', padding: isTablet ? '4px 44px' : '4px 2px', margin: isTablet ? '0 -44px' : '0', WebkitOverflowScrolling: 'touch' as any }}>
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
        <div style={{ position: 'relative', width: '100%', marginTop: '90px' }}>
          {/* Walking book peeking from left */}
          <img src="/book_walking_left.png" alt="" style={{ position: 'absolute', left: isTablet ? '-36px' : '-16px', bottom: '26%', height: '28%', width: 'auto', zIndex: 4, pointerEvents: 'none' }} />
          {/* Penguin on right side of shelf */}
          <img src="/penguin_bookshelf.png" alt="" style={{ position: 'absolute', right: '-10px', bottom: '22%', height: '35%', width: 'auto', zIndex: 4, pointerEvents: 'none' }} />
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

        <div style={{ textAlign: 'center', marginTop: isTablet ? '32px' : '24px', transform: 'scale(1.15)', transformOrigin: 'center' }}>
          <CheckAreaButton onClick={goCheck} />
        </div>

        <div style={{ textAlign: 'center', padding: isTablet ? '60px 24px 8px' : '10px 24px 8px' }}>

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
      <section style={{ padding: isTablet ? '1280px 44px 0' : '560px 16px 0', backgroundImage: 'url(/whybonkerspage.png)', backgroundSize: '100% auto', backgroundPosition: isTablet ? 'center 380px' : 'center 200px', backgroundRepeat: 'no-repeat', position: 'relative', zIndex: 5 }}>
          <img src="/whybonkersbooks.png" alt="" className="lp-books-img" style={{ position: 'absolute', right: '0', bottom: '40px', height: '18%', width: 'auto', pointerEvents: 'none', zIndex: 1 }} />
          <div style={{ position: 'absolute', top: isTablet ? '76px' : '58px', left: 0, right: 0, textAlign: 'center', padding: isTablet ? '0 44px' : '0 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <img src="/whiskers_left.png" alt="" style={{ height: isTablet ? '40px' : '28px', width: 'auto', pointerEvents: 'none' }} />
              <p style={{ fontFamily: 'var(--font-amatic), sans-serif', fontWeight: 700, color: '#eddbc3', fontSize: isTablet ? '2rem' : '1.5rem', letterSpacing: '0.04em', margin: 0, lineHeight: 1 }}>Bonkers World</p>
              <img src="/whiskers_right.png" alt="" style={{ height: isTablet ? '40px' : '28px', width: 'auto', pointerEvents: 'none' }} />
            </div>
            <h2 style={{ fontFamily: 'var(--font-cormorant), serif', color: '#eddbc3', fontSize: isTablet ? 'clamp(2.6rem, 5vw, 3.6rem)' : 'clamp(1.8rem, 7vw, 2.4rem)', fontWeight: 600, lineHeight: 1.2, margin: 0, width: '100%' }}>
              Every reader gets a world of their own.
            </h2>
            <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#eddbc3', fontSize: isTablet ? '0.95rem' : '0.82rem', lineHeight: 1.6, margin: 0, opacity: 0.85, maxWidth: '720px', width: '100%' }}>
              Every book they read unlocks something new. The more they read, the more their world grows.
            </p>
          </div>
        <div style={{ maxWidth: isTablet ? '100%' : '480px', margin: '0 auto', position: 'relative', zIndex: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px', marginTop: isTablet ? '100px' : '40px' }}>
            <img src="/whiskers_left.png" alt="" style={{ height: isTablet ? '48px' : '32px', width: 'auto', pointerEvents: 'none' }} />
            <p style={{ fontFamily: 'var(--font-amatic), sans-serif', color: '#eddbc3', fontSize: '1.8rem', fontWeight: 700, letterSpacing: '0.04em', margin: 0 }}>
              Why Bonkers?
            </p>
            <img src="/whiskers_right.png" alt="" style={{ height: isTablet ? '48px' : '32px', width: 'auto', pointerEvents: 'none' }} />
          </div>
          <h2 style={{ fontFamily: 'var(--font-cormorant), serif', color: '#eddbc3', fontSize: 'clamp(2.16rem, 7.2vw, 3.12rem)', fontWeight: 700, lineHeight: 1.1, marginBottom: '36px', marginTop: isTablet ? '48px' : '16px', textAlign: 'center', whiteSpace: 'nowrap' }}>
            The 'Great Book' Hunt
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', marginTop: isTablet ? '48px' : '0' }}>
            {[
              { title: 'Nine billion books. Good luck.', desc: 'There are approximately nine billion children\'s books to choose from.* You have twenty minutes in the bookshop, and one increasingly bored child. Let Bonkers do the digging for you. Every Bonkers book is handpicked, read and judged by actual kids, with the boring ones shown the door.\n* Possibly an exaggeration.' },
              { title: 'The AED 50+ Gamble', desc: 'They begged for it. They read six pages. They never touched it again. Joining Bonkers means kids can experiment with new books and genres without every experiment costing AED 50+.' },
              { title: 'Your bookshelf called. It\'s full.', desc: 'Books are wonderful. Four hundred books your children have outgrown are... storage. Joining Bonkers means they can keep the books they can\'t part with as long as they like, and exchange the rest for fresh new stories.' },
              { title: '"Muuuum, can I get this?"', desc: 'No dragging everyone around a bookshop and mysteriously leaving with 7 squishies and a slime kit. Independent readers can choose their own Bonkers books and even arrange their own delivery and collection.' },
            ].map((reason, i) => (
              <div key={i} style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                <img src="/star_button_on.png" alt="" style={{ width: isTablet ? '26px' : '18px', height: isTablet ? '26px' : '18px', flexShrink: 0, marginTop: isTablet ? '22px' : '10px' }} />
                <div>
                  <p style={{ fontFamily: 'var(--font-cormorant), serif', color: '#eddbc3', fontSize: '1.61rem', fontWeight: 700, marginBottom: '4px', whiteSpace: 'nowrap' }}>{reason.title}</p>
                  <p style={{ color: '#eddbc3', fontSize: '1rem', lineHeight: 1.5, opacity: 0.9, whiteSpace: 'pre-line', margin: 0 }}>{reason.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: isTablet ? '140px' : '120px', marginLeft: isTablet ? '-44px' : '-24px', width: isTablet ? 'calc(100% + 88px)' : 'calc(100% + 48px)', position: 'relative' }}>
            <img src="/bonkers_questions.png" alt="" style={{ width: '100%', height: 'auto', display: 'block' }} />
            <h2 style={{ position: 'absolute', top: '65%', left: '63%', transform: 'translate(-50%, -50%)', fontFamily: 'var(--font-cormorant), serif', color: '#1a2744', fontSize: 'clamp(4rem, 10vw, 7rem)', fontWeight: 700, margin: 0, whiteSpace: 'nowrap' }}>uestions?</h2>
            <img src="/sparklestar_yellow.png" alt="" style={{ position: 'absolute', top: '8%', left: '12%', width: isTablet ? '48px' : '30px', height: isTablet ? '48px' : '30px', pointerEvents: 'none' }} />

            <img src="/sparklestar_blue.png" alt="" style={{ position: 'absolute', top: '55%', left: '6%', width: isTablet ? '44px' : '28px', height: isTablet ? '44px' : '28px', pointerEvents: 'none' }} />
            <img src="/sparklestar_yellow.png" alt="" style={{ position: 'absolute', bottom: '12%', left: '20%', width: isTablet ? '34px' : '22px', height: isTablet ? '34px' : '22px', pointerEvents: 'none' }} />
            <img src="/sparklestar_pink.png" alt="" style={{ position: 'absolute', bottom: '8%', right: '18%', width: isTablet ? '42px' : '26px', height: isTablet ? '42px' : '26px', pointerEvents: 'none' }} />
            <img src="/sparklestar_blue.png" alt="" style={{ position: 'absolute', top: '35%', right: '6%', width: isTablet ? '32px' : '20px', height: isTablet ? '32px' : '20px', pointerEvents: 'none' }} />
            <img src="/sparklestar_yellow.png" alt="" style={{ position: 'absolute', top: '4%', right: '28%', width: isTablet ? '30px' : '18px', height: isTablet ? '30px' : '18px', pointerEvents: 'none' }} />
            <img src="/sparklestar_blue.png" alt="" style={{ position: 'absolute', top: '22%', left: '4%', width: isTablet ? '28px' : '18px', height: isTablet ? '28px' : '18px', pointerEvents: 'none' }} />
            <img src="/sparklestar_yellow.png" alt="" style={{ position: 'absolute', bottom: isTablet ? '22%' : '8%', right: '8%', width: isTablet ? '46px' : '28px', height: isTablet ? '46px' : '28px', pointerEvents: 'none' }} />
            <img src="/sparklestar_pink.png" alt="" style={{ position: 'absolute', top: '45%', right: '22%', width: isTablet ? '28px' : '18px', height: isTablet ? '28px' : '18px', pointerEvents: 'none' }} />
            <img src="/sparklestar_blue.png" alt="" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: isTablet ? '34px' : '22px', height: isTablet ? '34px' : '22px', pointerEvents: 'none' }} />
            <img src="/sparklestar_yellow.png" alt="" style={{ position: 'absolute', top: '30%', left: '28%', width: isTablet ? '28px' : '18px', height: isTablet ? '28px' : '18px', pointerEvents: 'none' }} />
          </div>
        </div>
      </section>

      {/* ── 6. FAQ + FINAL CTA + FOOTER ── cream background wrapper */}
      <div style={{ backgroundColor: '#fdf8ea', marginTop: '-4px' }}>

        <section style={{ padding: isTablet ? '60px 44px 120px' : '40px 24px 120px' }}>
          <div style={{ maxWidth: isTablet ? '680px' : '480px', margin: '0 auto' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {FAQS.map((faq, i) => (
                <div key={i} style={{ borderBottom: '1px solid rgba(26,39,68,0.2)', overflow: 'hidden' }}>
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: '16px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontFamily: 'var(--font-cormorant), serif', color: '#1a2744', fontSize: isTablet ? '1.35rem' : '1.15rem', fontWeight: 600, lineHeight: 1.3 }}>{faq.q}</span>
                    <span style={{ color: '#1a2744', fontSize: '1.2rem', flexShrink: 0, transition: 'transform 0.2s', transform: openFaq === i ? 'rotate(45deg)' : 'none' }}>+</span>
                  </button>
                  {openFaq === i && (
                    <p style={{ color: '#1a2744', fontSize: isTablet ? '1.05rem' : '0.9rem', lineHeight: 1.6, paddingBottom: '16px' }}>
                      {faq.a}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        <img src="/bonkers_bottompage.png" alt="" style={{ width: '100%', height: 'auto', display: 'block', position: 'relative', zIndex: 1 }} />

        <section style={{ padding: isTablet ? '0 24px 200px' : '0 24px 100px', textAlign: 'center', position: 'relative', zIndex: 2, marginTop: isTablet ? '-280px' : '-180px' }}>
          <div style={{ maxWidth: '600px', margin: '0 auto' }}>
            <h2 style={{ fontFamily: 'var(--font-cormorant), serif', color: '#1a2744', fontSize: 'clamp(2rem, 7vw, 2.8rem)', fontWeight: 700, lineHeight: 1.05, marginBottom: '28px', whiteSpace: 'nowrap' }}>
              Ready to go Bonkers?
            </h2>
            <CheckAreaButton onClick={goCheck} />
          </div>
        </section>

        <footer style={{ backgroundColor: '#1a2744', padding: '20px 24px', textAlign: 'center', position: 'relative', zIndex: 2 }}>
          <p style={{ color: '#eddbc3', opacity: 0.45, fontSize: '0.75rem', letterSpacing: '0.06em', margin: 0 }}>
            © {new Date().getFullYear()} Bonkers The Children's Library · Dubai · hello@bonkers.ae
          </p>
        </footer>

      </div>

      <style>{`
        section::-webkit-scrollbar { display: none; }
        div::-webkit-scrollbar { display: none; }
      `}</style>
    </main>
  )
}

function CheckAreaButton({ onClick }: { onClick: () => void }) {
  const whiskerFilter = 'brightness(0) saturate(100%) invert(87%) sepia(33%) saturate(762%) hue-rotate(339deg) brightness(103%) contrast(98%)'
  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <img src="/whiskers_left.png" alt="" style={{ position: 'absolute', left: '-44px', height: '60px', width: 'auto', pointerEvents: 'none', zIndex: 1, filter: whiskerFilter }} />
      <button onClick={onClick}
        style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 400, fontSize: '0.78rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#fff', backgroundImage: 'url(/button2.png)', backgroundSize: '300% 300%', backgroundPosition: 'center', backgroundRepeat: 'no-repeat', backgroundColor: 'transparent', border: 'none', borderRadius: '999px', padding: '12px 28px', cursor: 'pointer' }}>
        Join Bonkers
      </button>
      <img src="/whiskers_right.png" alt="" style={{ position: 'absolute', right: '-44px', height: '60px', width: 'auto', pointerEvents: 'none', zIndex: 1, filter: whiskerFilter }} />
    </div>
  )
}
