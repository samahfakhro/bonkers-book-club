'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Book = {
  id: string
  title: string
  author: string
  description: string | null
  cover_image_url: string | null
  age_range_min: number | null
  age_range_max: number | null
  average_rating: number | null
  total_ratings_count: number
  series_number: number | null
  series: { id: string; name: string } | null
  reading_level: { id: string; name: string } | null
  categories: { id: string; name: string; emoji: string | null; color_code: string | null }[]
}

type Review = {
  id: string
  rating: number | null
  written_review: string | null
  child: { nickname: string; avatar_url: string | null } | null
}

export default function BookDetailPage() {
  const router = useRouter()
  const params = useParams()
  const bookId = params.id as string

  const [book, setBook] = useState<Book | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])
  const [isAvailable, setIsAvailable] = useState(true)
  const [isNotifying, setIsNotifying] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: bookData } = await supabase
        .from('books')
        .select(`
          id, title, author, description, cover_image_url,
          age_range_min, age_range_max, average_rating, total_ratings_count,
          series_number,
          series:series_id ( id, name ),
          reading_level:reading_level_id ( id, name ),
          book_categories ( categories ( id, name, emoji, color_code ) )
        `)
        .eq('id', bookId)
        .single()

      if (bookData) {
        setBook({
          ...bookData,
          series: (bookData.series as any) || null,
          reading_level: (bookData.reading_level as any) || null,
          categories: ((bookData.book_categories as any[]) || []).map((bc: any) => bc.categories).filter(Boolean),
        })
      }

      const { count } = await supabase
        .from('book_copies')
        .select('id', { count: 'exact', head: true })
        .eq('book_id', bookId)
        .eq('status', 'available')
      setIsAvailable((count ?? 0) > 0)

      const { data: reviewData } = await supabase
        .from('book_reviews')
        .select('id, rating, written_review, child_profiles ( nickname, avatar_url )')
        .eq('book_id', bookId)
        .eq('is_approved', true)
        .order('created_at', { ascending: false })
        .limit(10)

      if (reviewData) {
        setReviews(reviewData.map((r: any) => ({
          id: r.id,
          rating: r.rating,
          written_review: r.written_review,
          child: r.child_profiles ?? null,
        })))
      }

      setLoading(false)
    }
    load()
  }, [bookId])

  function renderStars(rating: number | null, size = 16) {
    if (!rating) return null
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map(i => (
          <img key={i} src={i <= Math.round(rating) ? '/star_button_on.png' : '/star_button_off.png'}
            alt="" style={{ width: `${size}px`, height: `${size}px` }} />
        ))}
      </div>
    )
  }

  if (loading) return (
    <main className="min-h-screen flex items-center justify-center" style={{ backgroundImage: 'url(/background_3.png)', backgroundSize: 'cover', backgroundPosition: 'center' }}>
      <p style={{ color: '#eddbc3', fontFamily: 'var(--font-montserrat), sans-serif' }}>Loading…</p>
    </main>
  )

  if (!book) return (
    <main className="min-h-screen flex items-center justify-center" style={{ backgroundImage: 'url(/background_3.png)', backgroundSize: 'cover', backgroundPosition: 'center' }}>
      <p style={{ color: '#eddbc3', fontFamily: 'var(--font-montserrat), sans-serif' }}>Book not found.</p>
    </main>
  )

  return (
    <main className="min-h-screen pb-24" style={{ backgroundImage: 'url(/background_3.png)', backgroundSize: 'cover', backgroundPosition: 'center' }}>
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

        {/* Cover */}
        <div className="flex justify-center mb-6">
          <div className="rounded-2xl overflow-hidden shadow-2xl" style={{ width: '180px', height: '260px', backgroundColor: 'rgba(237,219,195,0.1)', flexShrink: 0 }}>
            {book.cover_image_url
              ? <img src={book.cover_image_url} alt={book.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <div className="w-full h-full flex items-center justify-center">
                  <span style={{ color: '#eddbc3', opacity: 0.3, fontSize: '3rem' }}>📖</span>
                </div>
            }
          </div>
        </div>

        {/* Title + author */}
        <div className="text-center mb-3">
          <h1 style={{ fontFamily: 'var(--font-cormorant), serif', color: '#eddbc3', fontSize: '2.2rem', fontWeight: 700, lineHeight: 1.15 }}>
            {book.title}
          </h1>
          <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#eddbc3', fontSize: '0.95rem', opacity: 0.7, marginTop: '4px' }}>
            {book.author}
          </p>
          {book.series && (
            <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#f9d174', fontSize: '0.8rem', marginTop: '4px' }}>
              {book.series.name}{book.series_number ? ` · Book ${book.series_number}` : ''}
            </p>
          )}
        </div>

        {/* Rating */}
        {book.average_rating && (
          <div className="flex justify-center items-center gap-2 mb-5">
            {renderStars(book.average_rating)}
            <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#eddbc3', fontSize: '0.8rem', opacity: 0.7 }}>
              {book.average_rating.toFixed(1)} ({book.total_ratings_count})
            </span>
          </div>
        )}

        {/* Badges */}
        <div className="flex flex-wrap justify-center gap-2 mb-5">
          {book.reading_level && (
            <span className="rounded-full px-3 py-1 text-xs font-bold"
              style={{ backgroundColor: 'rgba(249,209,116,0.2)', color: '#f9d174', fontFamily: 'var(--font-montserrat), sans-serif', border: '1px solid rgba(249,209,116,0.4)' }}>
              {book.reading_level.name}
            </span>
          )}
          {(book.age_range_min || book.age_range_max) && (
            <span className="rounded-full px-3 py-1 text-xs font-bold"
              style={{ backgroundColor: 'rgba(237,219,195,0.1)', color: '#eddbc3', fontFamily: 'var(--font-montserrat), sans-serif', border: '1px solid rgba(237,219,195,0.3)' }}>
              {book.age_range_min}–{book.age_range_max} yrs
            </span>
          )}
        </div>

        {/* Categories */}
        {book.categories.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2 mb-6">
            {book.categories.map(cat => (
              <span key={cat.id} className="rounded-full px-3 py-1 text-xs font-bold"
                style={{
                  backgroundColor: cat.color_code ? `${cat.color_code}33` : 'rgba(229,116,81,0.15)',
                  color: cat.color_code || '#e57451',
                  border: `1px solid ${cat.color_code ? `${cat.color_code}66` : 'rgba(229,116,81,0.3)'}`,
                  fontFamily: 'var(--font-montserrat), sans-serif',
                }}>
                {cat.emoji && `${cat.emoji} `}{cat.name}
              </span>
            ))}
          </div>
        )}

        {/* Description */}
        {book.description && (
          <p className="mb-6 text-center" style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#eddbc3', fontSize: '0.95rem', lineHeight: 1.7, opacity: 0.85 }}>
            {book.description}
          </p>
        )}

        {/* Notify me if unavailable */}
        {!isAvailable && (
          <div style={{ position: 'relative', height: '60px', marginBottom: '24px' }}>
            <button onClick={() => setIsNotifying(n => !n)}
              className="border-none bg-transparent flex items-center justify-center w-full"
              style={{ position: 'absolute', inset: 0, backgroundImage: isNotifying ? 'url(/orange_box.png)' : 'url(/blue_box.png)', backgroundSize: '100% 100%', backgroundRepeat: 'no-repeat', cursor: 'pointer' }}>
              <span style={{ fontFamily: 'var(--font-amatic)', fontSize: '1.6rem', fontWeight: 700, letterSpacing: '0.04em', color: '#eddbc3', marginBottom: '6px' }}>
                {isNotifying ? "✓ We'll let you know!" : 'Notify me when available'}
              </span>
            </button>
          </div>
        )}

        {/* Reviews */}
        {reviews.length > 0 && (
          <section>
            <p className="uppercase tracking-widest mb-4" style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#f9d174', fontSize: '1rem' }}>
              What kids are saying
            </p>
            <div className="flex flex-col gap-3">
              {reviews.map(review => (
                <div key={review.id} className="rounded-2xl p-4" style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '2px solid rgba(237,219,195,0.15)' }}>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ width: '32px', height: '32px', backgroundColor: 'rgba(237,219,195,0.15)', border: '1px solid rgba(237,219,195,0.3)' }}>
                      {review.child?.avatar_url
                        ? <img src={review.child.avatar_url} alt="" style={{ width: '30px', height: '30px', borderRadius: '50%', objectFit: 'cover' }} />
                        : <span style={{ color: '#eddbc3', fontSize: '0.9rem' }}>★</span>
                      }
                    </div>
                    <div>
                      <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#eddbc3', fontSize: '0.8rem', fontWeight: 600 }}>
                        @{review.child?.nickname}
                      </p>
                      {review.rating && (
                        <div className="mt-0.5">{renderStars(review.rating, 12)}</div>
                      )}
                    </div>
                  </div>
                  {review.written_review && (
                    <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#eddbc3', fontSize: '0.9rem', opacity: 0.85, lineHeight: 1.6 }}>
                      "{review.written_review}"
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

      </div>
    </main>
  )
}
