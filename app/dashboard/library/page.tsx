'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Book = {
  id: string
  title: string
  author: string
  cover_image_url: string | null
  average_rating: number | null
  age_range_min: number | null
  age_range_max: number | null
  reading_level: { name: string } | null
}

type Category = {
  id: string
  name: string
  emoji: string | null
  color_code: string | null
}

type Child = {
  id: string
  first_name: string
  nickname: string
  avatar_url: string | null
  reading_level_id: string | null
}

function BookCard({ book, childId, onPress }: { book: Book; childId: string | null; onPress: () => void }) {
  return (
    <button onClick={onPress} className="text-left flex flex-col" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
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

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="uppercase tracking-widest mb-4" style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#f9d174', fontSize: '1rem' }}>
      {children}
    </p>
  )
}

function HorizontalScroll({ books, childId, onBook }: { books: Book[]; childId: string | null; onBook: (id: string) => void }) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
      {books.map(book => (
        <div key={book.id} style={{ width: '120px', flexShrink: 0 }}>
          <BookCard book={book} childId={childId} onPress={() => onBook(book.id)} />
        </div>
      ))}
    </div>
  )
}

export default function LibraryPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const childIdFromUrl = searchParams.get('child')

  const [children, setChildren] = useState<Child[]>([])
  const [selectedChildId, setSelectedChildId] = useState<string | null>(childIdFromUrl)
  const [isParent, setIsParent] = useState(!childIdFromUrl)
  const [showChildPicker, setShowChildPicker] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [newArrivals, setNewArrivals] = useState<Book[]>([])
  const [popular, setPopular] = useState<Book[]>([])
  const [recommended, setRecommended] = useState<Book[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Book[] | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: hh } = await supabase
        .from('households')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (hh) {
        const { data: kids } = await supabase
          .from('child_profiles')
          .select('id, first_name, nickname, avatar_url, reading_level_id')
          .eq('household_id', hh.id)
          .order('created_at')
        if (kids) {
          setChildren(kids)
          if (!childIdFromUrl && kids.length > 0) {
            setSelectedChildId(kids[0].id)
            setIsParent(true)
          }
        }
      }

      const { data: cats } = await supabase
        .from('categories')
        .select('id, name, emoji, color_code')
        .order('name')
      if (cats) setCategories(cats)

      const bookSelect = 'id, title, author, cover_image_url, average_rating, age_range_min, age_range_max, reading_level:reading_level_id ( name )'

      const { data: arrivals } = await supabase
        .from('books')
        .select(bookSelect)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(10)
      if (arrivals) setNewArrivals(arrivals.map((b: any) => ({ ...b, reading_level: b.reading_level || null })))

      const { data: pop } = await supabase
        .from('books')
        .select(bookSelect)
        .eq('is_active', true)
        .order('total_ratings_count', { ascending: false })
        .limit(10)
      if (pop) setPopular(pop.map((b: any) => ({ ...b, reading_level: b.reading_level || null })))

      setLoading(false)
    }
    load()
  }, [childIdFromUrl, router])

  // Load recommendations when child changes
  useEffect(() => {
    async function loadRecommended() {
      if (!selectedChildId) return
      const child = children.find(c => c.id === selectedChildId)
      if (!child?.reading_level_id) return

      const { data } = await supabase
        .from('books')
        .select('id, title, author, cover_image_url, average_rating, age_range_min, age_range_max, reading_level:reading_level_id ( name )')
        .eq('is_active', true)
        .eq('reading_level_id', child.reading_level_id)
        .order('average_rating', { ascending: false })
        .limit(10)
      if (data) setRecommended(data.map((b: any) => ({ ...b, reading_level: b.reading_level || null })))
    }
    loadRecommended()
  }, [selectedChildId, children])

  async function handleSearch(q: string) {
    setSearchQuery(q)
    if (!q.trim()) { setSearchResults(null); return }
    setSearchLoading(true)
    const { data } = await supabase
      .from('books')
      .select('id, title, author, cover_image_url, average_rating, age_range_min, age_range_max, reading_level:reading_level_id ( name )')
      .eq('is_active', true)
      .or(`title.ilike.%${q}%,author.ilike.%${q}%`)
      .limit(20)
    setSearchResults(data ? data.map((b: any) => ({ ...b, reading_level: b.reading_level || null })) : [])
    setSearchLoading(false)
  }

  function navigateToBook(bookId: string) {
    const url = selectedChildId ? `/dashboard/library/${bookId}?child=${selectedChildId}` : `/dashboard/library/${bookId}`
    router.push(url)
  }

  const selectedChild = children.find(c => c.id === selectedChildId)

  if (loading) return (
    <main className="min-h-screen flex items-center justify-center" style={{ backgroundImage: 'url(/background_3.png)', backgroundSize: 'cover', backgroundPosition: 'center' }}>
      <p style={{ color: '#eddbc3', fontFamily: 'var(--font-montserrat), sans-serif' }}>Loading…</p>
    </main>
  )

  return (
    <main className="min-h-screen pb-24" style={{ backgroundImage: 'url(/background_3.png)', backgroundSize: 'cover', backgroundPosition: 'center' }}>
      <div className="max-w-2xl mx-auto px-4 pt-8">

        {/* Top bar */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => router.push('/dashboard')}
            style={{ color: '#eddbc3', fontSize: '1.5rem', lineHeight: 1, background: 'none', border: 'none', cursor: 'pointer' }}>
            ‹
          </button>
          <img src="/Bonkers_Word_Logo_White1.png" alt="Bonkers Book Club" style={{ width: '120px', height: 'auto' }} />
          {/* Child selector */}
          {children.length > 0 ? (
            <button onClick={() => setShowChildPicker(true)}
              className="flex items-center gap-2 rounded-full px-3 py-1"
              style={{ backgroundColor: 'rgba(237,219,195,0.15)', border: '1px solid rgba(237,219,195,0.3)', cursor: 'pointer' }}>
              {selectedChild?.avatar_url
                ? <img src={selectedChild.avatar_url} alt="" style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover' }} />
                : <span style={{ color: '#eddbc3', fontSize: '1rem' }}>★</span>
              }
              <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#eddbc3', fontSize: '0.75rem' }}>
                {selectedChild?.first_name ?? 'Choose'}
              </span>
              <span style={{ color: '#eddbc3', fontSize: '0.6rem', opacity: 0.6 }}>▼</span>
            </button>
          ) : <div style={{ width: '80px' }} />}
        </div>

        {/* Search */}
        <div className="relative mb-8">
          <input
            type="text"
            placeholder="Search books or authors…"
            value={searchQuery}
            onChange={e => handleSearch(e.target.value)}
            className="w-full rounded-2xl px-5 py-3 focus:outline-none focus:ring-2 focus:ring-amber-400"
            style={{ backgroundColor: 'rgba(237,219,195,0.12)', border: '1px solid rgba(237,219,195,0.25)', color: '#eddbc3', fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.95rem' }}
          />
          {searchQuery && (
            <button onClick={() => { setSearchQuery(''); setSearchResults(null) }}
              style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', color: '#eddbc3', opacity: 0.5, background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem' }}>
              ✕
            </button>
          )}
        </div>

        {/* Search results */}
        {searchResults !== null ? (
          <section className="mb-8">
            <SectionHeading>{searchLoading ? 'Searching…' : `${searchResults.length} result${searchResults.length !== 1 ? 's' : ''}`}</SectionHeading>
            {searchResults.length > 0 ? (
              <div className="grid grid-cols-3 gap-4">
                {searchResults.map(book => (
                  <BookCard key={book.id} book={book} childId={selectedChildId} onPress={() => navigateToBook(book.id)} />
                ))}
              </div>
            ) : (
              <p style={{ color: '#eddbc3', opacity: 0.5, fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.9rem' }}>
                No books found for "{searchQuery}"
              </p>
            )}
          </section>
        ) : (
          <>
            {/* Recommended for child */}
            {recommended.length > 0 && (
              <section className="mb-8">
                <SectionHeading>Recommended for {selectedChild?.first_name ?? 'You'}</SectionHeading>
                <HorizontalScroll books={recommended} childId={selectedChildId} onBook={navigateToBook} />
              </section>
            )}

            {/* New arrivals */}
            {newArrivals.length > 0 && (
              <section className="mb-8">
                <SectionHeading>New Arrivals</SectionHeading>
                <HorizontalScroll books={newArrivals} childId={selectedChildId} onBook={navigateToBook} />
              </section>
            )}

            {/* Popular */}
            {popular.length > 0 && (
              <section className="mb-8">
                <SectionHeading>Most Loved by Bonkers Kids</SectionHeading>
                <HorizontalScroll books={popular} childId={selectedChildId} onBook={navigateToBook} />
              </section>
            )}

            {/* Categories */}
            {categories.length > 0 && (
              <section className="mb-8">
                <SectionHeading>Browse by Category</SectionHeading>
                <div className="grid grid-cols-2 gap-3">
                  {categories.map(cat => (
                    <button key={cat.id}
                      onClick={() => router.push(`/dashboard/library/category/${cat.id}${selectedChildId ? `?child=${selectedChildId}` : ''}`)}
                      className="flex items-center gap-3 rounded-2xl px-4 py-3 text-left transition-all"
                      style={{
                        backgroundColor: cat.color_code ? `${cat.color_code}22` : 'rgba(229,116,81,0.1)',
                        border: `2px solid ${cat.color_code ? `${cat.color_code}55` : 'rgba(229,116,81,0.3)'}`,
                        cursor: 'pointer',
                      }}>
                      {cat.emoji && <span style={{ fontSize: '1.4rem' }}>{cat.emoji}</span>}
                      <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#eddbc3', fontSize: '0.85rem', fontWeight: 600 }}>
                        {cat.name}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            )}
          </>
        )}

      </div>

      {/* Child picker modal */}
      {showChildPicker && (
        <div className="fixed inset-0 flex items-end justify-center z-50" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
          onClick={() => setShowChildPicker(false)}>
          <div className="w-full max-w-2xl rounded-t-3xl p-6 pb-10" style={{ backgroundColor: '#1a1a2e' }}
            onClick={e => e.stopPropagation()}>
            <p className="uppercase tracking-widest mb-4 text-center" style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#f9d174', fontSize: '0.9rem' }}>
              Browsing for
            </p>
            <div className="flex flex-col gap-3">
              {children.map(child => (
                <button key={child.id} onClick={() => { setSelectedChildId(child.id); setIsParent(true); setShowChildPicker(false) }}
                  className="flex items-center gap-3 rounded-2xl px-4 py-3 transition-all"
                  style={{
                    backgroundColor: selectedChildId === child.id ? 'rgba(249,209,116,0.15)' : 'rgba(255,255,255,0.05)',
                    border: `2px solid ${selectedChildId === child.id ? '#f9d174' : 'rgba(237,219,195,0.2)'}`,
                    cursor: 'pointer',
                  }}>
                  <div className="rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ width: '40px', height: '40px', backgroundColor: 'rgba(237,219,195,0.15)', border: '1px solid rgba(237,219,195,0.3)' }}>
                    {child.avatar_url
                      ? <img src={child.avatar_url} alt="" style={{ width: '38px', height: '38px', borderRadius: '50%', objectFit: 'cover' }} />
                      : <span style={{ color: '#eddbc3', fontSize: '1.2rem' }}>{child.first_name[0]}</span>
                    }
                  </div>
                  <div className="text-left">
                    <p style={{ fontFamily: 'var(--font-cormorant), serif', color: '#eddbc3', fontSize: '1.2rem', fontWeight: 700 }}>{child.first_name}</p>
                    <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#eddbc3', fontSize: '0.75rem', opacity: 0.6 }}>@{child.nickname}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
