'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
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
  series: { id: string; name: string } | null
  series_number: number | null
  reading_level: { id: string; name: string } | null
  categories: { id: string; name: string; emoji: string | null; color_code: string | null }[]
}

type Review = {
  id: string
  rating: number | null
  written_review: string | null
  child: { nickname: string; avatar_url: string | null }
}

type Child = {
  id: string
  first_name: string
  nickname: string
  avatar_url: string | null
}

export default function BookDetailPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const bookId = params.id as string
  const childIdFromUrl = searchParams.get('child')

  const [book, setBook] = useState<Book | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])
  const [children, setChildren] = useState<Child[]>([])
  const [selectedChildId, setSelectedChildId] = useState<string | null>(childIdFromUrl)
  const [isAvailable, setIsAvailable] = useState(true)
  const [isWishlisted, setIsWishlisted] = useState(false)
  const [isNotifying, setIsNotifying] = useState(false)
  const [loading, setLoading] = useState(true)
  const [wishlistLoading, setWishlistLoading] = useState(false)
  const [showChildPicker, setShowChildPicker] = useState(false)
  const [isParent, setIsParent] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      // Load book with all related data
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

      // Check availability
      const { count } = await supabase
        .from('book_copies')
        .select('id', { count: 'exact', head: true })
        .eq('book_id', bookId)
        .eq('status', 'available')
      setIsAvailable((count ?? 0) > 0)

      // Load approved reviews
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
          child: r.child_profiles,
        })))
      }

      // Load children for this household
      const { data: hh } = await supabase
        .from('households')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (hh) {
        const { data: kids } = await supabase
          .from('child_profiles')
          .select('id, first_name, nickname, avatar_url')
          .eq('household_id', hh.id)
          .order('created_at')
        if (kids) {
          setChildren(kids)
          // If no child from URL, check if we came from a child profile or parent dashboard
          if (!childIdFromUrl) {
            setIsParent(true)
            if (kids.length > 0) setSelectedChildId(kids[0].id)
          }
        }
      }

      setLoading(false)
    }
    load()
  }, [bookId, childIdFromUrl, router])

  // Check wishlist status when child changes
  useEffect(() => {
    async function checkWishlist() {
      if (!selectedChildId || !bookId) return
      const { data } = await supabase
        .from('wishlists')
        .select('id')
        .eq('child_id', selectedChildId)
        .eq('book_id', bookId)
        .single()
      setIsWishlisted(!!data)
    }
    checkWishlist()
  }, [selectedChildId, bookId])

  async function toggleWishlist() {
    if (!selectedChildId) {
      setShowChildPicker(true)
      return
    }
    setWishlistLoading(true)
    if (isWishlisted) {
      await supabase.from('wishlists').delete().eq('child_id', selectedChildId).eq('book_id', bookId)
      setIsWishlisted(false)
    } else {
      await supabase.from('wishlists').insert({ child_id: selectedChildId, book_id: bookId })
      setIsWishlisted(true)
    }
    setWishlistLoading(false)
  }

  function renderStars(rating: number | null) {
    if (!rating) return null
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map(i => (
          <img key={i} src={i <= Math.round(rating) ? '/star_button_on.png' : '/star_button_off.png'}
            alt="" style={{ width: '16px', height: '16px' }} />
        ))}
        <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#eddbc3', fontSize: '0.8rem', opacity: 0.7, marginLeft: '4px' }}>
          {rating.toFixed(1)} ({book?.total_ratings_count})
        </span>
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

  const selectedChild = children.find(c => c.id === selectedChildId)

  return (
    <main className="min-h-screen pb-24" style={{ backgroundImage: 'url(/background_3.png)', backgroundSize: 'cover', backgroundPosition: 'center' }}>
      <div className="max-w-2xl mx-auto px-4 pt-8">

        {/* Top bar */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => router.back()}
            style={{ color: '#eddbc3', fontSize: '1.5rem', lineHeight: 1, background: 'none', border: 'none', cursor: 'pointer' }}>
            ‹
          </button>
          <img src="/Bonkers_Word_Logo_White1.png" alt="Bonkers Book Club" style={{ width: '120px', height: 'auto' }} />
          {/* Child selector (parent only) */}
          {isParent && children.length > 0 ? (
            <button onClick={() => setShowChildPicker(true)}
              className="flex items-center gap-2 rounded-full px-3 py-1"
              style={{ backgroundColor: 'rgba(237,219,195,0.15)', border: '1px solid rgba(237,219,195,0.3)', cursor: 'pointer' }}>
              {selectedChild?.avatar_url
                ? <img src={selectedChild.avatar_url} alt="" style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover' }} />
                : <span style={{ color: '#eddbc3', fontSize: '1rem' }}>★</span>
              }
              <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#eddbc3', fontSize: '0.75rem' }}>
                {selectedChild?.first_name ?? 'Choose child'}
              </span>
              <span style={{ color: '#eddbc3', fontSize: '0.6rem', opacity: 0.6 }}>▼</span>
            </button>
          ) : (
            <div style={{ width: '80px' }} />
          )}
        </div>

        {/* Cover image */}
        <div className="flex justify-center mb-6">
          <div className="rounded-2xl overflow-hidden shadow-2xl"
            style={{ width: '180px', height: '260px', backgroundColor: 'rgba(237,219,195,0.1)', flexShrink: 0 }}>
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
        <div className="flex justify-center mb-5">
          {renderStars(book.average_rating)}
        </div>

        {/* Badges — reading level + age */}
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

        {/* Action buttons */}
        <div className="flex flex-col gap-3 mb-8">
          {/* Wishlist button */}
          <div style={{ position: 'relative', height: '60px' }}>
            <button onClick={toggleWishlist} disabled={wishlistLoading}
              className="border-none bg-transparent flex items-center justify-center w-full"
              style={{ position: 'absolute', inset: 0, backgroundImage: isWishlisted ? 'url(/orange_box.png)' : 'url(/blue_box.png)', backgroundSize: '100% 100%', backgroundRepeat: 'no-repeat', cursor: 'pointer', opacity: wishlistLoading ? 0.6 : 1 }}>
              <span style={{ fontFamily: 'var(--font-amatic)', fontSize: '1.6rem', fontWeight: 700, letterSpacing: '0.04em', color: '#eddbc3', marginBottom: '6px' }}>
                {isWishlisted ? '★ On Wishlist' : '☆ Add to Wishlist'}
              </span>
            </button>
          </div>

          {/* Notify me (if unavailable) */}
          {!isAvailable && (
            <div style={{ position: 'relative', height: '60px' }}>
              <button onClick={() => setIsNotifying(n => !n)}
                className="border-none bg-transparent flex items-center justify-center w-full"
                style={{ position: 'absolute', inset: 0, backgroundImage: isNotifying ? 'url(/orange_box.png)' : 'url(/blue_box.png)', backgroundSize: '100% 100%', backgroundRepeat: 'no-repeat', cursor: 'pointer' }}>
                <span style={{ fontFamily: 'var(--font-amatic)', fontSize: '1.6rem', fontWeight: 700, letterSpacing: '0.04em', color: '#eddbc3', marginBottom: '6px' }}>
                  {isNotifying ? '✓ We\'ll let you know!' : 'Notify me when available'}
                </span>
              </button>
            </div>
          )}
        </div>

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
                        <div className="flex gap-0.5 mt-0.5">
                          {[1, 2, 3, 4, 5].map(i => (
                            <img key={i} src={i <= review.rating! ? '/star_button_on.png' : '/star_button_off.png'}
                              alt="" style={{ width: '12px', height: '12px' }} />
                          ))}
                        </div>
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
