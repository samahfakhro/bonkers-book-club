'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Book = {
  id: string
  title: string
  author: string
  cover_image_url: string | null
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

export default function AllBooksPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialSort = searchParams.get('sort') || 'new'

  const [books, setBooks] = useState<Book[]>([])
  const [readingLevels, setReadingLevels] = useState<ReadingLevel[]>([])
  const [activeLevel, setActiveLevel] = useState<ReadingLevel | null>(null)
  const [sort, setSort] = useState(initialSort)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('reading_levels').select('id, name').order('display_order')
      .then(({ data }) => setReadingLevels(data || []))
  }, [])

  useEffect(() => {
    async function loadBooks() {
      setLoading(true)
      let query = supabase.from('books').select('id, title, author, cover_image_url').eq('is_active', true)
      if (activeLevel) query = query.eq('reading_level_id', activeLevel.id)
      if (sort === 'popular') query = query.order('total_ratings_count', { ascending: false })
      else if (sort === 'az') query = query.order('title')
      else query = query.order('created_at', { ascending: false })
      const { data } = await query
      setBooks(data || [])
      setLoading(false)
    }
    loadBooks()
  }, [activeLevel, sort])

  const sortLabel = sort === 'popular' ? 'Most Loved' : sort === 'az' ? 'A–Z' : 'New to Bonkers'

  return (
    <main className="min-h-screen pb-24">
      <div className="max-w-xl mx-auto px-4 pt-8">

        {/* Top bar */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => router.back()}
            style={{ color: '#eddbc3', fontSize: '1.5rem', lineHeight: 1, background: 'none', border: 'none', cursor: 'pointer' }}>
            ‹
          </button>
          <img src="/Bonkers_Word_Logo_White1.png" alt="Bonkers Book Club" style={{ width: '120px', height: 'auto' }} />
          <div style={{ width: '28px' }} />
        </div>

        <h1 style={{ fontFamily: 'var(--font-cormorant), serif', color: '#f9d174', fontSize: '2.2rem', fontWeight: 700, marginBottom: '20px' }}>
          All Books
        </h1>

        {/* Reading level filter */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#eddbc3', fontSize: '0.72rem', opacity: 0.55, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Level:
          </span>
          {readingLevels.map(level => (
            <button key={level.id}
              onClick={() => setActiveLevel(activeLevel?.id === level.id ? null : level)}
              className="rounded-full px-3 py-1"
              style={{
                border: `1px solid ${activeLevel?.id === level.id ? '#f9d174' : 'rgba(237,219,195,0.3)'}`,
                backgroundColor: activeLevel?.id === level.id ? 'rgba(249,209,116,0.18)' : 'transparent',
                color: activeLevel?.id === level.id ? '#f9d174' : 'rgba(237,219,195,0.55)',
                fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.78rem', fontWeight: 600,
                cursor: 'pointer',
              }}>
              {level.name}
            </button>
          ))}
          {activeLevel && (
            <button onClick={() => setActiveLevel(null)}
              style={{ background: 'none', border: 'none', color: 'rgba(237,219,195,0.4)', cursor: 'pointer', fontSize: '0.75rem', fontFamily: 'var(--font-montserrat), sans-serif' }}>
              Clear
            </button>
          )}
        </div>

        {/* Sort tabs */}
        <div className="flex gap-2 mb-6">
          {[{ key: 'new', label: 'New' }, { key: 'popular', label: 'Most Loved' }, { key: 'az', label: 'A–Z' }].map(s => (
            <button key={s.key} onClick={() => setSort(s.key)}
              className="rounded-full px-4 py-1"
              style={{
                border: `1px solid ${sort === s.key ? '#f9d174' : 'rgba(237,219,195,0.3)'}`,
                backgroundColor: sort === s.key ? 'rgba(249,209,116,0.18)' : 'transparent',
                color: sort === s.key ? '#f9d174' : 'rgba(237,219,195,0.55)',
                fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.78rem', fontWeight: 600,
                cursor: 'pointer',
              }}>
              {s.label}
            </button>
          ))}
        </div>

        {/* Book count */}
        {!loading && (
          <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#eddbc3', fontSize: '0.8rem', opacity: 0.5, marginBottom: '16px' }}>
            {books.length} book{books.length !== 1 ? 's' : ''}
          </p>
        )}

        {/* Books grid */}
        {loading
          ? <p style={{ color: '#eddbc3', opacity: 0.5, fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.85rem' }}>Loading…</p>
          : books.length > 0
            ? <div className="grid grid-cols-3 gap-4">
                {books.map(book => (
                  <BookCard key={book.id} book={book} onPress={() => router.push(`/dashboard/library/${book.id}`)} />
                ))}
              </div>
            : <p style={{ color: '#eddbc3', opacity: 0.4, fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.9rem' }}>
                No books found.
              </p>
        }

      </div>
    </main>
  )
}
