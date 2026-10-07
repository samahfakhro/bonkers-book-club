'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

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
    <button onClick={onPress} className="text-left flex flex-col"
      style={{ background: 'none', border: 'none', cursor: 'pointer', width: '100%' }}>
      <div className="rounded-xl overflow-hidden mb-2" style={{ width: '100%', aspectRatio: '2/3', backgroundColor: 'rgba(237,219,195,0.1)' }}>
        {book.cover_image_url
          ? <img src={book.cover_image_url} alt={book.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <div className="w-full h-full flex items-center justify-center">
              <span style={{ color: '#eddbc3', opacity: 0.2, fontSize: '2rem' }}>📖</span>
            </div>
        }
      </div>
      <p style={{ fontFamily: 'var(--font-cormorant), serif', color: '#eddbc3', fontSize: '1rem', fontWeight: 700, lineHeight: 1.2 }}>
        {book.title}
      </p>
      <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#eddbc3', fontSize: '0.7rem', opacity: 0.6, marginTop: '2px' }}>
        {book.author}
      </p>
    </button>
  )
}

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

function CategoryPageInner() {
  const router = useRouter()
  const params = useParams()
  const categoryId = params.id as string

  const [category, setCategory] = useState<Category | null>(null)
  const [allCategories, setAllCategories] = useState<Category[]>([])
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([categoryId])
  const [books, setBooks] = useState<Book[]>([])
  const [readingLevels, setReadingLevels] = useState<ReadingLevel[]>([])
  const [activeLevels, setActiveLevels] = useState<ReadingLevel[]>([])
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false)
  const [sort, setSort] = useState<'az' | 'rated' | 'popular' | 'newest'>('popular')
  const [sortTouched, setSortTouched] = useState(false)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Book[] | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const [phIdx, setPhIdx] = useState(0)

  const PLACEHOLDERS = ['Looking for dinosaurs?', 'Looking for unicorns?', 'Looking for space adventures?', 'Looking for pirates?', 'Looking for football stories?', 'Looking for cats?', 'Looking for fairies?', 'Looking for mermaids?', 'Looking for bears?', 'Looking for dragons?', 'Looking for robots?', 'Looking for witches?']

  useEffect(() => {
    const t = setInterval(() => setPhIdx(i => (i + 1) % PLACEHOLDERS.length), 6000)
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

  useEffect(() => {
    async function load() {
      const [{ data: cat }, { data: allCats }, { data: levels }] = await Promise.all([
        supabase.from('categories').select('id, name, image_url').eq('id', categoryId).single(),
        supabase.from('categories').select('id, name, image_url').order('display_order'),
        supabase.from('reading_levels').select('id, name').order('display_order'),
      ])

      setCategory(cat)
      setAllCategories(allCats || [])
      const lvls = levels || []
      setReadingLevels(lvls)
      setLoading(false)
    }
    load()
  }, [categoryId])

  useEffect(() => {
    async function loadBooks() {
      if (selectedCategoryIds.length === 0) { setBooks([]); return }

      const { data: bookCats } = await supabase
        .from('book_categories')
        .select('book_id, category_id')
        .in('category_id', selectedCategoryIds)

      if (!bookCats || bookCats.length === 0) { setBooks([]); return }

      // Intersection: books must appear in ALL selected categories
      const countMap = new Map<string, number>()
      for (const bc of bookCats) countMap.set(bc.book_id, (countMap.get(bc.book_id) || 0) + 1)
      const bookIds = [...countMap.entries()]
        .filter(([, count]) => count === selectedCategoryIds.length)
        .map(([id]) => id)

      if (bookIds.length === 0) { setBooks([]); return }

      let query = supabase
        .from('books')
        .select('id, title, author, cover_image_url, average_rating, total_ratings_count')
        .eq('is_active', true)
        .in('id', bookIds)

      if (activeLevels.length > 0) query = query.in('reading_level_id', activeLevels.map(l => l.id))

      if (sort === 'rated') query = query.order('average_rating', { ascending: false })
      else if (sort === 'popular') query = query.order('total_ratings_count', { ascending: false })
      else if (sort === 'newest') query = query.order('created_at', { ascending: false })
      else query = query.order('title')

      const { data } = await query
      setBooks(data || [])
      const savedScroll = sessionStorage.getItem(`categoryScrollY_${categoryId}`)
      if (savedScroll) {
        requestAnimationFrame(() => {
          window.scrollTo(0, parseInt(savedScroll))
          sessionStorage.removeItem(`categoryScrollY_${categoryId}`)
        })
      }
    }
    loadBooks()
  }, [categoryId, activeLevels, sort, selectedCategoryIds])

  function toggleCategory(id: string) {
    if (id === categoryId) return
    setSelectedCategoryIds(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    )
  }

  function toggleLevel(level: ReadingLevel) {
    setActiveLevels(prev =>
      prev.some(l => l.id === level.id)
        ? prev.filter(l => l.id !== level.id)
        : [...prev, level]
    )
  }

  if (loading) return (
    <main className="min-h-screen flex items-center justify-center">
      <p style={{ color: '#eddbc3', fontFamily: 'var(--font-montserrat), sans-serif' }}>Loading…</p>
    </main>
  )

  return (
    <main className="min-h-screen pb-24">
      {/* Search overlay */}
      {searchQuery && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: '72px', zIndex: 49, overflowY: 'auto', backgroundColor: 'rgba(8,4,2,0.97)', padding: '24px 16px 16px' }}>
          <div style={{ maxWidth: '576px', margin: '0 auto' }}>
            <p style={{ fontFamily: 'var(--font-cormorant), serif', color: '#f9d174', fontSize: '1.4rem', fontWeight: 600, marginBottom: '16px' }}>
              {searchLoading ? 'Searching...' : searchResults?.length === 0 ? 'No books found' : 'Results'}
            </p>
            {!searchLoading && searchResults && searchResults.length > 0 && (
              <div className="grid grid-cols-3 gap-4">
                {searchResults.map(book => (
                  <BookCard key={book.id} book={book} onPress={() => { setSearchQuery(''); router.push(`/dashboard/library/${book.id}`) }} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="max-w-xl mx-auto px-4 pt-4">

        {/* Category banner */}
        {category?.image_url && (
          <div className="mb-4 rounded-2xl overflow-hidden" style={{ marginTop: '24px' }}>
            <img src={category.image_url} alt={category.name}
              style={{ width: '100%', aspectRatio: '21/9', objectFit: 'cover', display: 'block' }} />
          </div>
        )}


        {/* Reading stage selector */}
        <div className="mb-6" style={{ marginTop: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'row', gap: '20px', justifyContent: 'center' }}>
            {readingLevels.map(level => {
              const key = level.name.toLowerCase()
              const ageMap: Record<string, string> = { hatchling: '3–5 yrs', hatchlings: '3–5 yrs', chick: '5–7 yrs', chicks: '5–7 yrs', bird: '8–10 yrs', birds: '8–10 yrs' }
              const isSelected = activeLevels.some(l => l.id === level.id)
              const color = isSelected ? '#e57451' : '#eddbc3'
              return (
                <button key={level.id} onClick={() => toggleLevel(level)}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '3px', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" style={{ flexShrink: 0, transition: 'fill 0.15s' }}
                      fill={isSelected ? '#e57451' : 'none'} stroke={color} strokeWidth="1.5">
                      <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
                    </svg>
                    <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600, fontSize: '0.9rem', letterSpacing: '0.03em', color, lineHeight: 1 }}>
                      {level.name}
                    </span>
                  </div>
                  {ageMap[key] && (
                    <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 400, fontSize: '0.75rem', color, lineHeight: 1, opacity: 0.6, paddingLeft: '22px' }}>
                      {ageMap[key]}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Category blob filter */}
        <div className="blob-row" style={{ marginBottom: '16px' }}>
          {allCategories.map(cat => {
            const blob = getCategoryBlob(cat.name)
            if (!blob) return null
            const isSelected = selectedCategoryIds.includes(cat.id)
            return (
              <button key={cat.id} onClick={() => toggleCategory(cat.id)} className="blob-btn"
                style={{
                  boxShadow: isSelected ? '0 0 0 2px #eddbc3' : 'none',
                }}>
                <img src={blob} alt={cat.name} className="blob-img" />
              </button>
            )
          })}
        </div>
        <style>{`
          .blob-row { display: flex; flex-wrap: wrap; column-gap: 20px; row-gap: 10px; justify-content: center; }
          .blob-btn { background: none; border: none; cursor: pointer; padding: 3px; border-radius: 50%; transition: box-shadow 0.15s; flex-shrink: 0; }
          .blob-img { width: 38px; height: 38px; object-fit: contain; display: block; }
          @media (max-width: 480px) {
            .blob-row { flex-wrap: nowrap; column-gap: 8px; }
            .blob-img { width: 28px; height: 28px; }
          }
        `}</style>

        {/* Showing label */}
        {selectedCategoryIds.length > 0 && (
          <p style={{
            fontFamily: 'var(--font-montserrat), sans-serif',
            fontSize: '0.75rem',
            fontWeight: 500,
            color: '#eddbc3',
            textAlign: 'center',
            marginBottom: '16px',
            letterSpacing: '0.03em',
          }}>
            Showing: {allCategories
              .filter(c => selectedCategoryIds.includes(c.id))
              .sort((a, b) => a.id === categoryId ? -1 : b.id === categoryId ? 1 : 0)
              .map(c => c.name)
              .join(' + ')}
          </p>
        )}

        {/* Sort dropdown */}
        <div className="flex items-center mb-5" style={{ marginTop: '12px' }}>
          <div style={{ position: 'relative' }}>
            <button onClick={() => setSortDropdownOpen(o => !o)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                fontFamily: 'var(--font-montserrat), sans-serif',
                fontSize: '0.85rem', fontWeight: 600, color: '#eddbc3',
                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              }}>
              {!sortTouched ? 'Sort by' : sort === 'az' ? 'A–Z' : sort === 'rated' ? 'Top Rated' : sort === 'newest' ? 'Newest' : 'Most Borrowed'}
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="7" viewBox="0 0 12 8" style={{ transition: 'transform 0.2s', transform: sortDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', flexShrink: 0 }}>
                <path d="M1 1L6 7L11 1" stroke="#eddbc3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </svg>
            </button>
            {sortDropdownOpen && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 6px)', left: 0,
                backgroundColor: 'rgba(12,6,3,0.98)',
                border: '1px solid rgba(237,219,195,0.2)',
                borderRadius: '12px', overflow: 'hidden', zIndex: 100, minWidth: '160px',
              }}>
                {([
                  { key: 'popular', label: 'Most Borrowed' },
                  { key: 'rated', label: 'Top Rated' },
                  { key: 'newest', label: 'Newest' },
                  { key: 'az', label: 'A–Z' },
                ] as const).map((option, i, arr) => (
                  <button key={option.key}
                    onClick={() => { setSort(option.key); setSortTouched(true); setSortDropdownOpen(false) }}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      padding: '10px 16px',
                      fontFamily: 'var(--font-montserrat), sans-serif',
                      fontSize: '0.85rem', fontWeight: sort === option.key ? 700 : 400,
                      color: sort === option.key ? '#e57451' : '#eddbc3',
                      background: sort === option.key ? 'rgba(229,116,81,0.1)' : 'none',
                      border: 'none',
                      borderBottom: i < arr.length - 1 ? '1px solid rgba(237,219,195,0.1)' : 'none',
                      cursor: 'pointer',
                    }}>
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Books grid */}
        <div style={{ marginTop: '12px' }} />
        {books.length > 0
          ? <div className="grid grid-cols-3 gap-4">
              {books.map(book => (
                <BookCard key={book.id} book={book} onPress={() => { sessionStorage.setItem(`categoryScrollY_${categoryId}`, String(window.scrollY)); router.push(`/dashboard/library/${book.id}`) }} />
              ))}
            </div>
          : <p style={{ color: '#eddbc3', opacity: 0.4, fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.9rem' }}>
              No books at this level yet.
            </p>
        }

      </div>

      {/* Sticky bottom bar */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50, backgroundColor: 'rgb(8,4,2)', borderTop: '1px solid rgba(237,219,195,0.12)', padding: '10px 16px', paddingBottom: 'max(18px, env(safe-area-inset-bottom))', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button onClick={() => router.push('/dashboard/library')}
          style={{ flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', background: 'none', border: 'none', cursor: 'pointer' }}>
          <img src="/Book_Stack.png" alt="Library" style={{ height: '36px', width: 'auto' }} />
          <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.6rem', letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 700, color: '#eddbc3' }}>Library</span>
        </button>
        <div style={{ flex: 1, position: 'relative' }}>
          <input type="text" placeholder={PLACEHOLDERS[phIdx]} value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            className="focus:outline-none"
            style={{ width: '100%', padding: '10px 38px 10px 16px', borderRadius: '999px', border: '1px solid rgba(237,219,195,0.25)', backgroundColor: 'rgba(237,219,195,0.1)', color: '#eddbc3', fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.88rem', boxSizing: 'border-box' }} />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#eddbc3', opacity: 0.5, cursor: 'pointer', fontSize: '0.9rem' }}>✕</button>
          )}
        </div>
        <button onClick={() => router.push('/dashboard')}
          style={{ flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', background: 'none', border: 'none', cursor: 'pointer' }}>
          <img src="/house_treehouse.png" alt="Home" style={{ height: '38px', width: 'auto' }} />
          <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.6rem', letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 700, color: '#eddbc3' }}>Home</span>
        </button>
      </div>
    </main>
  )
}

export default function CategoryPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen flex items-center justify-center">
        <p style={{ color: '#eddbc3', fontFamily: 'var(--font-montserrat), sans-serif' }}>Loading…</p>
      </main>
    }>
      <CategoryPageInner />
    </Suspense>
  )
}
