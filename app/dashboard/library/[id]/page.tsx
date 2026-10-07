'use client'

import { useState, useEffect, useRef, Fragment } from 'react'
import { useRouter, useParams, useSearchParams, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Child = {
  id: string
  name: string
  nickname: string | null
  avatar_url: string | null
  avatar_id: string | null
  book_slot_allocation: number
}

type Book = {
  id: string
  title: string
  author: string
  description: string | null
  cover_image_url: string | null
  average_rating: number | null
  total_ratings_count: number
  series_number: number | null
  series_id: string | null
  series: { id: string; name: string; series_number: number | null; parent_series_id: string | null; parent: { id: string; name: string } | null } | null
  reading_level: { id: string; name: string } | null
  categories: { id: string; name: string; review_label?: string | null }[]
  age_min: number | null
  age_max: number | null
  page_count: number | null
  book_type: string | null
}

type Review = {
  id: string
  rating: number | null
  written_review: string | null
  child: { nickname: string; avatar_url: string | null } | null
}

type ShelfBook = {
  id: string
  title: string
  author: string
  cover_image_url: string | null
  series_number?: number | null
}

const AVATARS = [
  { id: '1', emoji: '🦊', bg: '#e8703a' }, { id: '2', emoji: '🐼', bg: '#5a8a5a' },
  { id: '3', emoji: '🦁', bg: '#c9853a' }, { id: '4', emoji: '🐨', bg: '#7a9eae' },
  { id: '5', emoji: '🦋', bg: '#9b6fb5' }, { id: '6', emoji: '🐸', bg: '#5a9a5a' },
  { id: '7', emoji: '🦄', bg: '#c06080' }, { id: '8', emoji: '🐙', bg: '#5a7ab5' },
]

const PARENT_AVATARS = [
  { id: 'lion', emoji: '🦁', bg: '#FCD34D' }, { id: 'elephant', emoji: '🐘', bg: '#93C5FD' },
  { id: 'fox', emoji: '🦊', bg: '#FB923C' }, { id: 'owl', emoji: '🦉', bg: '#A78BFA' },
  { id: 'bear', emoji: '🐻', bg: '#86EFAC' }, { id: 'bunny', emoji: '🐰', bg: '#F9A8D4' },
  { id: 'tiger', emoji: '🐯', bg: '#FDE68A' }, { id: 'penguin', emoji: '🐧', bg: '#BAE6FD' },
]

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

function CategoryBlob({ cat, size = 40, labelSize = '0.5rem', showLabel = true, onClick }: { cat: { id: string; name: string }; size?: number; labelSize?: string; showLabel?: boolean; onClick?: () => void }) {
  const blob = getCategoryBlob(cat.name)
  if (!blob) return null
  const n = cat.name.toLowerCase()
  const shortName = n.startsWith('heartwarming') ? 'Heart' : n.startsWith('amazing') ? 'Adventure' : n.startsWith('magical') ? 'Magic' : cat.name.split(' ')[0]
  return (
    <button onClick={onClick} style={{ background: 'none', border: 'none', cursor: onClick ? 'pointer' : 'default', padding: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: showLabel ? '8px' : 0, width: `${size + 14}px` }}>
      <div style={{ display: 'flex', position: 'relative', alignItems: 'center', justifyContent: 'center' }}>
        <img src={blob} alt={cat.name} style={{ width: `${size}px`, height: `${size}px`, objectFit: 'contain', display: 'block', flexShrink: 0 }} />
        {n.includes('adventure') && <img src="/symbol_rocket.png" alt="" style={{ position: 'absolute', inset: 0, width: '60%', height: '60%', objectFit: 'contain', pointerEvents: 'none', margin: 'auto' }} />}
        {(n.includes('spooky') || n.includes('scary')) && <img src="/symbol_spooky1.png" alt="" style={{ position: 'absolute', inset: 0, width: '60%', height: '60%', objectFit: 'contain', pointerEvents: 'none', margin: 'auto', filter: 'brightness(0)' }} />}
        {(n.includes('hero') || n.includes('legend')) && <img src="/symbol_hero.png" alt="" style={{ position: 'absolute', inset: 0, width: '60%', height: '60%', objectFit: 'contain', pointerEvents: 'none', margin: 'auto', filter: 'brightness(0)' }} />}
        {(n.includes('mystery') || n.includes('mischief')) && <img src="/symbol_mystery.png" alt="" style={{ position: 'absolute', inset: 0, width: '52%', height: '52%', objectFit: 'contain', pointerEvents: 'none', margin: 'auto', filter: 'brightness(0)' }} />}
        {(n.includes('true') || n.includes('bonkers')) && <img src="/symbol_true.png" alt="" style={{ position: 'absolute', inset: 0, width: '48%', height: '48%', objectFit: 'contain', pointerEvents: 'none', margin: 'auto', filter: 'brightness(0)' }} />}
        {n.includes('laugh') && <img src="/symbol_laugh.png" alt="" style={{ position: 'absolute', inset: 0, width: '52%', height: '52%', objectFit: 'contain', pointerEvents: 'none', margin: 'auto', filter: 'brightness(0)' }} />}
        {n.includes('weird') && <img src="/symbol_weird.png" alt="" style={{ position: 'absolute', inset: 0, width: '53%', height: '53%', objectFit: 'contain', pointerEvents: 'none', margin: 'auto', filter: 'brightness(0)' }} />}
        {n.includes('heart') && <img src="/symbol_heart.png" alt="" style={{ position: 'absolute', inset: 0, width: '45%', height: '45%', objectFit: 'contain', pointerEvents: 'none', margin: 'auto', filter: 'brightness(0)' }} />}
        {(n.includes('magic') || n.includes('mayhem')) && <img src="/symbol_magichat.png" alt="" style={{ position: 'absolute', inset: 0, width: '75%', height: '75%', objectFit: 'contain', pointerEvents: 'none', margin: 'auto', filter: 'brightness(0)' }} />}
      </div>
      {showLabel && <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: labelSize, fontWeight: 700, color: '#1a2f51', letterSpacing: '0.06em', textTransform: 'uppercase', textAlign: 'center', lineHeight: 1 }}>{shortName}</span>}
    </button>
  )
}

