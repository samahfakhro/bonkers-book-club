'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Child = {
  id: string
  name: string
  nickname: string | null
  avatar_url: string | null
  reading_level_id: string | null
  reading_level: { id: string; name: string } | null
}

type Book = {
  id: string
  title: string
  author: string
  cover_image_url: string | null
}

type Category = {
  id: string
  name: string
  image_url: string | null
}

type ReadingLevel = {
  id: string
  name: string
}

function BookCard({ book, onPress }: { book: Book; onPress: () => void }) {
  return (
    <button onClick={onPress} className="text-left flex flex-col flex-shrink-0"
      style={{ background: 'none', border: 'none', cursor: 'pointer', width: '110px' }}>
      <div className="rounded-xl overflow-hidden mb-2" style={{ width: '110px', aspectRatio: '2/3', backgroundColor: 'rgba(237,219,195,0.1)' }}>
        {book.cover_image_url
          ? <img src={book.cover_image_url} alt={book.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <div className="w-full h-full flex items-center justify-center">
              <span style={{ color: '#eddbc3', opacity: 0.2, fontSize: '2rem' }}>book</span>
            </div>
        }
      </div>
      <p style={{ fontFamily: 'var(--font-cormorant), serif', color: '#eddbc3', fontSize: '0.95rem', fontWeight: 700, lineHeight: 1.2 }}>
        {book.title}
      </p>
      <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#eddbc3', fontSize: '0.65rem', opacity: 0.6, marginTop: '2px' }}>
        {book.author}
      </p>
    </button>
  )
}

export default function LibraryPage() {
  const router = useRouter()
  const surpriseBtnRef = useRef<HTMLButtonElement>(null)

  const [children, setChildren] = useState<Child[]>([])
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null)
  const [readingLevels, setReadingLevels] = useState<ReadingLevel[]>([])
  const [activeLevels, setActiveLevels] = useState<ReadingLevel[]>([])

  const [categories, setCategories] = useState<Category[]>([])
  const [booksByCategory, setBooksByCategory] = useState<Record<string, Book[]>>({})
  const [newArrivals, setNewArrivals] = useState<Book[]>([])
  const [popular, setPopular] = useState<Book[]>([])

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Book[] | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)

  const [loading, setLoading] = useState(true)
  const [surpriseActive, setSurpriseActive] = useState(false)
  const [surpriseWiggle, setSurpriseWiggle] = useState(false)
  const [particles, setParticles] = useState<{ id: number; src: string; x: number; y: number; size: number; angle: number; distance: number; rotation: number }[]>([])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const bookSelect = 'id, title, author, cover_image_url'
      const { data: household } = await supabase
        .from('households').select('id').eq('user_id', user.id).single()

      const [{ data: kids }, { data: cats }, { data: levels }, { data: arrivals }, { data: pop }] = await Promise.all([
        household
          ? supabase.from('child_profiles')
              .select('id, name, nickname, avatar_url, reading_level_id, reading_level:reading_level_id(id, name)')
              .eq('household_id', household.id)
              .order('created_at')
          : Promise.resolve({ data: [] }),
        supabase.from('categories').select('id, name, image_url').order('display_order'),
        supabase.from('reading_levels').select('id, name').order('display_order'),
        supabase.from('books').select(bookSelect).eq('is_active', true).order('created_at', { ascending: false }).limit(10),
        supabase.from('books').select(bookSelect).eq('is_active', true).order('total_ratings_count', { ascending: false }).limit(10),
      ])

      if (arrivals) setNewArrivals(arrivals)
      if (pop) setPopular(pop)

      setCategories(cats || [])
      setReadingLevels(levels || [])

      const childList = (kids || []) as unknown as Child[]
      setChildren(childList)

      if (childList.length > 0) {
        const first = childList[0]
        setSelectedChildId(first.id)
        if (first.reading_level) setActiveLevels([first.reading_level])
      }

      setLoading(false)
    }
    load()
  }, [])

  useEffect(() => {
    async function loadBooks() {
      let bookQuery = supabase.from('books').select('id, title, author, cover_image_url').eq('is_active', true)
      if (activeLevels.length > 0) bookQuery = bookQuery.in('reading_level_id', activeLevels.map(l => l.id))
      const { data: books } = await bookQuery

      if (!books || books.length === 0) { setBooksByCategory({}); return }

      const { data: bookCats } = await supabase
        .from('book_categories')
        .select('book_id, category_id')
        .in('book_id', books.map(b => b.id))

      const grouped: Record<string, Book[]> = {}
      for (const bc of bookCats || []) {
        if (!grouped[bc.category_id]) grouped[bc.category_id] = []
        const book = books.find(b => b.id === bc.book_id)
        if (book && !grouped[bc.category_id].find(b => b.id === book.id)) {
          grouped[bc.category_id].push(book)
        }
      }
      setBooksByCategory(grouped)
    }
    loadBooks()
  }, [activeLevels])

  function selectChild(childId: string) {
    setSelectedChildId(childId)
    const child = children.find(c => c.id === childId)
    setActiveLevels(child?.reading_level ? [child.reading_level] : [])
  }

  function toggleLevel(level: ReadingLevel) {
    setActiveLevels(prev =>
      prev.some(l => l.id === level.id)
        ? prev.filter(l => l.id !== level.id)
        : [...prev, level]
    )
  }

  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults(null); return }
    const t = setTimeout(async () => {
      setSearchLoading(true)
      const { data } = await supabase
        .from('books')
        .select('id, title, author, cover_image_url')
        .eq('is_active', true)
        .or(`title.ilike.%${searchQuery}%,author.ilike.%${searchQuery}%`)
        .limit(20)
      setSearchResults(data ?? [])
      setSearchLoading(false)
    }, 300)
    return () => clearTimeout(t)
  }, [searchQuery])

  function navigateToBook(id: string) { router.push(`/dashboard/library/${id}`) }

  async function handleSurpriseMe() {
    if (surpriseActive || surpriseWiggle) return
    setSurpriseWiggle(true)

    const { data } = await supabase.from('books').select('id').eq('is_active', true)
    const bookId = data && data.length > 0 ? data[Math.floor(Math.random() * data.length)].id : null

    setTimeout(() => {
      setSurpriseWiggle(false)
      setSurpriseActive(true)

      const rect = surpriseBtnRef.current?.getBoundingClientRect()
      const originX = rect ? ((rect.left + rect.width / 2) / window.innerWidth) * 100 : 50
      const originY = rect ? ((rect.top + rect.height / 2) / window.innerHeight) * 100 : 50

      const assets = [
        '/sparklestar_yellow.png', '/sparklestar_red.png', '/sparklestar_turquoise.png',
        '/sparklestar_purple.png', '/sparklestar_orange.png', '/sparklestar_pink.png',
        '/sparklestar_blue.png', '/feather_pink.png', '/feather_purple.png', '/feather_blue.png',
      ]
      const generated = Array.from({ length: 70 }, (_, i) => {
        const src = assets[Math.floor(Math.random() * assets.length)]
        const isFeather = src.startsWith('/feather')
        return {
          id: i, src,
          x: originX, y: originY,
          size: isFeather ? 90 + Math.floor(Math.random() * 80) : 32 + Math.floor(Math.random() * 52),
          angle: Math.random() * 360,
          distance: 250 + Math.random() * 500,
          rotation: -180 + Math.random() * 360,
        }
      })
      setParticles(generated)

      if (bookId) setTimeout(() => router.push(`/dashboard/library/${bookId}?surprise=true`), 400)
    }, 250)
  }

  if (loading) return (
    <main className="min-h-screen flex items-center justify-center">
      <p style={{ color: '#eddbc3', fontFamily: 'var(--font-montserrat), sans-serif' }}>Loading...</p>
    </main>
  )

  return (
    <main className="min-h-screen" style={{ paddingBottom: '88px' }}>
      <style>{`
        @keyframes bonky-wiggle {
          0%   { transform: translateY(0) rotate(0deg) scale(1); }
          10%  { transform: translateY(-10px) rotate(-4deg) scale(1); }
          25%  { transform: translateY(0) rotate(5deg) scale(1); }
          38%  { transform: translateY(-14px) rotate(-5deg) scale(1); }
          50%  { transform: translateY(0) rotate(3deg) scale(1); }
          60%  { transform: translateY(4px) rotate(0deg) scaleX(1.18) scaleY(0.82); }
          72%  { transform: translateY(6px) rotate(0deg) scaleX(1.28) scaleY(0.72); }
          85%  { transform: translateY(-6px) rotate(0deg) scaleX(0.88) scaleY(1.18); }
          100% { transform: translateY(0) rotate(0deg) scale(1); }
        }
        @keyframes bonky-burst {
          0%   { opacity: 1; transform: translate(-50%, -50%) rotate(0deg); }
          80%  { opacity: 1; transform: translate(calc(-50% + var(--bdx)), calc(-50% + var(--bdy))) rotate(var(--bdr)); }
          100% { opacity: 0; transform: translate(calc(-50% + var(--bdx)), calc(-50% + var(--bdy))) rotate(var(--bdr)); }
        }
      `}</style>

      {/* Search results overlay — appears above bottom bar when typing */}
      {searchQuery && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: '72px',
          zIndex: 49, overflowY: 'auto',
          backgroundColor: 'rgba(8, 4, 2, 0.97)',
          padding: '24px 16px 16px',
        }}>
          <div style={{ maxWidth: '576px', margin: '0 auto' }}>
            <p style={{ fontFamily: 'var(--font-cormorant), serif', color: '#f9d174', fontSize: '1.4rem', fontWeight: 600, marginBottom: '16px' }}>
              {searchLoading
                ? 'Searching...'
                : searchResults?.length === 0
                  ? 'No books found'
                  : 'Results'}
            </p>
            {!searchLoading && searchResults && searchResults.length > 0 && (
              <div className="grid grid-cols-3 gap-4">
                {searchResults.map(book => (
                  <BookCard key={book.id} book={book} onPress={() => { setSearchQuery(''); navigateToBook(book.id) }} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main scrollable content */}
      <div className="max-w-xl mx-auto px-4 pt-8">

        {/* Top bar */}
        <div className="flex flex-col items-center mb-6">
          <img src="/Bonkers_Word_Logo_White1.png" alt="Bonkers Book Club" style={{ width: '120px', height: 'auto' }} />
          <h1 style={{ fontFamily: 'var(--font-cormorant), serif', color: '#eddbc3', fontSize: '3rem', fontWeight: 700, marginTop: '40px', lineHeight: 1 }}>
            Library
          </h1>
        </div>

        {/* Browsing for — always visible */}
        <div className="mb-6 flex items-center justify-start gap-3 flex-wrap">
          <p style={{ fontFamily: 'var(--font-amatic), cursive', color: '#f9d174', fontSize: '1.8rem', fontWeight: 700, letterSpacing: '0.05em', lineHeight: 1, flexShrink: 0 }}>
            Browsing for
          </p>
          <div className="flex gap-2 flex-wrap justify-center">
            {children.length > 0 ? children.map(child => (
              <button key={child.id} onClick={() => selectChild(child.id)}
                className="flex items-center gap-2 flex-shrink-0 rounded-full px-4 py-2"
                style={{
                  background: 'none', cursor: 'pointer',
                  border: `2px solid ${selectedChildId === child.id ? '#f9d174' : 'rgba(237,219,195,0.3)'}`,
                  backgroundColor: selectedChildId === child.id ? 'rgba(249,209,116,0.12)' : 'transparent',
                }}>
                {child.avatar_url && (
                  <img src={child.avatar_url} alt="" style={{ width: '22px', height: '22px', borderRadius: '50%', objectFit: 'cover' }} />
                )}
                <span style={{
                  fontFamily: 'var(--font-cormorant), serif', fontSize: '1.1rem', fontWeight: 700,
                  color: selectedChildId === child.id ? '#f9d174' : '#eddbc3',
                }}>
                  {child.nickname || child.name}
                </span>
              </button>
            )) : (
              <div className="rounded-full px-5 py-2" style={{ border: '2px solid rgba(237,219,195,0.15)' }}>
                <span style={{ fontFamily: 'var(--font-cormorant), serif', fontSize: '1.1rem', color: '#eddbc3', opacity: 0.25 }}>
                  No children added yet
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Reading level filter */}
        <div className="mb-8">
          <p style={{ fontFamily: 'var(--font-amatic), cursive', color: '#f9d174', fontSize: '1.8rem', fontWeight: 700, letterSpacing: '0.05em', marginBottom: '12px', textAlign: 'left' }}>
            Reading Level
          </p>
          <div className="grid grid-cols-3 gap-3">
            {readingLevels.map(level => {
              const key = level.name.toLowerCase()
              const ageMap: Record<string, string> = { hatchling: '3–5 yrs', hatchlings: '3–5 yrs', chick: '5–7 yrs', chicks: '5–7 yrs', bird: '8–10 yrs', birds: '8–10 yrs' }
              const imgMap: Record<string, string> = { hatchling: '/categorycards_hatchlings.png', hatchlings: '/categorycards_hatchlings.png', chick: '/categorycards_chicks.png', chicks: '/categorycards_chicks.png', bird: '/categorycards_birds.png', birds: '/categorycards_birds.png' }
              const isSelected = activeLevels.some(l => l.id === level.id)
              return (
                <button key={level.id}
                  onClick={() => toggleLevel(level)}
                  className="flex flex-col items-center"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  <div style={{
                    width: '100%', borderRadius: '12px', overflow: 'hidden',
                    border: `4px solid ${isSelected ? '#e57451' : 'transparent'}`,
                    boxShadow: 'none',
                    transition: 'border-color 0.15s',
                    lineHeight: 0, fontSize: 0,
                  }}>
                    {imgMap[key]
                      ? <img src={imgMap[key]} alt={level.name} style={{ width: '100%', aspectRatio: '2/3', objectFit: 'cover', display: 'block' }} />
                      : <div style={{ width: '100%', aspectRatio: '2/3', backgroundColor: 'rgba(237,219,195,0.1)' }} />
                    }
                  </div>
                  <p style={{ fontFamily: 'var(--font-cormorant), serif', color: isSelected ? '#e57451' : '#eddbc3', fontSize: '1rem', fontWeight: 700, marginTop: '6px', lineHeight: 1 }}>
                    {level.name}
                  </p>
                  <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#eddbc3', fontSize: '0.65rem', opacity: 0.55, marginTop: '2px' }}>
                    {ageMap[key] || ''}
                  </p>
                </button>
              )
            })}
          </div>
        </div>

        {/* Category sections */}
        {categories.map(category => {
          const books = booksByCategory[category.id] || []
          return (
            <section key={category.id} className="mb-10">
              <div className="mb-3">
                <span style={{ fontFamily: 'var(--font-cormorant), serif', color: '#f9d174', fontSize: '1.8rem', fontWeight: 600, lineHeight: 1 }}>
                  {category.name}
                </span>
              </div>

              {category.image_url && (
                <button onClick={() => router.push(`/dashboard/library/category/${category.id}`)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'block', width: '100%', marginBottom: '12px' }}>
                  <img src={category.image_url} alt={category.name}
                    style={{ width: '100%', aspectRatio: '21/9', objectFit: 'cover', borderRadius: '16px', display: 'block' }} />
                </button>
              )}

              {books.length > 0
                ? <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
                    {books.map(book => (
                      <BookCard key={book.id} book={book} onPress={() => navigateToBook(book.id)} />
                    ))}
                  </div>
                : <p style={{ color: '#eddbc3', opacity: 0.35, fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.8rem' }}>
                    No books at this level yet
                  </p>
              }

              <div className="flex justify-end mt-2">
                <button onClick={() => router.push(`/dashboard/library/category/${category.id}`)}
                  className="flex items-center gap-1"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-amatic), sans-serif', color: '#eddbc3', fontSize: '1.6rem', fontWeight: 700 }}>
                  <img src="/whiskers_left.png" alt="" style={{ height: '28px', width: 'auto' }} />
                  See all
                  <img src="/arrow_cream.png" alt="" style={{ height: '16px', width: 'auto' }} />
                </button>
              </div>
            </section>
          )
        })}

        {/* Surprise Me */}
        <section className="mb-10">
          <p style={{ fontFamily: 'var(--font-cormorant), serif', color: '#f9d174', fontSize: '1.8rem', fontWeight: 600, marginBottom: '12px' }}>
            Surprise Me
          </p>
          <button ref={surpriseBtnRef} onClick={handleSurpriseMe} disabled={surpriseActive || surpriseWiggle}
            style={{ background: 'none', border: 'none', cursor: (surpriseActive || surpriseWiggle) ? 'default' : 'pointer', padding: 0 }}>
            <img src="/surpriseme.png" alt="Surprise Me" style={{
              width: '140px', height: 'auto',
              animation: surpriseWiggle ? 'bonky-wiggle 0.85s ease-in-out forwards' : 'none',
            }} />
          </button>
        </section>

        {/* New to Bonkers */}
        <section className="mb-10">
          <p style={{ fontFamily: 'var(--font-cormorant), serif', color: '#f9d174', fontSize: '1.8rem', fontWeight: 600, lineHeight: 1, marginBottom: '12px' }}>New to Bonkers</p>
          {newArrivals.length > 0
            ? <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
                {newArrivals.slice(0, 8).map(book => (
                  <BookCard key={book.id} book={book} onPress={() => navigateToBook(book.id)} />
                ))}
              </div>
            : <p style={{ color: '#eddbc3', opacity: 0.35, fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.8rem' }}>Coming soon!</p>
          }
          <div className="flex justify-end mt-2">
            <button onClick={() => router.push('/dashboard/library/all?sort=new')}
              className="flex items-center gap-1"
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-amatic), sans-serif', color: '#eddbc3', fontSize: '1.6rem', fontWeight: 700 }}>
              <img src="/whiskers_left.png" alt="" style={{ height: '28px', width: 'auto' }} />
              See all
              <img src="/arrow_cream.png" alt="" style={{ height: '16px', width: 'auto' }} />
            </button>
          </div>
        </section>

        {/* Most Loved */}
        <section className="mb-10">
          <p style={{ fontFamily: 'var(--font-cormorant), serif', color: '#f9d174', fontSize: '1.8rem', fontWeight: 600, lineHeight: 1, marginBottom: '12px' }}>Most Loved</p>
          {popular.length > 0
            ? <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
                {popular.slice(0, 8).map(book => (
                  <BookCard key={book.id} book={book} onPress={() => navigateToBook(book.id)} />
                ))}
              </div>
            : <p style={{ color: '#eddbc3', opacity: 0.35, fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.8rem' }}>Coming soon!</p>
          }
          <div className="flex justify-end mt-2">
            <button onClick={() => router.push('/dashboard/library/all?sort=popular')}
              className="flex items-center gap-1"
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-amatic), sans-serif', color: '#eddbc3', fontSize: '1.6rem', fontWeight: 700 }}>
              <img src="/whiskers_left.png" alt="" style={{ height: '28px', width: 'auto' }} />
              See all
              <img src="/arrow_cream.png" alt="" style={{ height: '16px', width: 'auto' }} />
            </button>
          </div>
        </section>

        {/* Browse Everything */}
        <section className="mb-10">
          <div className="relative flex items-center justify-center" style={{ width: '71%', maxWidth: '260px', margin: '0 auto' }}>
            <img src="/whiskers_left.png" alt="" style={{ position: 'absolute', left: '-15px', height: '50px', width: 'auto', zIndex: 1, pointerEvents: 'none' }} />
            <div style={{ position: 'relative', width: '100%', paddingBottom: 'calc(100% / 2.97)' }}>
              <button
                onClick={() => router.push('/dashboard/library/all')}
                className="flex items-center justify-center border-none bg-transparent cursor-pointer"
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', backgroundImage: 'url(/button2.png)', backgroundSize: '100% 100%', backgroundRepeat: 'no-repeat' }}>
                <span className="relative z-10 flex items-center text-2xl text-white" style={{ fontFamily: 'var(--font-amatic)', fontWeight: 700, letterSpacing: '0.04em', marginBottom: '9px' }}>
                  Browse everything
                </span>
              </button>
            </div>
            <img src="/whiskers_right.png" alt="" style={{ position: 'absolute', right: '-15px', height: '50px', width: 'auto', zIndex: 1, pointerEvents: 'none' }} />
          </div>
        </section>

      </div>

      {/* Sticky bottom bar — home button + search */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
        backgroundColor: 'rgba(8, 4, 2, 0.95)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        borderTop: '1px solid rgba(237,219,195,0.12)',
        padding: '10px 16px 18px',
        display: 'flex', alignItems: 'center', gap: '10px',
      }}>
        <button onClick={() => router.push('/dashboard')}
          style={{ flex: 'none', width: '42px', height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', opacity: 0.7 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#eddbc3" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z"/>
            <path d="M9 21V12h6v9"/>
          </svg>
        </button>
        <div style={{ flex: 1, position: 'relative' }}>
          <input
            type="text"
            placeholder="Search books or authors"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="focus:outline-none"
            style={{
              width: '100%', padding: '10px 38px 10px 16px', borderRadius: '999px',
              border: '1px solid rgba(237,219,195,0.25)',
              backgroundColor: 'rgba(237,219,195,0.1)', color: '#eddbc3',
              fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.88rem',
              boxSizing: 'border-box',
            }}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')}
              style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#eddbc3', opacity: 0.5, cursor: 'pointer', fontSize: '0.9rem' }}>
              X
            </button>
          )}
        </div>
      </div>

      {/* Particle burst overlay */}
      {surpriseActive && particles.length > 0 && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 999, pointerEvents: 'none', overflow: 'hidden' }}>
          {particles.map(p => {
            const dx = Math.round(Math.cos(p.angle * Math.PI / 180) * p.distance)
            const dy = Math.round(Math.sin(p.angle * Math.PI / 180) * p.distance)
            return (
              <img key={p.id} src={p.src} alt=""
                style={{
                  position: 'absolute',
                  left: `${p.x}%`, top: `${p.y}%`,
                  width: `${p.size}px`, height: 'auto',
                  ['--bdx' as any]: `${dx}px`,
                  ['--bdy' as any]: `${dy}px`,
                  ['--bdr' as any]: `${p.rotation}deg`,
                  animation: `bonky-burst ${1.4 + Math.random() * 0.6}s ease-out ${Math.random() * 0.2}s forwards`,
                } as React.CSSProperties}
              />
            )
          })}
        </div>
      )}
    </main>
  )
}
