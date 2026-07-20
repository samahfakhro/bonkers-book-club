'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Child = {
  id: string
  name: string
  nickname: string | null
  avatar_url: string | null
  book_slot_allocation: number
}

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
  const searchParams = useSearchParams()
  const isSurprise = searchParams.get('surprise') === 'true'
  const bookId = params.id as string

  const [book, setBook] = useState<Book | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)

  // Child selector
  const [children, setChildren] = useState<Child[]>([])
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null)
  const [parentId, setParentId] = useState<string | null>(null)

  // Book availability
  const [isAvailable, setIsAvailable] = useState(false)
  const [slotsUsed, setSlotsUsed] = useState(0)

  // Per-child state
  const [isWishlisted, setIsWishlisted] = useState(false)
  const [wishlistLoading, setWishlistLoading] = useState(false)
  const [alreadyRead, setAlreadyRead] = useState(false)
  const [isNotifying, setIsNotifying] = useState(false)
  const [notifyLoading, setNotifyLoading] = useState(false)
  const [addedToSwap, setAddedToSwap] = useState(false)
  const [showSlotsPopup, setShowSlotsPopup] = useState(false)

  // Surprise overlay
  const [showSurpriseOverlay, setShowSurpriseOverlay] = useState(isSurprise)
  const surpriseAssets = [
    '/sparklestar_yellow.png', '/sparklestar_red.png', '/sparklestar_turquoise.png',
    '/sparklestar_purple.png', '/sparklestar_orange.png', '/sparklestar_pink.png',
    '/sparklestar_blue.png', '/feather_pink.png', '/feather_purple.png', '/feather_blue.png',
  ]
  const surpriseParticles = isSurprise ? Array.from({ length: 70 }, (_, i) => {
    const src = surpriseAssets[i % surpriseAssets.length]
    const isFeather = src.startsWith('/feather')
    return {
      id: i, src,
      x: 5 + Math.random() * 90,
      y: 5 + Math.random() * 90,
      size: isFeather ? 90 + Math.floor(Math.random() * 80) : 32 + Math.floor(Math.random() * 52),
      rotation: Math.random() * 360,
    }
  }) : []

  useEffect(() => {
    if (isSurprise) {
      const t = setTimeout(() => setShowSurpriseOverlay(false), 1200)
      return () => clearTimeout(t)
    }
  }, [isSurprise])

  // Load book + children + availability on mount
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setParentId(user.id)

      const [{ data: bookData }, { data: kids }, { count: availableCount }] = await Promise.all([
        supabase.from('books').select(`
          id, title, author, description, cover_image_url,
          age_range_min, age_range_max, average_rating, total_ratings_count,
          series_number,
          series:series_id ( id, name ),
          reading_level:reading_level_id ( id, name ),
          book_categories ( categories ( id, name, emoji, color_code ) )
        `).eq('id', bookId).single(),
        supabase.from('child_profiles')
          .select('id, name, nickname, avatar_url, book_slot_allocation')
          .eq('parent_id', user.id)
          .order('created_at'),
        supabase.from('book_copies')
          .select('id', { count: 'exact', head: true })
          .eq('book_id', bookId)
          .eq('status', 'available'),
      ])

      if (bookData) {
        setBook({
          ...bookData,
          series: (bookData.series as any) || null,
          reading_level: (bookData.reading_level as any) || null,
          categories: ((bookData.book_categories as any[]) || []).map((bc: any) => bc.categories).filter(Boolean),
        })
      }

      setIsAvailable((availableCount ?? 0) > 0)

      const childList = (kids || []) as Child[]
      setChildren(childList)
      if (childList.length > 0) setSelectedChildId(childList[0].id)

      const { data: reviewData } = await supabase
        .from('book_reviews')
        .select('id, rating, written_review, child_profiles ( nickname, avatar_url )')
        .eq('book_id', bookId)
        .eq('is_approved', true)
        .order('created_at', { ascending: false })
        .limit(10)

      if (reviewData) {
        setReviews(reviewData.map((r: any) => ({
          id: r.id, rating: r.rating, written_review: r.written_review,
          child: r.child_profiles ?? null,
        })))
      }

      setLoading(false)
    }
    load()
  }, [bookId])

  // Reload per-child state when selected child changes
  useEffect(() => {
    if (!selectedChildId || !parentId) return
    async function loadChildState() {
      const [{ data: wishlist }, { data: reviews: childReviews }] = await Promise.all([
        supabase.from('wishlists').select('id').eq('child_id', selectedChildId).eq('book_id', bookId).maybeSingle(),
        supabase.from('book_reviews').select('id').eq('child_id', selectedChildId).eq('book_id', bookId).limit(1),
      ])
      setIsWishlisted(!!wishlist)
      setAlreadyRead((childReviews?.length ?? 0) > 0)

      const { data: notif } = await supabase
        .from('book_availability_notifications')
        .select('id')
        .eq('parent_id', parentId)
        .eq('book_id', bookId)
        .eq('child_id', selectedChildId)
        .maybeSingle()
      setIsNotifying(!!notif)
      setAddedToSwap(false)
    }
    loadChildState()
  }, [selectedChildId, bookId, parentId])

  const selectedChild = children.find(c => c.id === selectedChildId)
  const slotsAvailable = (selectedChild?.book_slot_allocation ?? 0) - slotsUsed
  const childName = selectedChild?.nickname || selectedChild?.name || 'your child'

  async function toggleWishlist() {
    if (!selectedChildId || wishlistLoading) return
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

  async function handleAddToSwap() {
    if (!selectedChildId) return
    if (slotsAvailable <= 0) { setShowSlotsPopup(true); return }
    // Swap request logic to be wired up when swap flow is built
    setAddedToSwap(true)
  }

  async function toggleNotify() {
    if (!selectedChildId || !parentId || notifyLoading) return
    setNotifyLoading(true)
    if (isNotifying) {
      await supabase.from('book_availability_notifications')
        .delete()
        .eq('parent_id', parentId)
        .eq('book_id', bookId)
        .eq('child_id', selectedChildId)
      setIsNotifying(false)
    } else {
      await supabase.from('book_availability_notifications')
        .insert({ parent_id: parentId, book_id: bookId, child_id: selectedChildId })
      setIsNotifying(true)
    }
    setNotifyLoading(false)
  }

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
    <main className="min-h-screen flex items-center justify-center">
      <p style={{ color: '#eddbc3', fontFamily: 'var(--font-montserrat), sans-serif' }}>Loading…</p>
    </main>
  )

  if (!book) return (
    <main className="min-h-screen flex items-center justify-center">
      <p style={{ color: '#eddbc3', fontFamily: 'var(--font-montserrat), sans-serif' }}>Book not found.</p>
    </main>
  )

  return (
    <main className="min-h-screen pb-24">
      <div className="max-w-xl mx-auto px-4 pt-8">

        {/* Top bar */}
        <div className="flex items-center justify-between mb-5">
          <button onClick={() => router.back()}
            style={{ color: '#eddbc3', fontSize: '1.5rem', lineHeight: 1, background: 'none', border: 'none', cursor: 'pointer' }}>
            ‹
          </button>
          <img src="/Bonkers_Word_Logo_White1.png" alt="Bonkers Book Club" style={{ width: '120px', height: 'auto' }} />
          <div style={{ width: '28px' }} />
        </div>

        {/* Child selector */}
        {children.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1 mb-5" style={{ scrollbarWidth: 'none' }}>
            {children.map(child => (
              <button key={child.id} onClick={() => setSelectedChildId(child.id)}
                className="flex items-center gap-2 flex-shrink-0 rounded-full px-3 py-2"
                style={{
                  background: 'none', cursor: 'pointer',
                  border: `2px solid ${selectedChildId === child.id ? '#f9d174' : 'rgba(237,219,195,0.3)'}`,
                  backgroundColor: selectedChildId === child.id ? 'rgba(249,209,116,0.12)' : 'transparent',
                }}>
                {child.avatar_url && (
                  <img src={child.avatar_url} alt="" style={{ width: '22px', height: '22px', borderRadius: '50%', objectFit: 'cover' }} />
                )}
                <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.85rem', fontWeight: 600, color: selectedChildId === child.id ? '#f9d174' : '#eddbc3' }}>
                  {child.nickname || child.name}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Bonky picked banner */}
        {isSurprise && (
          <div className="flex items-center justify-center gap-2 rounded-2xl mb-5 px-4 py-3"
            style={{ backgroundColor: 'rgba(249,209,116,0.15)', border: '1px solid rgba(249,209,116,0.35)' }}>
            <span style={{ fontSize: '1.1rem' }}>✨</span>
            <p style={{ fontFamily: 'var(--font-amatic)', fontSize: '1.4rem', fontWeight: 700, color: '#f9d174', letterSpacing: '0.03em' }}>
              Bonky picked this one for you!
            </p>
            <span style={{ fontSize: '1.1rem' }}>✨</span>
          </div>
        )}

        {/* Cover + already read badge */}
        <div className="flex justify-center mb-6">
          <div style={{ position: 'relative', width: '180px', flexShrink: 0 }}>
            <div className="rounded-2xl overflow-hidden shadow-2xl" style={{ width: '180px', height: '260px', backgroundColor: 'rgba(237,219,195,0.1)' }}>
              {book.cover_image_url
                ? <img src={book.cover_image_url} alt={book.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <div className="w-full h-full flex items-center justify-center">
                    <span style={{ color: '#eddbc3', opacity: 0.3, fontSize: '3rem' }}>📖</span>
                  </div>
              }
            </div>
            {alreadyRead && (
              <div style={{
                position: 'absolute', bottom: '10px', left: '50%', transform: 'translateX(-50%)',
                backgroundColor: 'rgba(249,209,116,0.92)', borderRadius: '999px',
                padding: '4px 12px', whiteSpace: 'nowrap',
              }}>
                <span style={{ fontFamily: 'var(--font-amatic)', fontSize: '1rem', fontWeight: 700, color: '#1a0a00', letterSpacing: '0.03em' }}>
                  ✓ Already read!
                </span>
              </div>
            )}
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
          {book.categories.map(cat => (
            <span key={cat.id} className="rounded-full px-3 py-1 text-xs font-bold"
              style={{
                backgroundColor: cat.color_code ? `${cat.color_code}33` : 'rgba(229,116,81,0.15)',
                color: cat.color_code || '#e57451',
                border: `1px solid ${cat.color_code ? `${cat.color_code}66` : 'rgba(229,116,81,0.3)'}`,
                fontFamily: 'var(--font-montserrat), sans-serif',
              }}>
              {cat.name}
            </span>
          ))}
        </div>

        {/* Description */}
        {book.description && (
          <p className="mb-8 text-center" style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#eddbc3', fontSize: '0.95rem', lineHeight: 1.7, opacity: 0.85 }}>
            {book.description}
          </p>
        )}

        {/* Action buttons */}
        <div className="flex flex-col gap-3 mb-8">

          {/* Add to Swap — always visible */}
          <div className="relative flex items-center justify-center" style={{ width: '80%', maxWidth: '300px', margin: '0 auto' }}>
            <img src="/whiskers_left.png" alt="" style={{ position: 'absolute', left: '-15px', height: '50px', width: 'auto', zIndex: 1, pointerEvents: 'none' }} />
            <div style={{ position: 'relative', width: '100%', paddingBottom: 'calc(100% / 2.97)' }}>
              <button
                onClick={handleAddToSwap}
                disabled={!isAvailable}
                className="flex items-center justify-center border-none bg-transparent"
                style={{
                  position: 'absolute', inset: 0, width: '100%', height: '100%',
                  backgroundImage: addedToSwap ? 'url(/orange_box.png)' : 'url(/button2.png)',
                  backgroundSize: '100% 100%', backgroundRepeat: 'no-repeat',
                  cursor: isAvailable ? 'pointer' : 'not-allowed',
                  opacity: isAvailable ? 1 : 0.5,
                }}>
                <span style={{ fontFamily: 'var(--font-amatic)', fontWeight: 700, fontSize: '1.6rem', letterSpacing: '0.04em', color: '#eddbc3', marginBottom: '9px' }}>
                  {addedToSwap ? '✓ Added to swap!' : isAvailable ? 'Add to swap' : 'Not available'}
                </span>
              </button>
            </div>
            <img src="/whiskers_right.png" alt="" style={{ position: 'absolute', right: '-15px', height: '50px', width: 'auto', zIndex: 1, pointerEvents: 'none' }} />
          </div>

          {/* Notify me — only when unavailable */}
          {!isAvailable && (
            <div style={{ position: 'relative', height: '56px' }}>
              <button onClick={toggleNotify} disabled={notifyLoading}
                className="border-none bg-transparent flex items-center justify-center w-full"
                style={{ position: 'absolute', inset: 0, backgroundImage: isNotifying ? 'url(/orange_box.png)' : 'url(/blue_box.png)', backgroundSize: '100% 100%', backgroundRepeat: 'no-repeat', cursor: 'pointer' }}>
                <span style={{ fontFamily: 'var(--font-amatic)', fontSize: '1.5rem', fontWeight: 700, letterSpacing: '0.04em', color: '#eddbc3', marginBottom: '6px' }}>
                  {isNotifying ? "✓ We'll let you know!" : 'Notify me when available'}
                </span>
              </button>
            </div>
          )}

          {/* Wishlist */}
          <button onClick={toggleWishlist} disabled={wishlistLoading || !selectedChildId}
            className="flex items-center justify-center gap-2 rounded-full py-3"
            style={{
              background: 'none', cursor: 'pointer',
              border: `2px solid ${isWishlisted ? '#f9d174' : 'rgba(237,219,195,0.3)'}`,
              backgroundColor: isWishlisted ? 'rgba(249,209,116,0.12)' : 'transparent',
            }}>
            <span style={{ fontSize: '1.1rem' }}>{isWishlisted ? '♥' : '♡'}</span>
            <span style={{ fontFamily: 'var(--font-amatic)', fontSize: '1.4rem', fontWeight: 700, color: isWishlisted ? '#f9d174' : '#eddbc3', letterSpacing: '0.03em' }}>
              {isWishlisted ? 'On the wishlist!' : 'Add to wishlist'}
            </span>
          </button>
        </div>

        {/* Reviews */}
        {reviews.length > 0 && (
          <section className="mb-8">
            <p className="uppercase tracking-widest mb-4" style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#f9d174', fontSize: '0.85rem' }}>
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
                      {review.rating && <div className="mt-0.5">{renderStars(review.rating, 12)}</div>}
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

      {/* Slots full popup */}
      {showSlotsPopup && (
        <div className="fixed inset-0 flex items-center justify-center z-50 px-6"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
          onClick={() => setShowSlotsPopup(false)}>
          <div className="rounded-3xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}
            style={{ backgroundColor: '#2a1a0e', border: '2px solid rgba(249,209,116,0.4)' }}>
            <p style={{ fontFamily: 'var(--font-amatic)', fontSize: '1.8rem', fontWeight: 700, color: '#f9d174', marginBottom: '12px', lineHeight: 1.2 }}>
              Ooops, {childName}'s slots are all full! 🐦
            </p>
            <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#eddbc3', fontSize: '0.85rem', lineHeight: 1.6, marginBottom: '8px', opacity: 0.85 }}>
              To add this book you can:
            </p>
            <ul style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#eddbc3', fontSize: '0.85rem', lineHeight: 1.7, opacity: 0.85, paddingLeft: '16px', marginBottom: '20px' }}>
              <li>Remove a book from your upcoming swap list to make room for this one</li>
              <li>Upgrade your plan for more book slots</li>
            </ul>
            <div className="flex flex-col gap-2">
              <button onClick={() => { setShowSlotsPopup(false); router.push('/dashboard/swap') }}
                style={{ fontFamily: 'var(--font-amatic)', fontSize: '1.4rem', fontWeight: 700, color: '#f9d174', background: 'none', border: '2px solid rgba(249,209,116,0.4)', borderRadius: '999px', padding: '8px', cursor: 'pointer', letterSpacing: '0.03em' }}>
                Go to my swap list
              </button>
              <button onClick={() => { setShowSlotsPopup(false); router.push('/dashboard/settings/subscription') }}
                style={{ fontFamily: 'var(--font-amatic)', fontSize: '1.4rem', fontWeight: 700, color: '#eddbc3', background: 'none', border: '2px solid rgba(237,219,195,0.25)', borderRadius: '999px', padding: '8px', cursor: 'pointer', letterSpacing: '0.03em' }}>
                Upgrade my plan
              </button>
              <button onClick={() => setShowSlotsPopup(false)}
                style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.8rem', color: '#eddbc3', opacity: 0.4, background: 'none', border: 'none', cursor: 'pointer', marginTop: '4px' }}>
                Maybe later
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Surprise overlay */}
      {isSurprise && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 999, pointerEvents: 'none', overflow: 'hidden',
          opacity: showSurpriseOverlay ? 1 : 0, transition: 'opacity 0.8s ease-out',
        }}>
          {surpriseParticles.map(p => (
            <img key={p.id} src={p.src} alt=""
              style={{
                position: 'absolute', left: `${p.x}%`, top: `${p.y}%`,
                width: `${p.size}px`, height: 'auto',
                transform: `translate(-50%, -50%) rotate(${p.rotation}deg)`,
                pointerEvents: 'none',
              }}
            />
          ))}
        </div>
      )}
    </main>
  )
}