export default function BookDetailPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const isSurprise = searchParams.get('surprise') === 'true'
  const childIdParam = searchParams.get('childId')
  const bookId = params.id as string
  const pathname = usePathname()
  const isChildMode = !!childIdParam

  const [book, setBook] = useState<Book | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])
  const [defaultAvatarUrl, setDefaultAvatarUrl] = useState<string | null>(null)
  const [expandedReviews, setExpandedReviews] = useState<Set<string>>(new Set())
  const titleRef = useRef<HTMLHeadingElement>(null)
  const reviewScrollRef = useRef<HTMLDivElement>(null)
  const [showReviewArrow, setShowReviewArrow] = useState(false)
  const [seriesBooks, setSeriesBooks] = useState<ShelfBook[]>([])
  const [readSeriesBookIds, setReadSeriesBookIds] = useState<Set<string>>(new Set())
  const [moreLikeThis, setMoreLikeThis] = useState<ShelfBook[]>([])
  const [loading, setLoading] = useState(true)

  const [children, setChildren] = useState<Child[]>([])
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null)
  const [parentId, setParentId] = useState<string | null>(null)
  const [parentName, setParentName] = useState<string>('')
  const [parentAvatarId, setParentAvatarId] = useState<string | null>(null)
  const [headerInfo, setHeaderInfo] = useState<{ name: string; avatarId: string | null } | null>(null)
  const [householdId, setHouseholdId] = useState<string | null>(null)
  const [swapRequestId, setSwapRequestId] = useState<string | null>(null)
  const [deliveryMax, setDeliveryMax] = useState(4)
  const [addedBooks, setAddedBooks] = useState<Map<string, string>>(new Map())
  const [addedBookObjects, setAddedBookObjects] = useState<Map<string, ShelfBook>>(new Map())

  const [isAvailable, setIsAvailable] = useState(false)
  const [slotsUsed, setSlotsUsed] = useState(0)

  const [wishlistedChildIds, setWishlistedChildIds] = useState<Set<string>>(new Set())
  const [wishlistLoading, setWishlistLoading] = useState(false)
  const [alreadyRead, setAlreadyRead] = useState(false)
  const [isNotifying, setIsNotifying] = useState(false)
  const [notifyLoading, setNotifyLoading] = useState(false)
  const [swapChildId, setSwapChildId] = useState<string | null>(null)
  const [swapDropdownOpen, setSwapDropdownOpen] = useState(false)
  const [showSlotsPopup, setShowSlotsPopup] = useState(false)

  const [toast, setToast] = useState<string | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [basketOpen, setBasketOpen] = useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [parentLoaded, setParentLoaded] = useState(false)
  const [parentPinHash, setParentPinHash] = useState<string | null>(null)
  const [pinPromptTarget, setPinPromptTarget] = useState<string | null>(null)
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState(false)
  const pinInputRef = useRef<HTMLInputElement | null>(null)

  function showToast(message: string) {
    setToast(message)
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToast(null), 2500)
  }

  const [showSurpriseOverlay, setShowSurpriseOverlay] = useState(isSurprise)
  const surpriseAssets = [
    '/sparklestar_yellow.png', '/sparklestar_red.png', '/sparklestar_turquoise.png',
    '/sparklestar_purple.png', '/sparklestar_orange.png', '/sparklestar_pink.png',
    '/sparklestar_blue.png', '/feather_pink.png', '/feather_purple.png', '/feather_blue.png',
  ]
  const surpriseParticles = isSurprise ? Array.from({ length: 70 }, (_, i) => {
    const src = surpriseAssets[i % surpriseAssets.length]
    const isFeather = src.startsWith('/feather')
    return { id: i, src, x: 5 + Math.random() * 90, y: 5 + Math.random() * 90, size: isFeather ? 90 + Math.floor(Math.random() * 80) : 32 + Math.floor(Math.random() * 52), rotation: Math.random() * 360 }
  }) : []

  useEffect(() => {
    if (isSurprise) {
      const t = setTimeout(() => setShowSurpriseOverlay(false), 1200)
      return () => clearTimeout(t)
    }
  }, [isSurprise])

  useEffect(() => {
    if (!childIdParam) return
    supabase.from('child_profiles').select('id, name, nickname, avatar_id').eq('id', childIdParam).single().then(({ data }) => {
      if (data) setHeaderInfo({ name: (data as any).nickname || (data as any).name, avatarId: (data as any).avatar_id ?? null })
    })
  }, [childIdParam])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setParentId(user.id)

      const { data: household } = await supabase.from('households').select('*').eq('user_id', user.id).single()
      if (household) {
        setHouseholdId(household.id)
        setParentName((household as any).first_name ?? '')
        setParentAvatarId((household as any).avatar_id ?? null)
        setParentPinHash((household as any).parent_pin_hash ?? null)
        setParentLoaded(true)
      }

      const [{ data: bookData }, { data: kids }, { count: availableCount }, { data: bookCatIds }, { data: draftReq }] = await Promise.all([
        supabase.from('books').select(`
          id, title, author, description, cover_image_url,
          average_rating, total_ratings_count,
          series_number, series_id,
          age_min, age_max, page_count, book_type,
          series:series_id ( id, name, series_number, parent_series_id, parent:parent_series_id ( id, name ) ),
          reading_level:reading_level_id ( id, name )
        `).eq('id', bookId).single(),
        household
          ? supabase.from('child_profiles').select('id, name, nickname, avatar_url, avatar_id, book_slot_allocation').eq('household_id', household.id).order('created_at')
          : Promise.resolve({ data: [] }),
        supabase.from('book_copies').select('id', { count: 'exact', head: true }).eq('book_id', bookId).eq('status', 'available'),
        supabase.from('book_categories').select('category_id').eq('book_id', bookId),
        household ? supabase.from('swap_requests').select('id, child_id').eq('household_id', household.id).in('status', ['draft', 'child_confirmed']) : Promise.resolve({ data: null }),
      ])

      let bookCategories: { id: string; name: string; review_label?: string | null }[] = []
      if (bookCatIds && bookCatIds.length > 0) {
        const { data: catsData } = await supabase.from('categories').select('id, name, review_label').in('id', bookCatIds.map((bc: any) => bc.category_id))
        bookCategories = catsData || []
      }

      if (bookData) {
        const seriesId = (bookData as any).series_id || null
        let seriesData = (bookData.series as any) || null
        if (seriesId && !seriesData) {
          const res = await fetch(`/api/series?id=${seriesId}`)
          const json = await res.json()
          seriesData = json.data || null
        }
        setBook({
          ...bookData,
          series_id: seriesId,
          series: seriesData,
          reading_level: (bookData.reading_level as any) || null,
          categories: bookCategories,
          age_min: (bookData as any).age_min ?? null,
          age_max: (bookData as any).age_max ?? null,
          page_count: (bookData as any).page_count ?? null,
          book_type: (bookData as any).book_type ?? null,
        })
      }

      setIsAvailable((availableCount ?? 0) > 0)

      const childList = (kids || []) as Child[]
      setChildren(childList)
      const preSelected = childIdParam ? childList.find(c => c.id === childIdParam) : null
      if (preSelected) setSelectedChildId(preSelected.id)
      else if (childList.length > 0) setSelectedChildId(childList[0].id)

      // Load wishlists for all children
      if (childList.length > 0) {
        const childIds = childList.map(c => c.id)
        const { data: wlData } = await supabase.from('wishlists').select('child_id').in('child_id', childIds).eq('book_id', bookId)
        setWishlistedChildIds(new Set((wlData || []).map((r: any) => r.child_id)))
      }

      if (!childIdParam && household) {
        const pName = (household as any).first_name ?? ''
        const pAvatar = (household as any).avatar_id ?? null
        setHeaderInfo({ name: pName, avatarId: pAvatar })
      }

      if (household) {
        const [{ data: subData }, { data: loanData }] = await Promise.all([
          supabase.from('subscriptions').select('subscription_plans(books_per_swap)').eq('household_id', household.id).single(),
          supabase.from('loans').select('id, return_requested').eq('household_id', household.id).eq('status', 'active'),
        ])
        const booksPerSwap: number = (subData as any)?.subscription_plans?.books_per_swap ?? 4
        const booksKept = (loanData || []).filter((l: any) => !l.return_requested).length
        setDeliveryMax(Math.max(1, booksPerSwap - booksKept))
      }

      const allReqs = draftReq as any[] | null
      if (allReqs && allReqs.length > 0) {
        const childReq = childIdParam ? allReqs.find((r: any) => r.child_id === childIdParam) : allReqs[0]
        if (childReq) setSwapRequestId(childReq.id)
        const reqIds = allReqs.map((r: any) => r.id)
        const { data: allItems } = await supabase.from('swap_request_items')
          .select('book_id, child_id, books(id, title, author, cover_image_url, series_number)')
          .in('swap_request_id', reqIds)
        if (allItems) {
          const addedMap = new Map<string, string>()
          const addedObjMap = new Map<string, ShelfBook>()
          for (const item of allItems as any[]) {
            addedMap.set(item.book_id, item.child_id || '')
            if (item.books) addedObjMap.set(item.book_id, item.books as ShelfBook)
          }
          setAddedBooks(addedMap)
          setAddedBookObjects(addedObjMap)
          const existingItem = allItems.find((i: any) => i.book_id === bookId)
          if (existingItem) setSwapChildId((existingItem as any).child_id)
        }
      }

      const { data: reviewData } = await supabase
        .from('book_reviews').select('id, star_rating, review_text, child_profiles ( nickname, avatars ( image_url ) )')
        .eq('book_id', bookId).order('created_at', { ascending: false }).limit(10)

      if (reviewData) {
        setReviews(reviewData.map((r: any) => ({ id: r.id, rating: r.star_rating, written_review: r.review_text, child: r.child_profiles ? { nickname: r.child_profiles.nickname, avatar_url: r.child_profiles.avatars?.image_url ?? null } : null })))
      }

      const { data: defaultAvatar } = await supabase.from('avatars').select('image_url').eq('is_default', true).limit(1).single()
      if (defaultAvatar) setDefaultAvatarUrl(defaultAvatar.image_url)

      // Fetch series books (all books in the same series including current)
      const seriesId = (bookData as any)?.series_id
      if (seriesId) {
        const { data: sb } = await supabase.from('books')
          .select('id, title, author, cover_image_url, series_number')
          .eq('series_id', seriesId).eq('is_active', true).order('series_number')
        setSeriesBooks((sb || []).filter((b: any) => b.id !== bookId))

        // Fetch which series books the child has read
        if (childIdParam) {
          const allSeriesIds = (sb || []).map((b: any) => b.id)
          if (allSeriesIds.length > 0) {
            const { data: readLoans } = await supabase.from('loans')
              .select('book_copies(book_id)')
              .eq('child_id', childIdParam)
              .eq('status', 'returned')
            const readIds = new Set<string>((readLoans || []).map((l: any) => l.book_copies?.book_id).filter(Boolean))
            setReadSeriesBookIds(readIds)
          }
        }
      }

      // Fetch more like this — scored by book_type + category overlap + age range
      {
        const catIds = bookCategories.map(c => c.id)
        const currentType = (bookData as any).book_type as string | null
        const currentAgeMin = (bookData as any).age_min ?? 0
        const currentAgeMax = (bookData as any).age_max ?? 99

        // Pool: books sharing at least one category, plus books with same book_type
        const [catResult, typeResult] = await Promise.all([
          catIds.length > 0
            ? supabase.from('book_categories').select('book_id').in('category_id', catIds).neq('book_id', bookId)
            : Promise.resolve({ data: [] }),
          currentType
            ? supabase.from('books').select('id').eq('book_type', currentType).neq('id', bookId).eq('is_active', true)
            : Promise.resolve({ data: [] }),
        ])

        const catCountMap = new Map<string, number>()
        for (const row of (catResult.data || []) as any[]) {
          catCountMap.set(row.book_id, (catCountMap.get(row.book_id) || 0) + 1)
        }
        const poolIds = [...new Set([
          ...catCountMap.keys(),
          ...((typeResult.data || []) as any[]).map((r: any) => r.id),
        ])]

        if (poolIds.length > 0) {
          const { data: candidates } = await supabase.from('books')
            .select('id, title, author, cover_image_url, book_type, age_min, age_max, average_rating, total_ratings_count')
            .in('id', poolIds).eq('is_active', true)

          if (candidates) {
            const scored = (candidates as any[]).map(b => {
              let score = 0
              // Same book type — strong
              if (currentType && b.book_type === currentType) score += 40
              // Shared categories — strong (15 per overlap)
              score += (catCountMap.get(b.id) || 0) * 15
              // Age range overlap — strong
              const bMin = b.age_min ?? 0
              const bMax = b.age_max ?? 99
              const overlapMin = Math.max(currentAgeMin, bMin)
              const overlapMax = Math.min(currentAgeMax, bMax)
              if (overlapMax >= overlapMin) {
                const overlapSpan = overlapMax - overlapMin
                const currentSpan = Math.max(1, currentAgeMax - currentAgeMin)
                score += Math.round((overlapSpan / currentSpan) * 20)
              }
              // Rating — light tie-breaker
              score += (b.average_rating || 0) * 2
              return { b, score }
            })
            const ordered = scored
              .sort((a, b) => b.score - a.score)
              .slice(0, 12)
              .map(({ b }) => b)
            setMoreLikeThis(ordered)
          }
        }
      }

      setLoading(false)
    }
    load()
  }, [bookId])

  useEffect(() => {
    if (!selectedChildId || !parentId) return
    async function loadChildState() {
      const { data: childReviews } = await supabase.from('book_reviews').select('id').eq('child_id', selectedChildId).eq('book_id', bookId).limit(1)
      setAlreadyRead((childReviews?.length ?? 0) > 0)
      const { data: notif } = await supabase.from('book_availability_notifications').select('id').eq('user_id', parentId).eq('book_id', bookId).maybeSingle()
      setIsNotifying(!!notif)
      setSwapChildId(null)
      setSwapDropdownOpen(false)
    }
    loadChildState()
  }, [selectedChildId, bookId, parentId])

  const selectedChild = children.find(c => c.id === selectedChildId)
  const slotsAvailable = (selectedChild?.book_slot_allocation ?? 0) - slotsUsed

  useEffect(() => {
    const el = reviewScrollRef.current
    if (!el || reviews.length === 0) return
    setShowReviewArrow(el.scrollWidth > el.clientWidth + 8)
  }, [reviews])

  useEffect(() => {
    const el = titleRef.current
    if (!el || !book) return
    const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize)
    const maxRem = window.innerWidth >= 768 ? 2.25 : 1.875
    let sizeRem = maxRem
    el.style.fontSize = `${sizeRem}rem`
    while (el.scrollHeight > sizeRem * rootFontSize * 1.1 * 4 + 2 && sizeRem > 0.75) {
      sizeRem = Math.round((sizeRem - 0.05) * 100) / 100
      el.style.fontSize = `${sizeRem}rem`
    }
  }, [book])

  const headerAvatar = isChildMode
    ? AVATARS.find(a => a.id === headerInfo?.avatarId)
    : PARENT_AVATARS.find(a => a.id === headerInfo?.avatarId)

  async function toggleWishlist(childId: string) {
    if (!childId || wishlistLoading) return
    setWishlistLoading(true)
    const child = children.find(c => c.id === childId)
    const childName = child?.nickname || child?.name || 'their list'
    if (wishlistedChildIds.has(childId)) {
      const { error } = await supabase.from('wishlists').delete().eq('child_id', childId).eq('book_id', bookId)
      if (!error) {
        setWishlistedChildIds(prev => { const n = new Set(prev); n.delete(childId); return n })
        showToast('Removed from saved list')
      }
    } else {
      const { error } = await supabase.from('wishlists').insert({ child_id: childId, book_id: bookId })
      if (!error) {
        setWishlistedChildIds(prev => new Set(prev).add(childId))
        showToast(`Saved for ${childName}!`)
      }
    }
    setWishlistLoading(false)
  }

  function handleHeartClick() {
    if (isChildMode && childIdParam) {
      toggleWishlist(childIdParam)
    } else if (selectedChildId) {
      toggleWishlist(selectedChildId)
    } else if (children.length > 0) {
      toggleWishlist(children[0].id)
    }
  }

  function handleAddToSwap() {
    if (isChildMode && childIdParam) {
      handleSwapForChild(childIdParam)
      return
    }
    if (children.length === 0) return
    if (children.length === 1) {
      handleSwapForChild(children[0].id)
    } else {
      setSwapDropdownOpen(o => !o)
    }
  }

  async function handleSwapForChild(childId: string) {
    setSwapChildId(childId)
    setSwapDropdownOpen(false)
    if (!householdId) return
    let reqId = swapRequestId
    if (!reqId) {
      const { data: newReq, error: reqErr } = await supabase.from('swap_requests').insert({ household_id: householdId, status: 'draft', child_id: childId }).select('id').single()
      if (reqErr) { console.error('swap_request insert failed:', reqErr); return }
      if (newReq) { setSwapRequestId(newReq.id); reqId = newReq.id }
    }
    if (reqId) {
      const { error: itemErr } = await supabase.from('swap_request_items').insert({ swap_request_id: reqId, book_id: bookId, child_id: childId })
      if (itemErr && itemErr.code !== '23505') { console.error('swap_request_items insert failed:', itemErr); return }
      setAddedBooks(prev => new Map(prev).set(bookId, childId))
      if (book) setAddedBookObjects(prev => new Map(prev).set(bookId, { id: book.id, title: book.title, author: book.author, cover_image_url: book.cover_image_url }))
    }
  }

  async function handleRemoveFromSwap() {
    setSwapChildId(null)
    if (swapRequestId) {
      await supabase.from('swap_request_items').delete().eq('swap_request_id', swapRequestId).eq('book_id', bookId)
      setAddedBooks(prev => { const n = new Map(prev); n.delete(bookId); return n })
      setAddedBookObjects(prev => { const n = new Map(prev); n.delete(bookId); return n })
    }
  }

  async function toggleNotify() {
    if (!parentId || notifyLoading) return
    setNotifyLoading(true)
    if (isNotifying) {
      await supabase.from('book_availability_notifications').delete().eq('user_id', parentId).eq('book_id', bookId)
      setIsNotifying(false)
    } else {
      const { error } = await supabase.from('book_availability_notifications').insert({ user_id: parentId, book_id: bookId })
      if (!error) setIsNotifying(true)
    }
    setNotifyLoading(false)
  }

  function tryParentNav(url: string) {
    setProfileMenuOpen(false)
    if (parentPinHash) {
      setPinInput('')
      setPinError(false)
      setPinPromptTarget(url)
      setTimeout(() => pinInputRef.current?.focus(), 120)
    } else {
      router.push(url)
    }
  }

  function renderBlobRating(blobSrc: string, catName: string, rating: number, size = 18) {
    const n = catName.toLowerCase()
    const symbolSrc = n.includes('adventure') ? '/symbol_rocket.png'
      : (n.includes('spooky') || n.includes('scary')) ? '/symbol_spooky1.png'
      : (n.includes('hero') || n.includes('legend')) ? '/symbol_hero.png'
      : (n.includes('mystery') || n.includes('mischief')) ? '/symbol_mystery.png'
      : (n.includes('true') || n.includes('bonkers')) ? '/symbol_true.png'
      : n.includes('laugh') ? '/symbol_laugh.png'
      : n.includes('weird') ? '/symbol_weird.png'
      : n.includes('heart') ? '/symbol_heart.png'
      : (n.includes('magic') || n.includes('mayhem')) ? '/symbol_magichat.png'
      : null
    const symbolSize = (n.includes('magic') || n.includes('mayhem')) ? '75%' : n.includes('true') || n.includes('bonkers') ? '48%' : n.includes('heart') ? '45%' : '60%'
    return (
      <div className="review-blob-rating" style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
        {[1, 2, 3, 4, 5].map(i => {
          const filled = rating >= i
          const half = !filled && rating >= i - 0.5
          return (
            <div key={i} className="review-blob-item" style={{ width: `${size}px`, height: `${size}px`, position: 'relative', flexShrink: 0 }}>
              {/* faded base blob */}
              <img src={blobSrc} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', opacity: 0.25 }} />
              {/* filled blob with clip */}
              {(filled || half) && (
                <div style={{ position: 'absolute', inset: 0, width: half ? '50%' : '100%', overflow: 'hidden' }}>
                  <img src={blobSrc} alt="" style={{ width: `${size}px`, height: `${size}px`, objectFit: 'contain' }} />
                </div>
              )}
              {/* symbol always centred over full blob */}
              {symbolSrc && <img src={symbolSrc} alt="" style={{ position: 'absolute', inset: 0, width: symbolSize, height: symbolSize, objectFit: 'contain', margin: 'auto', filter: 'brightness(0)', opacity: filled ? 1 : half ? 0.5 : 0.15, pointerEvents: 'none' }} />}
            </div>
          )
        })}
      </div>
    )
  }

  function renderStars(rating: number | null, size = 14) {
    if (!rating) return null
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
        {[1, 2, 3, 4, 5].map(i => (
          <img key={i} src='/star_yellow.png' alt="" style={{ width: `${size}px`, height: `${size}px`, opacity: i <= Math.round(rating) ? 1 : 0.2 }} />
        ))}
      </div>
    )
  }

  function BookCard({ b, childId, showRead }: { b: ShelfBook; childId?: string | null; showRead?: boolean }) {
    const url = childId ? `/dashboard/library/${b.id}?from=child&childId=${childId}` : `/dashboard/library/${b.id}`
    const isRead = showRead && readSeriesBookIds.has(b.id)
    return (
      <button onClick={() => router.push(url)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, width: '7.5rem' }}>
        <div style={{ width: '100%', aspectRatio: '2/3', borderRadius: '12px', overflow: 'hidden', backgroundColor: 'rgba(26,47,81,0.08)', marginBottom: '10px', position: 'relative' }}>
          {b.cover_image_url ? <img src={b.cover_image_url} alt={b.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /> : null}
          {isRead && (
            <div style={{ position: 'absolute', bottom: '4px', left: '4px', display: 'flex', alignItems: 'center', gap: '3px', backgroundColor: 'rgba(8,4,2,0.82)', borderRadius: '999px', padding: '2px 6px 2px 4px', pointerEvents: 'none' }}>
              <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="#f9d174" strokeWidth="3.5"><polyline points="20 6 9 17 4 12"/></svg>
              <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.42rem', fontWeight: 700, color: '#f9d174', letterSpacing: '0.07em', textTransform: 'uppercase' }}>Read</span>
            </div>
          )}
        </div>
        <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#1a2f51', fontSize: '1.05rem', fontWeight: 700, letterSpacing: '0.03em', lineHeight: 1.3, margin: 0, textAlign: 'center', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', width: '100%' }}>{b.title}</p>
        {b.series_number != null && <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.65rem', fontWeight: 700, color: '#c48b00', letterSpacing: '0.06em', margin: '4px 0 0', textAlign: 'center', whiteSpace: 'nowrap' }}>Book {b.series_number}</p>}
      </button>
    )
  }

  if (loading) return (
    <main className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#fefaf2' }}>
      <p style={{ color: '#1a2f51', fontFamily: 'var(--font-montserrat), sans-serif' }}>Loading…</p>
    </main>
  )

  if (!book) return (
    <main className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#fefaf2' }}>
      <p style={{ color: '#1a2f51', fontFamily: 'var(--font-montserrat), sans-serif' }}>Book not found.</p>
    </main>
  )

  const navItems = isChildMode ? [
    { label: 'Home', path: `/dashboard/children/${childIdParam}`, exact: true, onClick: () => router.push(`/dashboard/children/${childIdParam}`), icon: () => <svg className="nav-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg> },
    { label: 'Library', path: '/dashboard/library', exact: false, onClick: () => router.push(`/dashboard/library?from=child&childId=${childIdParam}`), icon: () => <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg> },
  ] : [
    { label: 'Home', path: '/dashboard', exact: true, onClick: () => router.push('/dashboard'), icon: () => <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9.5z"/><polyline points="9 21 9 12 15 12 15 21"/></svg> },
    { label: 'Library', path: '/dashboard/library', exact: false, onClick: () => router.push('/dashboard/library'), icon: () => <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg> },
    { label: 'Settings', path: '/dashboard/settings', exact: false, onClick: () => router.push('/dashboard/settings'), icon: () => <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06-.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> },
    { label: 'Support', path: '/dashboard/support', exact: false, onClick: () => router.push('/dashboard/support'), icon: () => <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> },
  ]

  return (
    <main className="min-h-screen" style={{ paddingBottom: '100px', backgroundColor: '#fefaf2' }}>
      {toast && (
        <div style={{ position: 'fixed', bottom: '90px', left: '50%', transform: 'translateX(-50%)', zIndex: 200, backgroundColor: 'rgba(20,12,8,0.95)', border: '1px solid rgba(237,219,195,0.25)', borderRadius: '999px', padding: '8px 18px', fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.75rem', fontWeight: 600, color: '#eddbc3', whiteSpace: 'nowrap', pointerEvents: 'none' }}>
          {toast}
        </div>
      )}
      <style>{`
        @media (min-width: 768px) and (max-width: 1024px) {
          .book-detail-layout { gap: 32px !important; }
          .wishlist-heart { width: 28px !important; height: 28px !important; }
          .review-stats-row { width: fit-content !important; gap: 24px !important; }
          .review-stats-row > div { flex: none !important; }
          .review-section-wrapper { flex-direction: row !important; align-items: flex-start !important; gap: 48px !important; }
          .meta-in-column { display: flex !important; }
          .meta-below { display: none !important; }
          .book-cover-col { width: 28% !important; }
          .review-sparkle-star { width: 80px !important; height: 80px !important; }
          .review-cat-label { font-size: 1.2rem !important; }
          .book-detail-wide { padding-left: 44px !important; padding-right: 44px !important; }
          .book-detail-layout { padding-left: 44px !important; padding-right: 44px !important; }
        }
        @media (max-width: 767px) {
          .review-cat-rows { gap: 14px !important; }
          .review-blob-item { width: 26px !important; height: 26px !important; overflow: hidden !important; }
          .review-blob-item img { max-width: 26px !important; max-height: 26px !important; }
          .review-card { width: 155px !important; }
        }
      `}</style>

      {/* ── Header ── */}
      <div style={{ position: 'sticky', top: 0, zIndex: 40, backgroundColor: '#fefaf2', padding: '16px 20px 10px', paddingTop: 'max(16px, env(safe-area-inset-top))' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div style={{ lineHeight: 1 }}>
            <p style={{ fontFamily: 'var(--font-amatic)', fontWeight: 700, fontSize: '3rem', color: '#1a2f51', letterSpacing: '0.04em', margin: 0 }}>BONKERS</p>
            <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600, fontSize: '0.5rem', color: '#1a2f51', letterSpacing: '0.18em', textTransform: 'uppercase', margin: '2px 0 0' }}>THE CHILDREN&apos;S LIBRARY</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '36px' }}>
            {/* Basket icon */}
            {(() => {
              const count = addedBooks.size
              const MAX = deliveryMax
              return (
                <button onClick={() => setBasketOpen(o => !o)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}>
                  <svg className="basket-icon" viewBox="0 0 24 24" fill="#1a2f51" stroke="none">
                    <rect x="2" y="17" width="20" height="4" rx="1"/>
                    <rect x="4" y="11" width="16" height="4" rx="1"/>
                    <rect x="6" y="5" width="12" height="4" rx="1"/>
                  </svg>
                  <span className="basket-badge" style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 700, color: '#1a2f51', whiteSpace: 'nowrap' }}>
                    {count}/{MAX}
                  </span>
                </button>
              )
            })()}
            {/* Avatar / profile switcher */}
            {headerInfo && (
              <button onClick={() => setProfileMenuOpen(o => !o)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                <div style={{ width: '3rem', height: '3rem', borderRadius: '50%', backgroundColor: headerAvatar?.bg || 'rgba(26,47,81,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: headerAvatar ? '1.7rem' : '1.1rem', border: '2px solid rgba(26,47,81,0.15)', flexShrink: 0, fontFamily: 'var(--font-cormorant), serif', fontWeight: 700, color: '#1a2f51' }}>
                  {headerAvatar?.emoji || headerInfo.name[0]?.toUpperCase() || '?'}
                </div>
                <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600, fontSize: '0.55rem', color: '#1a2f51', letterSpacing: '0.12em', textTransform: 'uppercase', lineHeight: 1 }}>{headerInfo.name}</span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#1a2f51" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'transform 0.2s', transform: profileMenuOpen ? 'rotate(180deg)' : 'none' }}><polyline points="6 9 12 15 18 9"/></svg>
              </button>
            )}
          </div>
        </div>
      </div>


      {/* ── Top bar: Back to Library / Add to my list ── */}
      <div className="book-detail-wide" style={{ padding: '32px 20px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button onClick={() => router.push(childIdParam ? `/dashboard/library?from=child&childId=${childIdParam}` : '/dashboard/library')} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(26,47,81,0.55)', padding: 0 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.8rem', letterSpacing: '0.03em' }}>Back to Library</span>
        </button>
        <button onClick={handleHeartClick} disabled={wishlistLoading} style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'none', border: 'none', cursor: 'pointer', color: '#1a2f51', padding: 0 }}>
          <svg className="wishlist-heart" width="18" height="18" viewBox="0 0 24 24" fill={wishlistedChildIds.has(isChildMode ? childIdParam! : (selectedChildId || '')) ? '#e05c5c' : 'none'} stroke={wishlistedChildIds.has(isChildMode ? childIdParam! : (selectedChildId || '')) ? '#e05c5c' : 'currentColor'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
        </button>
      </div>

      {/* ── Surprise banner ── */}
      {isSurprise && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', borderRadius: '16px', margin: '0 16px 16px', padding: '10px 16px', backgroundColor: 'rgba(249,209,116,0.15)', border: '1px solid rgba(249,209,116,0.35)' }}>
          <span style={{ fontSize: '1rem' }}>✨</span>
          <p style={{ fontFamily: 'var(--font-patrick-hand)', fontSize: '1.35rem', fontWeight: 700, color: '#c48b00', letterSpacing: '0.03em', margin: 0 }}>Bonky picked this one for you!</p>
          <span style={{ fontSize: '1rem' }}>✨</span>
        </div>
      )}

      {/* ── Cover + book info: stacked on mobile, side-by-side on tablet ── */}
      <div className="book-detail-layout flex flex-row" style={{ gap: '16px', padding: '16px 16px 20px', alignItems: 'flex-start' }}>

        {/* Cover */}
        <div className="md:w-[42%] book-cover-col" style={{ width: '42%', flexShrink: 0, position: 'relative' }}>
          <div style={{ borderRadius: '12px', overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.2)', backgroundColor: 'rgba(26,47,81,0.06)' }}>
            {book.cover_image_url
              ? <img src={book.cover_image_url} alt={book.title} style={{ width: '100%', aspectRatio: '2/3', objectFit: 'cover', display: 'block' }} />
              : <div style={{ width: '100%', aspectRatio: '2/3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ color: '#1a2f51', opacity: 0.3, fontSize: '2.5rem' }}>📖</span></div>
            }
          </div>
          {alreadyRead && (
            <div style={{ position: 'absolute', bottom: '8px', left: '50%', transform: 'translateX(-50%)', backgroundColor: 'rgba(249,209,116,0.92)', borderRadius: '999px', padding: '3px 10px', whiteSpace: 'nowrap' }}>
              <span style={{ fontFamily: 'var(--font-patrick-hand)', fontSize: '0.9rem', fontWeight: 700, color: '#1a0a00', letterSpacing: '0.03em' }}>✓ Already read!</span>
            </div>
          )}
        </div>

        {/* Book info */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', paddingTop: '2px', minWidth: 0 }}>
          <h1 ref={titleRef} style={{ fontFamily: 'var(--font-cormorant), serif', fontSize: '1.875rem', color: '#1a2f51', fontWeight: 700, lineHeight: 1.1, margin: '0 0 4px', overflow: 'hidden' }}>
            {book.title}
          </h1>
          <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#1a2f51', fontSize: '0.9rem', margin: '0 0 6px' }}>
            {book.author}
          </p>
          {book.series && (() => {
            const s = book.series
            const isSubSeries = !!s.parent_series_id && !!s.parent
            const pillStyle: React.CSSProperties = { fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#c48b00', opacity: 0.85, margin: 0, lineHeight: 1.4 }
            return isSubSeries ? (
              <div style={{ marginBottom: '10px' }}>
                <button onClick={() => router.push(`/dashboard/library/series/${s.parent!.id}`)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', display: 'block' }}>
                  <p style={pillStyle}>{s.parent!.name}</p>
                  <p style={{ ...pillStyle, opacity: 0.6 }}>
                    Series {s.series_number}{s.name ? `: ${s.name}` : ''}{book.series_number ? ` · Book ${book.series_number}` : ''}
                  </p>
                </button>
              </div>
            ) : (
              <button onClick={() => router.push(`/dashboard/library/series/${s.id}`)} className="series-pill" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', marginBottom: '10px', display: 'block' }}>
                <p style={pillStyle}>{s.name} Series{book.series_number ? ` · Book ${book.series_number}` : ''}</p>
              </button>
            )
          })()}

          {/* Metadata — iPad only (inside column) */}
          {(book.age_min || book.page_count || book.book_type) && (
            <div className="meta-in-column" style={{ display: 'none', alignItems: 'center', marginTop: '10px', marginBottom: '4px' }}>
              {book.age_min && <div style={{ padding: '0 16px' }}><p style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600, fontSize: '0.72rem', color: '#1a2f51', margin: 0, whiteSpace: 'nowrap', letterSpacing: '0.04em' }}>{book.age_min}{book.age_max ? `–${book.age_max}` : '+'} years</p></div>}
              {book.age_min && (book.page_count || book.book_type) && <div style={{ width: '1.5px', height: '28px', backgroundColor: 'rgba(26,47,81,0.2)', borderRadius: '2px', flexShrink: 0 }} />}
              {book.page_count && <div style={{ padding: '0 16px' }}><p style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600, fontSize: '0.72rem', color: '#1a2f51', margin: 0, whiteSpace: 'nowrap', letterSpacing: '0.04em' }}>{book.page_count} pages</p></div>}
              {book.page_count && book.book_type && <div style={{ width: '1.5px', height: '28px', backgroundColor: 'rgba(26,47,81,0.2)', borderRadius: '2px', flexShrink: 0 }} />}
              {book.book_type && <div style={{ padding: '0 16px' }}><p style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600, fontSize: '0.72rem', color: '#1a2f51', margin: 0, whiteSpace: 'nowrap', letterSpacing: '0.04em' }}>{book.book_type}</p></div>}
            </div>
          )}

          {/* Category blobs */}
          {book.categories.length > 0 && (
            <>
              <div className="flex md:hidden flex-wrap justify-start" style={{ gap: '4px', marginTop: '6px', marginBottom: '10px' }}>
                {book.categories.filter(cat => getCategoryBlob(cat.name)).map(cat => (
                  <CategoryBlob key={cat.id} cat={cat} size={44} labelSize='0.6rem' onClick={() => router.push(`/dashboard/library/category/${cat.id}`)} />
                ))}
              </div>
              <div className="hidden md:flex flex-wrap justify-start" style={{ gap: '4px', marginTop: '14px', marginBottom: '10px' }}>
                {book.categories.filter(cat => getCategoryBlob(cat.name)).map(cat => (
                  <CategoryBlob key={cat.id} cat={cat} size={78} onClick={() => router.push(`/dashboard/library/category/${cat.id}`)} />
                ))}
              </div>
            </>
          )}

        </div>
      </div>

      {/* ── Metadata row — mobile only ── */}
      {(book.age_min || book.page_count || book.book_type) && (
        <div className="book-detail-wide meta-below flex" style={{ alignItems: 'center', padding: '0 16px', marginBottom: '20px' }}>
          {book.age_min && (
            <div style={{ padding: '0 8px' }}>
              <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600, fontSize: '0.72rem', color: '#1a2f51', margin: 0, whiteSpace: 'nowrap', letterSpacing: '0.04em' }}>
                {book.age_min}{book.age_max ? `–${book.age_max}` : '+'} years
              </p>
            </div>
          )}
          {book.age_min && (book.page_count || book.book_type) && (
            <div style={{ width: '1.5px', height: '28px', backgroundColor: 'rgba(26,47,81,0.2)', borderRadius: '2px', flexShrink: 0 }} />
          )}
          {book.page_count && (
            <div style={{ padding: '0 8px' }}>
              <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600, fontSize: '0.72rem', color: '#1a2f51', margin: 0, whiteSpace: 'nowrap', letterSpacing: '0.04em' }}>
                {book.page_count} pages
              </p>
            </div>
          )}
          {book.page_count && book.book_type && (
            <div style={{ width: '1.5px', height: '28px', backgroundColor: 'rgba(26,47,81,0.2)', borderRadius: '2px', flexShrink: 0 }} />
          )}
          {book.book_type && (
            <div style={{ padding: '0 8px' }}>
              <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600, fontSize: '0.72rem', color: '#1a2f51', margin: 0, whiteSpace: 'nowrap', letterSpacing: '0.04em' }}>{book.book_type}</p>
            </div>
          )}
        </div>
      )}

      {/* ── Description ── */}
      {book.description && (
        <p className="book-detail-wide" style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#1a2f51', fontSize: '1rem', lineHeight: 1.8, margin: '0 0 24px', padding: '0 16px' }}>
          {book.description}
        </p>
      )}

      {/* ── CTA: Add to swap / Notify me ── */}
      <div className="book-detail-wide" style={{ padding: '16px 16px 24px', position: 'relative' }}>

        {isAvailable || swapChildId ? (
          <>
            <div style={{ position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>

                {/* Swap button */}
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <img src="/spines/whiskers_left_yellow.png" alt="" style={{ height: '44px', width: 'auto', flexShrink: 0, marginRight: '8px', pointerEvents: 'none' }} />
                  <button
                    onClick={swapChildId ? handleRemoveFromSwap : handleAddToSwap}
                    style={{
                      background: swapChildId ? 'none' : '#1a2f51',
                      border: swapChildId ? '1.5px solid rgba(26,47,81,0.2)' : 'none',
                      borderRadius: '999px', cursor: 'pointer',
                      padding: '16px 28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                    }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={swapChildId ? '#4cde80' : '#fefaf2'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                      <rect x="1" y="3" width="15" height="13" rx="1"/>
                      <path d="M16 8h4l3 5v3h-7V8z"/>
                      <circle cx="5.5" cy="18.5" r="2.5"/>
                      <circle cx="18.5" cy="18.5" r="2.5"/>
                    </svg>
                    <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600, fontSize: '0.82rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: swapChildId ? '#4cde80' : '#fefaf2', whiteSpace: 'nowrap' }}>
                      {swapChildId ? "✓ Added" : '+ Add to Next Delivery'}
                    </span>
                  </button>
                  <img src="/spines/whiskers_right_yellow.png" alt="" style={{ height: '44px', width: 'auto', flexShrink: 0, marginLeft: '8px', pointerEvents: 'none' }} />
                </div>

                {/* Child selector pill — parent only */}
                {!isChildMode && children.length > 0 && (
                  <button onClick={() => setSwapDropdownOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', background: 'rgba(26,47,81,0.05)', border: '1px solid rgba(26,47,81,0.15)', borderRadius: '999px', cursor: 'pointer', flexShrink: 0 }}>
                    {selectedChild?.avatar_url && <img src={selectedChild.avatar_url} alt="" style={{ width: '22px', height: '22px', borderRadius: '50%', objectFit: 'cover' }} />}
                    <span style={{ fontFamily: 'var(--font-patrick-hand)', fontSize: '1.15rem', fontWeight: 700, color: '#1a2f51', letterSpacing: '0.03em', lineHeight: 1 }}>
                      {selectedChild?.nickname || selectedChild?.name || 'Pick child'}
                    </span>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(26,47,81,0.4)" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
                  </button>
                )}
              </div>

              {/* Child dropdown — parent only */}
              {!isChildMode && swapDropdownOpen && children.length > 1 && (
                <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 100, backgroundColor: '#fefaf2', border: '1px solid rgba(26,47,81,0.15)', borderRadius: '12px', overflow: 'hidden', minWidth: '160px', boxShadow: '0 4px 16px rgba(26,47,81,0.12)' }}>
                  <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.7rem', color: 'rgba(26,47,81,0.4)', padding: '8px 14px 4px', letterSpacing: '0.04em' }}>For which child?</p>
                  {children.map((child, i) => (
                    <button key={child.id} onClick={() => { setSelectedChildId(child.id); handleSwapForChild(child.id) }}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', borderTop: '1px solid rgba(26,47,81,0.08)' }}>
                      {child.avatar_url && <img src={child.avatar_url} alt="" style={{ width: '26px', height: '26px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />}
                      <span style={{ fontFamily: 'var(--font-patrick-hand)', fontSize: '1.35rem', fontWeight: 700, letterSpacing: '0.04em', color: '#1a2f51', lineHeight: 1 }}>{child.nickname || child.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

          </>
        ) : (
          <>
            {/* Notify me */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              {isNotifying && <img src="/spines/whiskers_left_yellow.png" alt="" style={{ height: '44px', width: 'auto', flexShrink: 0, marginRight: '8px' }} />}
              <button onClick={toggleNotify} disabled={notifyLoading}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '16px 28px', borderRadius: '999px', cursor: 'pointer', border: '1.5px solid rgba(26,47,81,0.2)', background: 'none' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill={isNotifying ? '#5a8a5a' : '#1a2f51'} stroke={isNotifying ? '#5a8a5a' : '#1a2f51'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
                <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600, fontSize: '0.82rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: isNotifying ? '#5a8a5a' : '#1a2f51', whiteSpace: 'nowrap' }}>
                  {isNotifying ? "We'll notify you" : "Notify me when it's back"}
                </span>
              </button>
              {isNotifying && <img src="/spines/whiskers_right_yellow.png" alt="" style={{ height: '44px', width: 'auto', flexShrink: 0, marginLeft: '8px' }} />}
            </div>

          </>
        )}
      </div>

      {/* ── What Bonkers kids think ── */}
      <section style={{ padding: '24px 0 28px' }}>
          <div className="book-detail-wide" style={{ display: 'flex', alignItems: 'center', padding: '0 16px', marginBottom: '14px', gap: '6px' }}>
            <h2 style={{ fontFamily: 'var(--font-amatic)', fontSize: '1.9rem', fontWeight: 700, color: '#1a2f51', margin: 0, letterSpacing: '0.02em', whiteSpace: 'nowrap' }}>
              What Bonkers kids think
            </h2>
            <img src="/spines/whiskers_right_yellow.png" alt="" style={{ height: '52px', width: 'auto', pointerEvents: 'none', flexShrink: 0 }} />
          </div>

          {/* stats + review cards wrapper */}
          <div className="book-detail-wide review-section-wrapper" style={{ display: 'flex', flexDirection: 'column', padding: '0 16px', gap: '20px' }}>

          {/* 2-column stats row */}
          <div className="review-stats-row" style={{ display: 'flex', alignItems: 'flex-start', width: 'fit-content', gap: '16px', flexShrink: 0 }}>

            {/* Col 1: overall rating */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <img src="/sparklestar_yellow.png" alt="" className="review-sparkle-star" style={{ width: '64px', height: '64px' }} />
                <span style={{ fontFamily: 'var(--font-patrick-hand)', fontSize: '2.8rem', fontWeight: 700, color: '#c48b00', lineHeight: 1 }}>
                  {reviews.length > 0 ? (() => { const avg = reviews.reduce((sum, r) => sum + (r.rating ?? 0), 0) / reviews.length; return Number.isInteger(avg) ? String(avg) : avg.toFixed(1) })() : '—'}
                </span>
              </div>
              <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.72rem', color: '#1a2f51', lineHeight: 1.3, margin: '6px 0 0', letterSpacing: '0.04em' }}>
                Based on {reviews.length} {reviews.length === 1 ? 'review' : 'reviews'}
              </p>
            </div>

            {/* Divider */}
            <div style={{ width: '1.5px', height: '70px', backgroundColor: 'rgba(26,47,81,0.15)', borderRadius: '2px', flexShrink: 0, alignSelf: 'center' }} />

            {/* Col 2: per-category ratings */}
            <div className="review-cat-rows" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '28px' }}>
              {book.categories.length > 0 ? book.categories.filter(cat => getCategoryBlob(cat.name) && cat.review_label).map(cat => (
                <div key={cat.id} className="review-category-blob" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span className="review-cat-label" style={{ fontFamily: 'var(--font-patrick-hand)', fontSize: '1rem', fontWeight: 700, color: '#1a2f51', letterSpacing: '0.08em', lineHeight: 1 }}>{cat.review_label}</span>
                    {reviews.length > 0 && (() => {
                      const blobSrc = getCategoryBlob(cat.name)
                      const avg = reviews.reduce((sum, r) => sum + (r.rating ?? 0), 0) / reviews.length
                      return blobSrc ? renderBlobRating(blobSrc, cat.name, avg, 36) : null
                    })()}
                  </div>
                </div>
              )) : (
                <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.65rem', color: 'rgba(26,47,81,0.4)', textAlign: 'center', margin: 0 }}>No categories</p>
              )}
            </div>
          </div>

          {/* Review cards — horizontal scroll strip */}
          {reviews.length > 0 && (
            <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
            <div
              ref={reviewScrollRef}
              onScroll={e => { const el = e.currentTarget; setShowReviewArrow(el.scrollLeft + el.clientWidth < el.scrollWidth - 8) }}
              style={{ overflowX: 'auto', display: 'flex', alignItems: 'flex-start', padding: '0 0 4px', scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}>
              {reviews.map((review, i) => (
                <Fragment key={review.id}>
                  {i > 0 && (
                    <div style={{ width: '1.5px', backgroundColor: 'rgba(26,47,81,0.15)', borderRadius: '2px', flexShrink: 0, alignSelf: 'stretch', margin: '0 16px' }} />
                  )}
                  <div className="review-card" style={{ flexShrink: 0, width: '220px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '64px', height: '64px', borderRadius: '50%', overflow: 'hidden', flexShrink: 0, backgroundColor: 'rgba(26,47,81,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {review.child?.avatar_url || defaultAvatarUrl
                          ? <img src={review.child?.avatar_url ?? defaultAvatarUrl!} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <span style={{ color: '#1a2f51', fontSize: '1.2rem' }}>★</span>}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        <p style={{ fontFamily: 'var(--font-patrick-hand)', color: '#1a2f51', fontSize: '1.1rem', fontWeight: 700, margin: 0, lineHeight: 1, letterSpacing: '0.04em' }}>{review.child?.nickname ?? 'Bonkers reader'}</p>
                        {review.rating && <div>{renderStars(review.rating, 13)}</div>}
                      </div>
                    </div>
                    {review.written_review && (() => {
                      const isExpanded = expandedReviews.has(review.id)
                      return (
                        <div>
                          <p
                            onClick={() => setExpandedReviews(prev => { const next = new Set(prev); isExpanded ? next.delete(review.id) : next.add(review.id); return next })}
                            style={{ fontFamily: 'var(--font-patrick-hand)', color: '#1a2f51', fontSize: '1.1rem', fontStyle: 'normal', lineHeight: 1.3, margin: 0, letterSpacing: '0.02em', cursor: 'pointer', display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: isExpanded ? 'unset' : 3, overflow: 'hidden' } as React.CSSProperties}>
                            {`"${review.written_review}"`}
                          </p>
                          {!isExpanded && review.written_review.length > 90 && (
                            <button onClick={() => setExpandedReviews(prev => { const next = new Set(prev); next.add(review.id); return next })} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.6rem', color: 'rgba(26,47,81,0.45)', letterSpacing: '0.06em', marginTop: '2px' }}>
                              read more
                            </button>
                          )}
                        </div>
                      )
                    })()}
                  </div>
                </Fragment>
              ))}
            </div>
            {showReviewArrow && (
              <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '48px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', background: 'linear-gradient(to right, transparent, rgba(254,250,242,0.9))', pointerEvents: 'none' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(26,47,81,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </div>
            )}
            </div>
          )}

          </div>{/* end review-section-wrapper */}
        </section>

      {/* ── More in this series ── */}
      {seriesBooks.length > 0 && (
        <section className="series-section" style={{ paddingBottom: '28px', marginTop: '40px' }}>
          <button onClick={() => { const sid = book.series?.parent?.id ?? book.series?.id; if (sid) router.push(`/dashboard/library/series/${sid}${childIdParam ? `?childId=${childIdParam}` : ''}`) }} className="book-detail-wide" style={{ fontFamily: 'var(--font-amatic)', fontSize: '1.9rem', fontWeight: 700, color: '#1a2f51', margin: '0 0 14px', padding: '0 16px', letterSpacing: '0.02em', display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%' }}>
            More in the {book.series?.parent?.name ?? book.series?.name ?? ''} series
            <span style={{ fontSize: '1.9rem', lineHeight: 1, position: 'relative', top: '-0.15em', color: '#c48b00' }}>→</span>
          </button>
          <div className="book-detail-wide" style={{ display: 'flex', gap: '12px', padding: '0 16px', overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: '4px' }}>
            {seriesBooks.map(b => <BookCard key={b.id} b={b} childId={childIdParam} showRead={!!childIdParam} />)}
          </div>
        </section>
      )}

      {/* ── More like this ── */}
      {moreLikeThis.length > 0 && (
        <section className="more-like-section series-section" style={{ paddingBottom: '28px' }}>
          <h2 className="book-detail-wide" style={{ fontFamily: 'var(--font-amatic)', fontSize: '1.9rem', fontWeight: 700, color: '#1a2f51', margin: '0 0 14px', padding: '0 16px', letterSpacing: '0.02em', display: 'flex', alignItems: 'center', gap: '8px' }}>
            More books like this
            <span style={{ fontSize: '1.9rem', lineHeight: 1, position: 'relative', top: '-0.15em', color: '#c48b00' }}>→</span>
          </h2>
          <div className="book-detail-wide" style={{ display: 'flex', gap: '12px', padding: '0 16px', overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: '4px' }}>
            {moreLikeThis.filter(b => !seriesBooks.some(s => s.id === b.id)).map(b => <BookCard key={b.id} b={b} childId={childIdParam} />)}
          </div>
        </section>
      )}

      {/* ── Slots full popup ── */}
      {showSlotsPopup && (
        <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '0 24px', backgroundColor: 'rgba(0,0,0,0.6)' }} onClick={() => setShowSlotsPopup(false)}>
          <div style={{ borderRadius: '24px', padding: '24px', maxWidth: '320px', width: '100%', textAlign: 'center', backgroundColor: '#2a1a0e', border: '2px solid rgba(249,209,116,0.4)' }} onClick={e => e.stopPropagation()}>
            <p style={{ fontFamily: 'var(--font-patrick-hand)', fontSize: '2rem', fontWeight: 700, color: '#f9d174', marginBottom: '16px', lineHeight: 1.2 }}>Oops! Swap nests are full! 🐦</p>
            <button onClick={() => { setShowSlotsPopup(false); router.push('/dashboard') }} style={{ fontFamily: 'var(--font-patrick-hand)', fontSize: '1.4rem', fontWeight: 700, color: '#f9d174', background: 'none', border: '2px solid rgba(249,209,116,0.4)', borderRadius: '999px', padding: '8px 24px', cursor: 'pointer', letterSpacing: '0.03em' }}>Click here to manage</button>
          </div>
        </div>
      )}

      {/* ── Bottom nav ── */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 55, backgroundColor: '#1a2f51', borderTop: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '8px 8px', paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}>
          {navItems.map((item, i) => {
            const active = item.exact ? pathname === item.path : pathname.startsWith(item.path)
            return (
              <button key={i} onClick={item.onClick}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', flex: 1, background: 'none', border: 'none', cursor: 'pointer', color: active ? '#f9d174' : '#fefaf2', opacity: 1, minWidth: '56px', padding: 0 }}>
                {item.icon()}
                <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.6rem', letterSpacing: '0.06em', fontWeight: active ? 700 : 400 }}>{item.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Basket dropdown ── */}
      {basketOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60 }} onClick={() => setBasketOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: '72px', right: '10px', width: 'min(320px, calc(100vw - 20px))', backgroundColor: '#fefaf2', borderRadius: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.45)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 10px', borderBottom: '1px solid rgba(26,47,81,0.1)' }}>
              <div>
                <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#1a2f51', margin: 0 }}>Next Delivery</p>
                <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.65rem', color: '#1a2f51', margin: '2px 0 0' }}>{addedBooks.size}/{deliveryMax} books selected</p>
              </div>
              <button onClick={() => setBasketOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#1a2f51' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div style={{ padding: '8px 0' }}>
              {Array.from({ length: deliveryMax }).map((_, i) => {
                const bkId = [...addedBooks.keys()][i]
                const bk = bkId ? addedBookObjects.get(bkId) : undefined
                return bk ? (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 16px' }}>
                    <div style={{ width: '36px', height: '50px', borderRadius: '4px', overflow: 'hidden', flexShrink: 0 }}>
                      {bk.cover_image_url
                        ? <img src={bk.cover_image_url} alt={bk.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        : <div style={{ width: '100%', height: '100%', backgroundColor: 'rgba(26,47,81,0.08)' }} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 700, fontSize: '0.78rem', color: '#1a2f51', margin: 0, lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{bk.title}</p>
                      {bk.author && <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.65rem', color: '#1a2f51', margin: '2px 0 0' }}>{bk.author}</p>}
                    </div>
                  </div>
                ) : (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 16px' }}>
                    <div style={{ width: '36px', height: '50px', borderRadius: '4px', border: '1.5px dashed rgba(26,47,81,0.3)', flexShrink: 0 }} />
                    <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.72rem', color: '#1a2f51', margin: 0 }}>Choose a book</p>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Profile switcher dropdown ── */}
      {profileMenuOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60 }} onClick={() => setProfileMenuOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: '72px', right: '10px', width: 'min(260px, calc(100vw - 20px))', backgroundColor: '#fefaf2', borderRadius: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.45)', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px 10px', borderBottom: '1px solid rgba(26,47,81,0.1)' }}>
              <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 700, fontSize: '0.65rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#1a2f51', margin: 0 }}>Switch Profile</p>
            </div>
            <div style={{ padding: '6px 0' }}>
              {children.map(child => {
                const av = AVATARS.find(a => a.id === child.avatar_id)
                const isActive = isChildMode && childIdParam === child.id
                return (
                  <button key={child.id}
                    onClick={() => { setProfileMenuOpen(false); router.push(`/dashboard/children/${child.id}`) }}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 16px', background: isActive ? 'rgba(26,47,81,0.07)' : 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: av?.bg || 'rgba(26,47,81,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: av ? '1rem' : '0.85rem', flexShrink: 0, color: '#1a2f51', fontWeight: 700 }}>
                      {av?.emoji || child.name[0]}
                    </div>
                    <p style={{ fontFamily: 'var(--font-cormorant), serif', fontWeight: 700, fontSize: '1.05rem', color: '#1a2f51', margin: 0, flex: 1 }}>{child.name}</p>
                    {isActive && <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.55rem', color: 'rgba(26,47,81,0.45)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Active</span>}
                  </button>
                )
              })}
              {isChildMode && (() => {
                const av = PARENT_AVATARS.find(a => a.id === parentAvatarId)
                return (
                  <button onClick={() => tryParentNav('/dashboard/library?from=parent')}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: av?.bg || 'rgba(26,47,81,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: av ? '1rem' : '0.9rem', flexShrink: 0, fontFamily: 'var(--font-cormorant), serif', fontWeight: 700, color: '#1a2f51' }}>
                      {av?.emoji || (parentName?.[0]?.toUpperCase() || '👤')}
                    </div>
                    <p style={{ fontFamily: 'var(--font-cormorant), serif', fontWeight: 700, fontSize: '1.05rem', color: '#1a2f51', margin: 0 }}>Parent View</p>
                  </button>
                )
              })()}
            </div>
            <div style={{ borderTop: '1px solid rgba(26,47,81,0.1)', padding: '6px 0' }}>
              <button onClick={async () => { setProfileMenuOpen(false); await supabase.auth.signOut(); router.push('/') }}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1a2f51" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.78rem', color: '#1a2f51', margin: 0, fontWeight: 600 }}>Log out</p>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Parent PIN prompt ── */}
      {pinPromptTarget !== null && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 80, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={() => { setPinPromptTarget(null); setPinInput(''); setPinError(false) }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '480px', backgroundColor: '#130d09', borderRadius: '24px 24px 0 0', padding: '32px 24px 52px', border: '1px solid rgba(237,219,195,0.12)', textAlign: 'center' }}>
            <p style={{ fontFamily: 'var(--font-cormorant), serif', fontWeight: 700, fontSize: '1.8rem', color: '#eddbc3', margin: '0 0 6px' }}>Parent PIN</p>
            <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.72rem', color: 'rgba(237,219,195,0.5)', margin: '0 0 32px', letterSpacing: '0.04em' }}>Enter your PIN to continue</p>
            <div style={{ position: 'relative', display: 'inline-flex', gap: '20px', cursor: 'text' }} onClick={() => pinInputRef.current?.focus()}>
              {[0,1,2,3].map(i => (
                <div key={i} style={{ width: '18px', height: '18px', borderRadius: '50%', border: `2px solid ${pinError ? '#e57451' : 'rgba(237,219,195,0.35)'}`, backgroundColor: pinInput.length > i ? (pinError ? '#e57451' : '#eddbc3') : 'transparent', transition: 'background-color 0.1s, border-color 0.1s' }} />
              ))}
              <input ref={pinInputRef} type="text" inputMode="numeric" value={pinInput}
                onChange={e => {
                  const v = e.target.value.replace(/\D/g, '').slice(0, 4)
                  setPinInput(v)
                  setPinError(false)
                  if (v.length === 4) {
                    if (v === parentPinHash) {
                      const dest = pinPromptTarget
                      setPinPromptTarget(null)
                      setPinInput('')
                      router.push(dest!)
                    } else {
                      setPinError(true)
                      setTimeout(() => { setPinInput(''); setPinError(false) }, 800)
                    }
                  }
                }}
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0.01, fontSize: '16px', background: 'none', border: 'none', outline: 'none' }}
                autoComplete="off" autoFocus />
            </div>
            {pinError && <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.7rem', color: '#e57451', margin: '16px 0 0', letterSpacing: '0.04em' }}>Wrong PIN — try again</p>}
            <button onClick={() => { setPinPromptTarget(null); setPinInput(''); setPinError(false) }}
              style={{ display: 'block', margin: '24px auto 0', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.7rem', color: 'rgba(237,219,195,0.35)', letterSpacing: '0.06em' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Surprise overlay ── */}
      {isSurprise && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 999, pointerEvents: 'none', overflow: 'hidden', opacity: showSurpriseOverlay ? 1 : 0, transition: 'opacity 0.8s ease-out' }}>
          {surpriseParticles.map(p => (
            <img key={p.id} src={p.src} alt="" style={{ position: 'absolute', left: `${p.x}%`, top: `${p.y}%`, width: `${p.size}px`, height: 'auto', transform: `translate(-50%, -50%) rotate(${p.rotation}deg)`, pointerEvents: 'none' }} />
          ))}
        </div>
      )}
    </main>
  )
}
