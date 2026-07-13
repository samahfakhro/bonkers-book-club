'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Book = {
  id: string
  title: string
  author: string
  cover_image_url: string | null
  average_rating: number | null
}

type Category = {
  id: string
  name: string
  emoji: string | null
  color_code: string | null
  image_url: string | null
}

function BookCard({ book, onPress }: { book: Book; onPress: () => void }) {
  return (
    <button onClick={onPress} className="text-left flex flex-col" style={{ background: 'none', border: 'none', cursor: 'pointer', width: '100%' }}>
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

function SectionHeading({ children, seeAllHref, cormorant }: { children: React.ReactNode; seeAllHref?: string; cormorant?: boolean }) {
  const router = useRouter()
  return (
    <div className="flex items-center justify-between mb-4">
      {cormorant
        ? <p style={{ fontFamily: 'var(--font-cormorant), serif', color: '#f9d174', fontSize: '1.8rem', fontWeight: 600, lineHeight: 1 }}>{children}</p>
        : <p className="uppercase tracking-widest" style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#f9d174', fontSize: '1rem' }}>{children}</p>
      }
      {seeAllHref && (
        <button onClick={() => router.push(seeAllHref)}
          style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#eddbc3', fontSize: '0.8rem', opacity: 0.6, background: 'none', border: 'none', cursor: 'pointer' }}>
          See all →
        </button>
      )}
    </div>
  )
}

function HorizontalScroll({ books, onBook }: { books: Book[]; onBook: (id: string) => void }) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
      {books.map(book => (
        <div key={book.id} style={{ width: '120px', flexShrink: 0 }}>
          <BookCard book={book} onPress={() => onBook(book.id)} />
        </div>
      ))}
    </div>
  )
}

export default function LibraryPage() {
  const router = useRouter()
  const [categories, setCategories] = useState<Category[]>([])
  const [newArrivals, setNewArrivals] = useState<Book[]>([])
  const [popular, setPopular] = useState<Book[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Book[] | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const bookSelect = 'id, title, author, cover_image_url, average_rating'

      const [{ data: arrivals }, { data: pop }, { data: cats }] = await Promise.all([
        supabase.from('books').select(bookSelect).eq('is_active', true).order('created_at', { ascending: false }).limit(10),
        supabase.from('books').select(bookSelect).eq('is_active', true).order('total_ratings_count', { ascending: false }).limit(10),
        supabase.from('categories').select('id, name, emoji, color_code, image_url').order('name'),
      ])

      if (arrivals) setNewArrivals(arrivals)
      if (pop) setPopular(pop)
      if (cats) setCategories(cats)
      setLoading(false)
    }
    load()
  }, [])

  async function handleSearch(q: string) {
    setSearchQuery(q)
    if (!q.trim()) { setSearchResults(null); return }
    setSearchLoading(true)
    const { data } = await supabase
      .from('books')
      .select('id, title, author, cover_image_url, average_rating')
      .eq('is_active', true)
      .or(`title.ilike.%${q}%,author.ilike.%${q}%`)
      .limit(20)
    setSearchResults(data ?? [])
    setSearchLoading(false)
  }

  function navigateToBook(bookId: string) {
    router.push(`/dashboard/library/${bookId}`)
  }

  if (loading) return (
    <main className="min-h-screen flex items-center justify-center" style={{ backgroundImage: 'url(/background_3.png)', backgroundSize: 'cover', backgroundPosition: 'center' }}>
      <p style={{ color: '#eddbc3', fontFamily: 'var(--font-montserrat), sans-serif' }}>Loading…</p>
    </main>
  )

  return (
    <main className="min-h-screen pb-24" style={{ backgroundImage: 'url(/background_3.png)', backgroundSize: 'cover', backgroundPosition: 'center' }}>
      <div className="max-w-xl mx-auto px-4 pt-8">

        {/* Top bar */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => router.push('/dashboard')}
            style={{ color: '#eddbc3', fontSize: '1.5rem', lineHeight: 1, background: 'none', border: 'none', cursor: 'pointer' }}>
            ‹
          </button>
          <img src="/Bonkers_Word_Logo_White1.png" alt="Bonkers Book Club" style={{ width: '120px', height: 'auto' }} />
          <div style={{ width: '28px' }} />
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

        {searchResults !== null ? (
          <section className="mb-8">
            <SectionHeading>{searchLoading ? 'Searching…' : `${searchResults.length} result${searchResults.length !== 1 ? 's' : ''}`}</SectionHeading>
            {searchResults.length > 0
              ? <div className="grid grid-cols-3 gap-4">
                  {searchResults.map(book => <BookCard key={book.id} book={book} onPress={() => navigateToBook(book.id)} />)}
                </div>
              : <p style={{ color: '#eddbc3', opacity: 0.5, fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.9rem' }}>
                  No books found for "{searchQuery}"
                </p>
            }
          </section>
        ) : (
          <>
            {newArrivals.length > 0 && (
              <section className="mb-8">
                <SectionHeading seeAllHref="/dashboard/library/all?sort=new">New Arrivals</SectionHeading>
                <HorizontalScroll books={newArrivals} onBook={navigateToBook} />
              </section>
            )}

            {popular.length > 0 && (
              <section className="mb-8">
                <SectionHeading seeAllHref="/dashboard/library/all?sort=popular">Most Loved by Bonkers Kids</SectionHeading>
                <HorizontalScroll books={popular} onBook={navigateToBook} />
              </section>
            )}

            {categories.length > 0 && (
              <section className="mb-8">
                <SectionHeading cormorant>Browse by Category</SectionHeading>
                <div className="grid grid-cols-3 gap-3">
                  {categories.map(cat => (
                    <button key={cat.id}
                      onClick={() => router.push(`/dashboard/library/category/${cat.id}`)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                      {cat.image_url
                        ? <img src={cat.image_url} alt={cat.name} style={{ width: '100%', height: 'auto', display: 'block', borderRadius: '12px' }} />
                        : <div style={{ width: '100%', aspectRatio: '2/3', borderRadius: '12px', backgroundColor: cat.color_code ? `${cat.color_code}33` : 'rgba(229,116,81,0.15)' }} />
                      }
                    </button>
                  ))}
                  <button
                    onClick={() => router.push('/dashboard/library/all')}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                    <div style={{ width: '100%', aspectRatio: '2/3', borderRadius: '12px', backgroundColor: 'rgba(237,219,195,0.12)' }} />
                  </button>
                </div>
              </section>
            )}

            {newArrivals.length === 0 && popular.length === 0 && categories.length === 0 && (
              <div className="flex flex-col items-center justify-center mt-20 gap-4">
                <p style={{ fontFamily: 'var(--font-cormorant), serif', color: '#eddbc3', fontSize: '2rem', fontWeight: 700, textAlign: 'center' }}>
                  Books coming soon!
                </p>
                <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#eddbc3', opacity: 0.6, fontSize: '0.9rem', textAlign: 'center' }}>
                  We're stocking the shelves. Check back shortly.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}
