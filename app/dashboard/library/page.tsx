'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Book = { id: string; title: string; author: string; cover_image_url: string | null; series_number?: number | null; series_label?: string | null }
type Category = { id: string; name: string; image_url: string | null }
type ReadingLevel = { id: string; name: string }
type Child = { id: string; name: string; date_of_birth?: string | null; book_slot_allocation?: number | null; avatar_id?: string | null; avatar_image_url?: string | null }

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
type Toast = { message: string; id: number; x: number; y: number }
type Particle = { id: number; src: string; x: number; y: number; size: number; angle: number; distance: number; rotation: number }

const AGE_MAP: Record<string, string> = {
  hatchling: '3–5 yrs', hatchlings: '3–5 yrs', '3-5': '3–5 yrs',
  chick: '5–7 yrs', chicks: '5–7 yrs', '5-7': '5–7 yrs',
  bird: '8–10 yrs', birds: '8–10 yrs', '8-10': '8–10 yrs',
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

const PLACEHOLDERS = ['Looking for dinosaurs?', 'Looking for unicorns?', 'Looking for space adventures?', 'Looking for pirates?', 'Looking for football stories?', 'Looking for cats?', 'Looking for fairies?', 'Looking for mermaids?', 'Looking for bears?', 'Looking for dragons?', 'Looking for robots?', 'Looking for witches?']
const SPARKLES = ['/sparklestar_yellow.png', '/sparklestar_pink.png', '/sparklestar_turquoise.png', '/sparklestar_purple.png', '/sparklestar_blue.png']

function LibraryPageInner() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const childIdParam = searchParams.get('childId')
  const fromParam = searchParams.get('from')
  const isChildMode = fromParam === 'child' && !!childIdParam

  const [categories, setCategories] = useState<Category[]>([])
  const [readingLevels, setReadingLevels] = useState<ReadingLevel[]>([])
  const [activeLevels, setActiveLevels] = useState<ReadingLevel[]>([])
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([])
  const [books, setBooks] = useState<Book[]>([])
  const [booksLoading, setBooksLoading] = useState(false)
  const [availableBookIds, setAvailableBookIds] = useState<Set<string>>(new Set())
  const [inCirculationIds, setInCirculationIds] = useState<Set<string>>(new Set())
  const [parentId, setParentId] = useState<string | null>(null)
  const [notifyingBookIds, setNotifyingBookIds] = useState<Set<string>>(new Set())
  const [addedBooks, setAddedBooks] = useState<Map<string, string>>(new Map()) // bookId → childId
  const [addedBookObjects, setAddedBookObjects] = useState<Map<string, Book>>(new Map()) // bookId → Book
  const [wishlists, setWishlists] = useState<Map<string, string[]>>(new Map()) // bookId → childIds[]
  const [children, setChildren] = useState<Child[]>([])
  const [pendingBook, setPendingBook] = useState<Book | null>(null)
  const [pendingAction, setPendingAction] = useState<'heart' | 'basket' | null>(null)
  const [showChildGate, setShowChildGate] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [sortBy, setSortBy] = useState<'popular' | 'newest' | 'az'>('popular')
  const [sortOpen, setSortOpen] = useState(false)
  const [showAvailableOnly, setShowAvailableOnly] = useState(false)
  const [availabilityOpen, setAvailabilityOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Book[] | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const [phIdx, setPhIdx] = useState(0)
  const [toast, setToast] = useState<Toast | null>(null)
  const [particles, setParticles] = useState<Particle[]>([])
  const [deliveryMax, setDeliveryMax] = useState(4)
  const [householdId, setHouseholdId] = useState<string | null>(null)
  const [swapRequestId, setSwapRequestId] = useState<string | null>(null)
  const [requestsByChildId, setRequestsByChildId] = useState<Map<string, string>>(new Map())
  const [parentName, setParentName] = useState('')
  const [parentAvatarId, setParentAvatarId] = useState<string | null>(null)
  const [parentLoaded, setParentLoaded] = useState(false)
  const [readBookIds, setReadBookIds] = useState<Set<string>>(new Set())
  const [readByMap, setReadByMap] = useState<Map<string, string[]>>(new Map())
  const [childNotifyEnabled, setChildNotifyEnabled] = useState(true)
  const [basketOpen, setBasketOpen] = useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [parentPinHash, setParentPinHash] = useState<string | null>(null)
  const [pinPromptTarget, setPinPromptTarget] = useState<string | null>(null)
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState(false)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pinInputRef = useRef<HTMLInputElement | null>(null)
  const tapStart = useRef<{ x: number; y: number } | null>(null)

  function makeTapHandlers(action: () => void) {
    return {
      onPointerDown: (e: React.PointerEvent) => { tapStart.current = { x: e.clientX, y: e.clientY } },
      onPointerUp: (e: React.PointerEvent) => {
        if (!tapStart.current) return
        const dx = Math.abs(e.clientX - tapStart.current.x)
        const dy = Math.abs(e.clientY - tapStart.current.y)
        if (dx < 12 && dy < 12) action()
        tapStart.current = null
      },
      onClick: (e: React.MouseEvent) => e.preventDefault(),
    }
  }

  useEffect(() => {
    async function load() {
      const [{ data: cats }, { data: levels }, copiesRes] = await Promise.all([
        supabase.from('categories').select('id, name, image_url').order('display_order'),
        supabase.from('reading_levels').select('id, name').order('display_order'),
        fetch('/api/book-copies').then(r => r.json()),
      ])
      const allCopies = copiesRes.data || []
      const catList = cats || []; const levelList = levels || []
      setCategories(catList); setReadingLevels(levelList)
      const copiesList = allCopies || []
      const availableIds = new Set(copiesList.filter((c: any) => c.status === 'available').map((c: any) => c.book_id))
      const inCirculationIds = new Set(copiesList.map((c: any) => c.book_id))
      // Books not yet in circulation show as available; books with copies but none available show bell
      setAvailableBookIds(availableIds)
      setInCirculationIds(inCirculationIds)
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setParentId(user.id)
        const { data: notifs } = await supabase.from('book_availability_notifications').select('book_id').eq('user_id', user.id)
        setNotifyingBookIds(new Set((notifs || []).map((n: any) => n.book_id)))
        const { data: hh } = await supabase.from('households').select('*').eq('user_id', user.id).single()
        if (hh) {
          setParentName((hh as any).first_name ?? '')
          setParentAvatarId((hh as any).avatar_id ?? null)
          setParentPinHash((hh as any).parent_pin_hash ?? null)
          setParentLoaded(true)
          const { data: childRows } = await supabase.from('child_profiles').select('id, name, date_of_birth, book_slot_allocation, avatar_id, avatars(image_url)').eq('household_id', hh.id).order('created_at')
          const childList: Child[] = (childRows || []).map((c: any) => ({ id: c.id, name: c.name, date_of_birth: c.date_of_birth, book_slot_allocation: c.book_slot_allocation, avatar_id: c.avatar_id ?? null, avatar_image_url: (c.avatars as any)?.image_url ?? null }))
          setChildren(childList)

          // Load subscription allowance and books being kept
          setHouseholdId(hh.id)
          setChildNotifyEnabled((hh as any).child_notify_enabled ?? true)

          const [{ data: subData }, { data: loanData }, { data: allReqs }] = await Promise.all([
            supabase.from('subscriptions').select('subscription_plans(books_per_swap)').eq('household_id', hh.id).single(),
            supabase.from('loans').select('id, return_requested').eq('household_id', hh.id).eq('status', 'active'),
            supabase.from('swap_requests').select('id, child_id').eq('household_id', hh.id).in('status', ['draft', 'child_confirmed']),
          ])
          const booksPerSwap: number = (subData as any)?.subscription_plans?.books_per_swap ?? 4
          const booksKept = (loanData || []).filter((l: any) => !l.return_requested).length
          setDeliveryMax(Math.max(1, booksPerSwap - booksKept))

          if (allReqs && allReqs.length > 0) {
            // Build per-child request map and set legacy swapRequestId for child mode
            const reqMap = new Map<string, string>()
            for (const r of allReqs as any[]) { if (r.child_id) reqMap.set(r.child_id, r.id) }
            setRequestsByChildId(reqMap)
            if (childIdParam) {
              const childReq = (allReqs as any[]).find(r => r.child_id === childIdParam)
              if (childReq) setSwapRequestId(childReq.id)
            }

            // Load all items from all active requests
            const reqIds = (allReqs as any[]).map(r => r.id)
            const { data: items } = await supabase
              .from('swap_request_items')
              .select('book_id, child_id, books(id, title, author, cover_image_url, series_number)')
              .in('swap_request_id', reqIds)
            if (items) {
              const addedMap = new Map<string, string>()
              const addedObjMap = new Map<string, Book>()
              for (const item of items as any[]) {
                addedMap.set(item.book_id, item.child_id || '')
                if (item.books) addedObjMap.set(item.book_id, item.books as Book)
              }
              setAddedBooks(addedMap)
              setAddedBookObjects(addedObjMap)
            }
          }

          // Load wishlists for all children
          const childIds = childList.map(c => c.id)
          if (childIds.length > 0) {
            const { data: wl } = await supabase.from('wishlists').select('book_id, child_id').in('child_id', childIds)
            const wlMap = new Map<string, string[]>()
            for (const row of (wl || [])) {
              wlMap.set(row.book_id, [...(wlMap.get(row.book_id) || []), row.child_id])
            }
            setWishlists(wlMap)

            // Load read history (returned loans)
            const readTarget = childIdParam ? [childIdParam] : childIds
            const { data: returnedLoans } = await supabase.from('loans').select('child_id, book_copies(book_id)').in('child_id', readTarget).eq('status', 'returned')
            if (childIdParam) {
              const ids = new Set<string>((returnedLoans || []).map((l: any) => l.book_copies?.book_id).filter(Boolean))
              setReadBookIds(ids)
            } else {
              const byMap = new Map<string, string[]>()
              for (const l of (returnedLoans || []) as any[]) {
                const bid = l.book_copies?.book_id
                if (!bid) continue
                const existing = byMap.get(bid) || []
                if (!existing.includes(l.child_id)) byMap.set(bid, [...existing, l.child_id])
              }
              setReadByMap(byMap)
            }
          }

          if (childIdParam) {
            const child = childList.find(c => c.id === childIdParam)
            if (child) {
              if (child.reading_level) {
                const ml = levelList.find(l => l.name.toLowerCase() === child.reading_level!.toLowerCase())
                if (ml) setActiveLevels([ml])
              }
              if (child.interests) {
                const names = child.interests.split(',').map((s: string) => s.trim().toLowerCase())
                const mc = catList.filter(c => names.some(i => c.name.toLowerCase().includes(i) || i.includes(c.name.toLowerCase())))
                if (mc.length > 0) setSelectedCategoryIds(mc.map(c => c.id))
              }
            }
          }
        }
      }
      setLoading(false)
      const savedScroll = sessionStorage.getItem('libraryScrollY')
      if (savedScroll) setTimeout(() => { window.scrollTo(0, parseInt(savedScroll)); sessionStorage.removeItem('libraryScrollY') }, 100)
    }
    load()
  }, [childIdParam])

  useEffect(() => {
    async function loadBooks() {
      setBooksLoading(true)
      let bookIdFilter: string[] | null = null
      if (selectedCategoryIds.length > 0) {
        const { data: bc } = await supabase.from('book_categories').select('book_id').in('category_id', selectedCategoryIds)
        if (!bc || bc.length === 0) { setBooks([]); setBooksLoading(false); return }
        bookIdFilter = [...new Set(bc.map((r: any) => r.book_id))]
      }
      let query = supabase.from('books').select('id, title, author, cover_image_url, series_number, series_id').eq('is_active', true)
      if (bookIdFilter) query = query.in('id', bookIdFilter)
      if (activeLevels.length > 0) query = query.in('reading_level_id', activeLevels.map(l => l.id))
      if (sortBy === 'popular') query = query.order('total_ratings_count', { ascending: false })
      else if (sortBy === 'newest') query = query.order('created_at', { ascending: false })
      else query = query.order('title', { ascending: true })
      const { data } = await query
      const books = data || []

      // Batch-fetch series for all books that have one (bypasses RLS)
      const seriesIds = [...new Set(books.map((b: any) => b.series_id).filter(Boolean))]
      const seriesMap = new Map<string, any>()
      if (seriesIds.length > 0) {
        const res = await fetch(`/api/series?ids=${seriesIds.join(',')}`)
        const json = await res.json()
        for (const s of (json.data || [])) seriesMap.set(s.id, s)
      }

      setBooks(books.map((b: any) => {
        const s = b.series_id ? seriesMap.get(b.series_id) : null
        let label: string | null = null
        if (s && b.series_number) {
          if (s.parent_series_id && s.parent) {
            label = `S${s.series_number ?? '?'} · Book ${b.series_number}`
          } else {
            label = `Book ${b.series_number}`
          }
        }
        return { ...b, series_label: label }
      }))
      setBooksLoading(false)
    }
    loadBooks()
  }, [activeLevels, selectedCategoryIds, sortBy])

  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults(null); return }
    const t = setTimeout(async () => {
      setSearchLoading(true)
      const { data } = await supabase.from('books').select('id, title, author, cover_image_url, series_number, series:series_id(id, name, series_number, parent_series_id, parent:parent_series_id(id, name))').eq('is_active', true)
        .or(`title.ilike.%${searchQuery}%,author.ilike.%${searchQuery}%`).limit(20)
      setSearchResults((data ?? []).map((b: any) => {
        const s = b.series
        let label: string | null = null
        if (s) {
          label = s.parent_series_id && s.parent
            ? `${s.parent.name.toUpperCase()} · S${s.series_number ?? '?'} · #${b.series_number ?? '?'}`
            : `${s.name.toUpperCase()} · #${b.series_number ?? '?'}`
        }
        return { ...b, series_label: label }
      })); setSearchLoading(false)
    }, 300)
    return () => clearTimeout(t)
  }, [searchQuery])

  useEffect(() => {
    const t = setInterval(() => setPhIdx(i => (i + 1) % PLACEHOLDERS.length), 6000)
    return () => clearInterval(t)
  }, [])

  function showToast(message: string, x: number, y: number) {
    const id = Date.now()
    setToast({ message, id, x, y })
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2000)
  }

  function burstConfetti(el: HTMLElement) {
    const rect = el.getBoundingClientRect()
    const ox = ((rect.left + rect.width / 2) / window.innerWidth) * 100
    const oy = ((rect.top + rect.height / 2) / window.innerHeight) * 100
    const ps = Array.from({ length: 14 }, (_, i) => ({
      id: Date.now() + i, src: SPARKLES[i % SPARKLES.length],
      x: ox, y: oy, size: 10 + Math.floor(Math.random() * 14),
      angle: Math.random() * 360, distance: 50 + Math.random() * 100, rotation: -120 + Math.random() * 240,
    }))
    setParticles(ps)
    setTimeout(() => setParticles([]), 900)
  }

  function handleHeartClick(e: React.MouseEvent, book: Book) {
    e.stopPropagation()
    if (children.length === 0) { setShowChildGate(true); return }
    if (isChildMode) {
      const child = children.find(c => c.id === childIdParam)
      if (child) toggleWishlist(book, child, e.clientX, e.clientY)
      return
    }
    if (children.length === 1) {
      toggleWishlist(book, children[0], e.clientX, e.clientY)
    } else {
      setPendingBook(book)
      setPendingAction('heart')
    }
  }

  async function toggleWishlist(book: Book, child: Child, x = 0, y = 0) {
    const existing = wishlists.get(book.id) || []
    if (existing.includes(child.id)) {
      const { error } = await supabase.from('wishlists').delete().eq('book_id', book.id).eq('child_id', child.id)
      if (!error) {
        setWishlists(prev => {
          const n = new Map(prev)
          n.set(book.id, (n.get(book.id) || []).filter(id => id !== child.id))
          return n
        })
        showToast('Removed from list', x, y)
      }
    } else {
      const { error } = await supabase.from('wishlists').insert({ book_id: book.id, child_id: child.id })
      if (!error) {
        setWishlists(prev => {
          const n = new Map(prev)
          n.set(book.id, [...(n.get(book.id) || []), child.id])
          return n
        })
        showToast(`Added to ${child.name}'s list!`, x, y)
      }
    }
    setPendingBook(null)
    setPendingAction(null)
  }

  function handleBasketClick(e: React.MouseEvent, book: Book) {
    e.stopPropagation()
    if (children.length === 0) { setShowChildGate(true); return }
    if (addedBooks.has(book.id)) {
      const child = children.find(c => c.id === addedBooks.get(book.id))
      setAddedBooks(prev => { const n = new Map(prev); n.delete(book.id); return n })
      setAddedBookObjects(prev => { const n = new Map(prev); n.delete(book.id); return n })
      showToast(child ? `Removed from ${child.name}'s delivery` : 'Removed from next delivery', e.clientX, e.clientY)
      const removeReqId = child ? requestsByChildId.get(child.id) : swapRequestId
      if (removeReqId) supabase.from('swap_request_items').delete().eq('swap_request_id', removeReqId).eq('book_id', book.id)
      return
    }
    const preSelected = childIdParam ? children.find(c => c.id === childIdParam) : null
    if (preSelected) {
      confirmBasket(book, preSelected, e.currentTarget as HTMLElement, e.clientX, e.clientY)
    } else if (children.length > 1) {
      setPendingBook(book)
      setPendingAction('basket')
    } else if (children.length === 1) {
      confirmBasket(book, children[0], e.currentTarget as HTMLElement, e.clientX, e.clientY)
    } else {
      setAddedBooks(prev => new Map(prev).set(book.id, ''))
      setAddedBookObjects(prev => new Map(prev).set(book.id, book))
      showToast('Added to next delivery!', e.clientX, e.clientY)
    }
  }

  async function confirmBasket(book: Book, child: Child, triggerEl?: HTMLElement, x = 0, y = 0) {
    setAddedBooks(prev => new Map(prev).set(book.id, child.id))
    setAddedBookObjects(prev => new Map(prev).set(book.id, book))
    setPendingBook(null); setPendingAction(null)
    showToast(`Added for ${child.name}!`, x, y)
    if (triggerEl) burstConfetti(triggerEl)
    if (!householdId) return
    let reqId = requestsByChildId.get(child.id) ?? null
    if (!reqId) {
      const { data: newReq, error: reqErr } = await supabase.from('swap_requests').insert({ household_id: householdId, status: 'draft', child_id: child.id }).select('id').single()
      if (reqErr) { console.error('swap_request insert failed:', reqErr); return }
      if (newReq) {
        reqId = newReq.id
        setRequestsByChildId(prev => new Map(prev).set(child.id, newReq.id))
        if (childIdParam === child.id) setSwapRequestId(newReq.id)
      }
    }
    if (reqId) {
      const { error: itemErr } = await supabase.from('swap_request_items').insert({ swap_request_id: reqId, book_id: book.id, child_id: child.id })
      if (itemErr && itemErr.code !== '23505') console.error('swap_request_items insert failed:', itemErr)
    }
  }

  function navigateToBook(id: string) {
    sessionStorage.setItem('libraryScrollY', String(window.scrollY))
    router.push(`/dashboard/library/${id}${childIdParam ? `?childId=${childIdParam}` : ''}`)
  }

  async function toggleNotify(e: React.MouseEvent, bookId: string) {
    e.stopPropagation()
    if (!parentId) return
    if (notifyingBookIds.has(bookId)) {
      await supabase.from('book_availability_notifications').delete().eq('user_id', parentId).eq('book_id', bookId)
      setNotifyingBookIds(prev => { const n = new Set(prev); n.delete(bookId); return n })
      showToast("We'll stop notifying you for this one", e.clientX, e.clientY)
    } else {
      const { error } = await supabase.from('book_availability_notifications').insert({ user_id: parentId, book_id: bookId })
      if (!error) {
        setNotifyingBookIds(prev => new Set(prev).add(bookId))
        showToast("We'll notify you once it's back!", e.clientX, e.clientY)
      }
    }
  }

  const activeFilters = activeLevels.length > 0 || selectedCategoryIds.length > 0 || showAvailableOnly

  const NAV_ITEMS = isChildMode ? [
    { label: 'Home', path: `/dashboard/children/${childIdParam}`, exact: true, onClick: () => router.push(`/dashboard/children/${childIdParam}`),
      icon: () => <svg className="nav-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg> },
    { label: 'Library', path: '/dashboard/library', exact: false, onClick: () => router.push(`/dashboard/library?from=child&childId=${childIdParam}`),
      icon: () => <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg> },
  ] : [
    { label: 'Home', path: '/dashboard', exact: true, onClick: () => router.push('/dashboard'),
      icon: () => <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9.5z"/><polyline points="9 21 9 12 15 12 15 21"/></svg> },
    { label: 'Library', path: '/dashboard/library', exact: false, onClick: () => router.push('/dashboard/library'),
      icon: () => <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg> },
    { label: 'Settings', path: '/dashboard/settings', exact: false, onClick: () => router.push('/dashboard/settings'),
      icon: () => <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> },
    { label: 'Support', path: '/dashboard/support', exact: false, onClick: () => router.push('/dashboard/support'),
      icon: () => <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> },
  ]

  function ReadPill({ bookId }: { bookId: string }) {
    if (isChildMode) {
      if (!readBookIds.has(bookId)) return null
      return (
        <div style={{ position: 'absolute', bottom: '5px', left: '5px', display: 'flex', alignItems: 'center', gap: '3px', backgroundColor: 'rgba(8,4,2,0.82)', borderRadius: '999px', padding: '2px 6px 2px 4px', pointerEvents: 'none' }}>
          <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="#f9d174" strokeWidth="3.5"><polyline points="20 6 9 17 4 12"/></svg>
          <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.42rem', fontWeight: 700, color: '#f9d174', letterSpacing: '0.07em', textTransform: 'uppercase' }}>Read</span>
        </div>
      )
    }
    const readerIds = readByMap.get(bookId) || []
    if (readerIds.length === 0) return null
    const readers = readerIds.map(id => children.find(c => c.id === id)).filter(Boolean) as Child[]
    return (
      <div style={{ position: 'absolute', bottom: '5px', left: '5px', display: 'flex', alignItems: 'center', gap: '2px', backgroundColor: 'rgba(8,4,2,0.82)', borderRadius: '999px', padding: '2px 5px 2px 3px', pointerEvents: 'none' }}>
        {readers.map(child => (
          <div key={child.id} style={{ width: '14px', height: '14px', borderRadius: '50%', overflow: 'hidden', flexShrink: 0, backgroundColor: 'rgba(237,219,195,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {child.avatar_image_url
              ? <img src={child.avatar_image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ fontSize: '8px', color: '#eddbc3', fontWeight: 700 }}>{child.name[0]}</span>}
          </div>
        ))}
        <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="#f9d174" strokeWidth="3.5" style={{ marginLeft: '1px' }}><polyline points="20 6 9 17 4 12"/></svg>
      </div>
    )
  }

  function BookActions({ book, isAvailable }: { book: Book; isAvailable: boolean }) {
    const isHearted = (wishlists.get(book.id) || []).length > 0
    const isAdded = addedBooks.has(book.id)
    const isNotifying = notifyingBookIds.has(book.id)
    const reservedFor = addedBooks.get(book.id)
    const isReservedForOther = !!reservedFor && reservedFor !== childIdParam
    const showPlus = isAvailable && !isReservedForOther
    return (
      <div className="book-actions" style={{ display: 'flex', marginTop: '16px', alignItems: 'center', justifyContent: 'center' }}>
        {/* Plus / added */}
        {showPlus && (
          <button onClick={e => handleBasketClick(e, book)} aria-label="Add to next delivery"
            className="book-action-btn"
            style={{ background: 'none', borderRadius: '50%', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'border-color 0.15s' }}>
            {isAdded
              ? <svg width="1.2em" height="1.2em" viewBox="0 0 24 24" fill="none" stroke="#84a98c" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              : <svg width="1.2em" height="1.2em" viewBox="0 0 24 24" fill="none" stroke="#1a2f51" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            }
          </button>
        )}
        {(!isAvailable || isReservedForOther) && !showPlus && (
          isChildMode && !childNotifyEnabled ? (
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '1.1em', height: '1.1em' }}>
              <svg width="1.1em" height="1.1em" viewBox="0 0 24 24" fill="none" stroke="rgba(26,47,81,0.2)" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </span>
          ) : (
            <button onClick={e => toggleNotify(e, book.id)} aria-label="Notify me when available"
              className="book-action-btn"
              style={{ background: 'none', borderRadius: '50%', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'border-color 0.15s' }}>
              <svg width="1.1em" height="1.1em" viewBox="0 0 24 24" fill={isNotifying ? '#1a2f51' : 'none'} stroke="#1a2f51" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
            </button>
          )
        )}
        {/* Heart */}
        <button onClick={e => handleHeartClick(e, book)} aria-label="Save to My List"
          className="book-action-btn"
          style={{ background: 'none', borderRadius: '50%', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}>
          <svg width="1.1em" height="1.1em" viewBox="0 0 24 24" fill={isHearted ? '#e05c5c' : 'none'} stroke={isHearted ? '#e05c5c' : '#1a2f51'} strokeWidth="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
        </button>
      </div>
    )
  }

  if (loading) return (
    <main className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#fefaf2' }}>
      <p style={{ color: '#1a2f51', fontFamily: 'var(--font-montserrat), sans-serif' }}>Loading...</p>
    </main>
  )


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

  return (
    <main className="min-h-screen" style={{ paddingBottom: '120px', backgroundColor: '#fefaf2' }}>
      <style>{`
        #lib-search::placeholder { color: rgba(26,47,81,0.45); }
        @keyframes toast-in { from { opacity:0; transform:translateX(-50%) translateY(6px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }
        @keyframes burst { 0%{opacity:1;transform:translate(-50%,-50%) rotate(0deg);} 80%{opacity:1;transform:translate(calc(-50% + var(--bx)),calc(-50% + var(--by))) rotate(var(--br));} 100%{opacity:0;transform:translate(calc(-50% + var(--bx)),calc(-50% + var(--by))) rotate(var(--br));} }
        .book-grid { display: grid; column-gap: 18px; row-gap: 36px; grid-template-columns: repeat(2, 1fr); }
        @media (min-width: 540px) { .book-grid { grid-template-columns: repeat(3, 1fr); } }
        .list-cover { width: calc((min(768px,100vw) - 32px - 24px) / 3); aspect-ratio: 2/3; border-radius: 10px; overflow: hidden; background: rgba(26,47,81,0.08); flex-shrink: 0; }
        @media (min-width: 540px) { .list-cover { width: calc((min(768px,100vw) - 32px - 36px) / 4); } }
        .book-action-btn { border-color: rgba(26,47,81,0.2) !important; }
        @media (min-width: 768px) and (max-width: 1024px) { .view-toggle-icon { width: 22px !important; height: 22px !important; } }
      `}</style>

      {/* Toast */}
      {toast && (
        <div key={toast.id} style={{ position: 'fixed', left: toast.x, top: toast.y - (typeof window !== 'undefined' && window.innerWidth >= 768 ? 80 : 50), transform: 'translateX(-50%)', zIndex: 200, animation: 'toast-in 0.2s ease-out', backgroundColor: 'rgba(20,12,8,0.95)', border: '1px solid rgba(237,219,195,0.25)', borderRadius: '999px', padding: '6px 14px', fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.72rem', fontWeight: 600, color: '#eddbc3', whiteSpace: 'nowrap', pointerEvents: 'none' }}>
          {toast.message}
        </div>
      )}

      {/* Confetti burst */}
      {particles.length > 0 && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 199, pointerEvents: 'none', overflow: 'hidden' }}>
          {particles.map(p => {
            const dx = Math.round(Math.cos(p.angle * Math.PI / 180) * p.distance)
            const dy = Math.round(Math.sin(p.angle * Math.PI / 180) * p.distance)
            return <img key={p.id} src={p.src} alt="" style={{ position: 'absolute', left: `${p.x}%`, top: `${p.y}%`, width: `${p.size}px`, height: 'auto', ['--bx' as any]: `${dx}px`, ['--by' as any]: `${dy}px`, ['--br' as any]: `${p.rotation}deg`, animation: `burst 0.85s ease-out forwards` } as React.CSSProperties} />
          })}
        </div>
      )}

      {/* Search overlay */}
      {searchQuery && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: '68px', zIndex: 49, overflowY: 'auto', backgroundColor: 'rgba(254,250,242,0.97)', padding: '24px 16px 16px' }}>
          <div>
            <p style={{ fontFamily: 'var(--font-cormorant), serif', color: '#1a2f51', fontSize: '1.4rem', fontWeight: 600, marginBottom: '16px' }}>
              {searchLoading ? 'Searching...' : searchResults?.length === 0 ? 'No books found' : 'Results'}
            </p>
            {!searchLoading && searchResults && searchResults.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '16px' }}>
                {searchResults.map(book => (
                  <button key={book.id} {...makeTapHandlers(() => { setSearchQuery(''); navigateToBook(book.id) })}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}>
                    <div style={{ width: '100%', aspectRatio: '2/3', borderRadius: '10px', overflow: 'hidden', backgroundColor: 'rgba(26,47,81,0.08)', marginBottom: '6px', position: 'relative' }}>
                      {book.cover_image_url ? <img src={book.cover_image_url} alt={book.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
                      <ReadPill bookId={book.id} />
                    </div>
                    <p style={{ fontFamily: 'var(--font-cormorant), serif', color: '#1a2f51', fontSize: '0.95rem', fontWeight: 700, lineHeight: 1.2, margin: 0 }}>{book.title}</p>
                    <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#1a2f51', fontSize: '0.65rem', opacity: 0.6, marginTop: '2px' }}>{book.author}</p>
                    {book.series_label && <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.65rem', fontWeight: 700, color: '#c48b00', letterSpacing: '0.05em', marginTop: '2px' }}>{book.series_label}</p>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sticky header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 40, backgroundColor: '#fefaf2', padding: '16px 20px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div style={{ lineHeight: 1 }}>
            <p style={{ fontFamily: 'var(--font-amatic)', fontWeight: 700, fontSize: '3rem', color: '#1a2f51', letterSpacing: '0.04em', margin: 0 }}>BONKERS</p>
            <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600, fontSize: '0.5rem', color: '#1a2f51', letterSpacing: '0.18em', textTransform: 'uppercase', margin: '2px 0 0' }}>THE CHILDREN'S LIBRARY</p>
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
            {/* Avatar / profile switcher trigger */}
            {(() => {
              if (isChildMode) {
                const browsingChild = children.find(c => c.id === childIdParam)
                if (!browsingChild) return null
                const av = AVATARS.find(a => a.id === browsingChild.avatar_id)
                return (
                  <button onClick={() => setProfileMenuOpen(o => !o)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                    <div style={{ width: '3rem', height: '3rem', borderRadius: '50%', backgroundColor: av?.bg || 'rgba(26,47,81,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: av ? '1.7rem' : '1.1rem', border: '2px solid rgba(26,47,81,0.15)', flexShrink: 0, fontWeight: 700, color: '#1a2f51' }}>
                      {av?.emoji || browsingChild.name[0]}
                    </div>
                    <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600, fontSize: '0.55rem', color: '#1a2f51', letterSpacing: '0.12em', textTransform: 'uppercase', lineHeight: 1 }}>{browsingChild.name}</span>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#1a2f51" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'transform 0.2s', transform: profileMenuOpen ? 'rotate(180deg)' : 'none' }}><polyline points="6 9 12 15 18 9"/></svg>
                  </button>
                )
              }
              if (!parentLoaded) return null
              const av = PARENT_AVATARS.find(a => a.id === parentAvatarId)
              return (
                <button onClick={() => setProfileMenuOpen(o => !o)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  <div style={{ width: '3rem', height: '3rem', borderRadius: '50%', backgroundColor: av ? av.bg : 'rgba(26,47,81,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: av ? '1.7rem' : '1.3rem', flexShrink: 0, border: '2px solid rgba(26,47,81,0.15)', fontFamily: 'var(--font-cormorant), serif', fontWeight: 700, color: '#1a2f51' }}>
                    {av ? av.emoji : (parentName ? parentName[0].toUpperCase() : '?')}
                  </div>
                  {parentName && <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600, fontSize: '0.55rem', color: '#1a2f51', letterSpacing: '0.12em', textTransform: 'uppercase', lineHeight: 1 }}>{parentName}</span>}
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#1a2f51" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'transform 0.2s', transform: profileMenuOpen ? 'rotate(180deg)' : 'none' }}><polyline points="6 9 12 15 18 9"/></svg>
                </button>
              )
            })()}
          </div>
        </div>
      </div>

      <div className="lib-content">
        <h1 style={{ fontFamily: 'var(--font-cormorant), serif', color: '#1a2f51', fontSize: '2.8rem', fontWeight: 700, lineHeight: 1, marginTop: '0px', marginBottom: (childIdParam && !isChildMode) ? '22px' : '34px', textAlign: 'center' }}>The Library</h1>
        {childIdParam && !isChildMode && (() => {
          const browsingChild = children.find(c => c.id === childIdParam)
          return browsingChild ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', backgroundColor: 'rgba(26,47,81,0.05)', border: '1px solid rgba(26,47,81,0.12)', borderRadius: '12px', padding: '10px 14px' }}>
              <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.75rem', color: '#1a2f51', fontWeight: 600 }}>Browsing for {browsingChild.name}</span>
              <button onClick={() => router.push('/dashboard/library')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.68rem', color: '#1a2f51', opacity: 0.5 }}>Browse all</button>
            </div>
          ) : null
        })()}

        {/* Reading level selector */}
        <div className="lib-age-section">
          <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#1a2f51', fontSize: '0.82rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: '20px' }}>Browse by Age</p>
          <div className="lib-age-row" style={{ display: 'flex', flexDirection: 'row' }}>
            {readingLevels.map(level => {
              const key = level.name.toLowerCase()
              const isSelected = activeLevels.some(l => l.id === level.id)
              const artMap: Record<string, string> = {
                hatchling: '/age_hatchling.png', hatchlings: '/age_hatchling.png', '3-5': '/age_hatchling.png',
                chick: '/age_chick.png', chicks: '/age_chick.png', '5-7': '/age_chick.png',
                bird: '/age_bird.png', birds: '/age_bird.png', '8-10': '/age_bird.png',
              }
              const nameMap: Record<string, string> = {
                '3-5': 'Hatchling', '5-7': 'Chick', '8-10': 'Bird',
              }
              const art = artMap[key]
              if (!art) return null
              const displayName = nameMap[key] || (key.charAt(0).toUpperCase() + key.slice(1))
              return (
                <button key={level.id} onClick={() => setActiveLevels(prev => prev.some(l => l.id === level.id) ? prev.filter(l => l.id !== level.id) : [...prev, level])}
                  style={{ background: isSelected ? '#fffef9' : 'transparent', border: `${isSelected ? '2.5px' : '1.5px'} solid ${isSelected ? '#f9d174' : 'rgba(26,47,81,0.2)'}`, borderRadius: '12px', cursor: 'pointer', padding: '10px 6px 10px 3px', display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '6px', flex: 1, transition: 'all 0.15s' }}>
                  <img src={art} alt={level.name} style={{ width: '2.5rem', height: '2.5rem', objectFit: 'contain', flexShrink: 0 }} />
                  <div style={{ textAlign: 'left' }}>
                    <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#1a2f51', fontSize: '0.78rem', fontWeight: 700, margin: 0, lineHeight: 1.2 }}>{displayName}</p>
                    <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#1a2f51', fontSize: '0.82rem', fontWeight: 400, margin: 0 }}>{AGE_MAP[key] || AGE_MAP[displayName.toLowerCase()] || ''}</p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Category blobs */}
        {categories.length > 0 && (
          <div style={{ marginBottom: '34px', marginTop: '0' }}>
            <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#1a2f51', fontSize: '0.82rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: '12px' }}>Browse by Category</p>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', flexWrap: 'wrap', justifyContent: 'center' }}>
              {categories.filter(c => getCategoryBlob(c.name)).map(cat => {
                const blob = getCategoryBlob(cat.name)!
                const isSelected = selectedCategoryIds.includes(cat.id)
                const n = cat.name.toLowerCase()
                const shortName = n.startsWith('heartwarming') ? 'Heart' : n.startsWith('amazing') ? 'Adventure' : n.startsWith('magical') ? 'Magic' : cat.name.split(' ')[0]
                return (
                  <button key={cat.id} onClick={() => setSelectedCategoryIds(prev => prev.includes(cat.id) ? prev.filter(c => c !== cat.id) : [...prev, cat.id])}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', width: '3.75rem' }}>
                    <div style={{ borderRadius: '50%', padding: '3px', boxShadow: isSelected ? '0 0 0 3px #1a2f51' : 'none', transition: 'box-shadow 0.15s', display: 'inline-flex', position: 'relative' }}>
                      <img src={blob} alt={cat.name} style={{ width: '3rem', height: '3rem', objectFit: 'contain', display: 'block' }} />
                      {n.includes('adventure') && <img src="/symbol_rocket.png" alt="" style={{ position: 'absolute', inset: 0, width: '60%', height: '60%', objectFit: 'contain', pointerEvents: 'none', margin: 'auto' }} />}
                      {(n.includes('spooky')||n.includes('scary')) && <img src="/symbol_spooky1.png" alt="" style={{ position: 'absolute', inset: 0, width: '60%', height: '60%', objectFit: 'contain', pointerEvents: 'none', margin: 'auto', filter: 'brightness(0)' }} />}
                      {(n.includes('hero')||n.includes('legend')) && <img src="/symbol_hero.png" alt="" style={{ position: 'absolute', inset: 0, width: '60%', height: '60%', objectFit: 'contain', pointerEvents: 'none', margin: 'auto', filter: 'brightness(0)' }} />}
                      {(n.includes('mystery')||n.includes('mischief')) && <img src="/symbol_mystery.png" alt="" style={{ position: 'absolute', inset: 0, width: '52%', height: '52%', objectFit: 'contain', pointerEvents: 'none', margin: 'auto', filter: 'brightness(0)' }} />}
                      {(n.includes('true')||n.includes('bonkers')) && <img src="/symbol_true.png" alt="" style={{ position: 'absolute', inset: 0, width: '48%', height: '48%', objectFit: 'contain', pointerEvents: 'none', margin: 'auto', filter: 'brightness(0)' }} />}
                      {n.includes('laugh') && <img src="/symbol_laugh.png" alt="" style={{ position: 'absolute', inset: 0, width: '52%', height: '52%', objectFit: 'contain', pointerEvents: 'none', margin: 'auto', filter: 'brightness(0)' }} />}
                      {n.includes('weird') && <img src="/symbol_weird.png" alt="" style={{ position: 'absolute', inset: 0, width: '53%', height: '53%', objectFit: 'contain', pointerEvents: 'none', margin: 'auto', filter: 'brightness(0)' }} />}
                      {n.includes('heart') && <img src="/symbol_heart.png" alt="" style={{ position: 'absolute', inset: 0, width: '45%', height: '45%', objectFit: 'contain', pointerEvents: 'none', margin: 'auto', filter: 'brightness(0)' }} />}
                      {(n.includes('magic')||n.includes('mayhem')) && <img src="/symbol_magichat.png" alt="" style={{ position: 'absolute', inset: 0, width: '75%', height: '75%', objectFit: 'contain', pointerEvents: 'none', margin: 'auto', filter: 'brightness(0)' }} />}
                    </div>
                    <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.7rem', fontWeight: 600, color: '#1a2f51', letterSpacing: '0.04em', lineHeight: 1.2, textAlign: 'center', display: 'block' }}>{shortName}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Search bar — inline, under categories */}
        <div style={{ marginBottom: '30px', position: 'relative' }}>
          <input id="lib-search" type="text" placeholder={PLACEHOLDERS[phIdx]} value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            className="focus:outline-none"
            style={{ width: '100%', padding: '13px 42px 13px 20px', borderRadius: '999px', border: '1.5px solid rgba(26,47,81,0.25)', backgroundColor: '#fff', color: '#1a2f51', fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '1rem', boxSizing: 'border-box' }} />
          {searchQuery
            ? <button onClick={() => setSearchQuery('')} style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#1a2f51', cursor: 'pointer', fontSize: '0.85rem', padding: 0 }}>✕</button>
            : <svg style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#1a2f51" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          }
        </div>

        {/* Results bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#1a2f51', fontSize: '0.9rem', fontWeight: 400, opacity: 1, margin: 0 }}>
              {booksLoading ? 'Loading...' : `${books.length} book${books.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {/* Availability dropdown */}
            <div style={{ position: 'relative' }}>
              <button onClick={() => setAvailabilityOpen(p => !p)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'rgba(26,47,81,0.05)', border: '1px solid rgba(26,47,81,0.15)', borderRadius: '8px', color: '#1a2f51', fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.8rem', fontWeight: 600, padding: '7px 12px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                {showAvailableOnly ? 'Available' : 'All books'}
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ opacity: 0.6, transition: 'transform 0.15s', transform: availabilityOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              {availabilityOpen && (
                <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, backgroundColor: '#fefaf2', borderRadius: '16px', overflow: 'hidden', zIndex: 60, minWidth: '170px', boxShadow: '0 8px 32px rgba(0,0,0,0.45)' }}>
                  {[{ value: false, label: 'All books' }, { value: true, label: 'Available books only' }].map(opt => (
                    <button key={String(opt.value)} onClick={() => { setShowAvailableOnly(opt.value); setAvailabilityOpen(false) }}
                      style={{ display: 'block', width: '100%', textAlign: 'left', background: showAvailableOnly === opt.value ? 'rgba(26,47,81,0.07)' : 'none', border: 'none', cursor: 'pointer', padding: '11px 16px', fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.8rem', fontWeight: showAvailableOnly === opt.value ? 700 : 500, color: '#1a2f51', transition: 'background 0.1s' }}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* Sort */}
            <div style={{ position: 'relative' }}>
              <button onClick={() => { setSortOpen(p => !p); setAvailabilityOpen(false) }}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'rgba(26,47,81,0.05)', border: '1px solid rgba(26,47,81,0.15)', borderRadius: '8px', color: '#1a2f51', fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.8rem', fontWeight: 600, padding: '7px 12px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                {sortBy === 'popular' ? 'Popular' : sortBy === 'newest' ? 'Newest' : 'A–Z'}
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ opacity: 0.6, transition: 'transform 0.15s', transform: sortOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              {sortOpen && (
                <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, backgroundColor: '#fefaf2', borderRadius: '16px', overflow: 'hidden', zIndex: 60, minWidth: '110px', boxShadow: '0 8px 32px rgba(0,0,0,0.45)' }}>
                  {(['popular', 'newest', 'az'] as const).map(opt => (
                    <button key={opt} onClick={() => { setSortBy(opt); setSortOpen(false) }}
                      style={{ display: 'block', width: '100%', textAlign: 'left', background: sortBy === opt ? 'rgba(26,47,81,0.07)' : 'none', border: 'none', cursor: 'pointer', padding: '11px 16px', fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.8rem', fontWeight: sortBy === opt ? 700 : 500, color: '#1a2f51', transition: 'background 0.1s' }}>
                      {opt === 'popular' ? 'Popular' : opt === 'newest' ? 'Newest' : 'A–Z'}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* Grid / List toggle */}
            <div style={{ display: 'flex', gap: '4px', backgroundColor: 'rgba(26,47,81,0.05)', borderRadius: '8px', padding: '3px' }}>
              <button onClick={() => setViewMode('grid')} style={{ background: viewMode === 'grid' ? 'rgba(26,47,81,0.12)' : 'none', border: 'none', cursor: 'pointer', borderRadius: '6px', padding: '5px 8px', display: 'flex', alignItems: 'center', color: '#1a2f51', opacity: viewMode === 'grid' ? 1 : 0.4 }}>
                <svg className="view-toggle-icon" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
              </button>
              <button onClick={() => setViewMode('list')} style={{ background: viewMode === 'list' ? 'rgba(26,47,81,0.12)' : 'none', border: 'none', cursor: 'pointer', borderRadius: '6px', padding: '5px 8px', display: 'flex', alignItems: 'center', color: '#1a2f51', opacity: viewMode === 'list' ? 1 : 0.4 }}>
                <svg className="view-toggle-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
              </button>
            </div>
          </div>
        </div>

        {/* Book grid */}
        {booksLoading ? (
          <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#1a2f51', opacity: 0.4, fontSize: '0.85rem', textAlign: 'center', padding: '40px 0' }}>Loading books...</p>
        ) : books.length === 0 ? (
          <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#1a2f51', opacity: 0.4, fontSize: '0.85rem', textAlign: 'center', padding: '40px 0' }}>No books found for these filters.</p>
        ) : viewMode === 'grid' ? (
          <div className="book-grid">
            {books.filter(book => !showAvailableOnly || availableBookIds.has(book.id)).map(book => {
              const isAvailable = availableBookIds.has(book.id)
              return (
                <div key={book.id} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                  <button {...makeTapHandlers(() => navigateToBook(book.id))} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'block', width: '100%' }}>
                    <div style={{ width: '100%', aspectRatio: '2/3', borderRadius: '12px', overflow: 'hidden', backgroundColor: 'rgba(26,47,81,0.08)', position: 'relative' }}>
                      {book.cover_image_url ? <img src={book.cover_image_url} alt={book.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /> : null}
                      <ReadPill bookId={book.id} />
                    </div>
                  </button>
                  <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                    <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#1a2f51', fontSize: '1.05rem', fontWeight: 700, letterSpacing: '0.03em', lineHeight: 1.3, margin: 0, textAlign: 'center', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{book.title}</p>
                    {book.series_label && <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.75rem', fontWeight: 700, color: '#c48b00', letterSpacing: '0.06em', margin: '4px 0 0', textAlign: 'center', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{book.series_label}</p>}
                    <div style={{ marginTop: 'auto' }}><BookActions book={book} isAvailable={isAvailable} /></div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {books.filter(book => !showAvailableOnly || availableBookIds.has(book.id)).map(book => {
              const isAvailable = availableBookIds.has(book.id)
              return (
                <div key={book.id} style={{ borderRadius: '14px', backgroundColor: '#fff', border: '1px solid rgba(26,47,81,0.1)', display: 'flex', alignItems: 'flex-start', gap: '14px', padding: '12px 14px' }}>
                  <button {...makeTapHandlers(() => navigateToBook(book.id))} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0 }}>
                    <div className="list-cover" style={{ position: 'relative' }}>
                      {book.cover_image_url ? <img src={book.cover_image_url} alt={book.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /> : null}
                      <ReadPill bookId={book.id} />
                    </div>
                  </button>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <button {...makeTapHandlers(() => navigateToBook(book.id))} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left', display: 'block', width: '100%' }}>
                      <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#1a2f51', fontSize: '0.88rem', fontWeight: 700, lineHeight: 1.25, margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{book.title}</p>
                      <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#1a2f51', fontSize: '0.68rem', opacity: 0.55, margin: '4px 0 0' }}>{book.author}</p>
                      {book.series_label && <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.65rem', fontWeight: 700, color: '#c48b00', letterSpacing: '0.05em', margin: '3px 0 0' }}>{book.series_label}</p>}
                    </button>
                    <BookActions book={book} isAvailable={isAvailable} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Basket dropdown */}
      {basketOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60 }} onClick={() => setBasketOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: '72px', right: '10px', width: 'min(320px, calc(100vw - 20px))', backgroundColor: '#fefaf2', borderRadius: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.45)', overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 10px', borderBottom: '1px solid rgba(26,47,81,0.1)' }}>
              <div>
                <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#1a2f51', margin: 0 }}>Next Delivery</p>
                <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.65rem', color: '#1a2f51', margin: '2px 0 0' }}>{addedBooks.size}/{deliveryMax} books selected</p>
              </div>
              <button onClick={() => setBasketOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#1a2f51' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            {/* Book list */}
            <div style={{ padding: '8px 0' }}>
              {Array.from({ length: deliveryMax }).map((_, i) => {
                const bookId = [...addedBooks.keys()][i]
                const book = bookId ? addedBookObjects.get(bookId) : undefined
                return book ? (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 16px' }}>
                    <div style={{ width: '36px', height: '50px', borderRadius: '4px', overflow: 'hidden', flexShrink: 0 }}>
                      {book.cover_image_url
                        ? <img src={book.cover_image_url} alt={book.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        : <div style={{ width: '100%', height: '100%', backgroundColor: 'rgba(26,47,81,0.08)' }} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 700, fontSize: '0.78rem', color: '#1a2f51', margin: 0, lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{book.title}</p>
                      {book.author && <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.65rem', color: '#1a2f51', margin: '2px 0 0' }}>{book.author}</p>}
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

      {/* Parent PIN prompt */}
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

      {/* Profile switcher dropdown */}
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
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: av?.bg || 'rgba(26,47,81,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: av ? '1rem' : '0.8rem', flexShrink: 0, fontWeight: 700, color: '#1a2f51' }}>
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

      {/* Fixed bottom: nav only */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 55, backgroundColor: '#1a2f51', borderTop: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '8px 8px', paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}>
          {NAV_ITEMS.map((item, i) => {
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

      {/* No-children gate — shown when heart/basket tapped with no profiles */}
      {showChildGate && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={() => setShowChildGate(false)}>
          <div onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: '576px', backgroundColor: '#130d09', borderRadius: '20px 20px 0 0', padding: '32px 24px 40px', border: '1px solid rgba(237,219,195,0.15)', textAlign: 'center' }}>
            <img src="/bonky_family.png" alt="" style={{ height: '72px', width: 'auto', marginBottom: '16px' }} />
            <p style={{ fontFamily: 'var(--font-cormorant), serif', color: '#eddbc3', fontSize: '1.4rem', fontWeight: 700, margin: '0 0 8px' }}>Tiny problem. No tiny humans.</p>
            <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: 'rgba(237,219,195,0.6)', fontSize: '0.8rem', lineHeight: 1.6, margin: '0 0 4px' }}>We need at least one child profile before the book choosing can begin.</p>
            <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: 'rgba(237,219,195,0.6)', fontSize: '0.8rem', lineHeight: 1.6, margin: '0 0 24px' }}>Add your reader and we'll take it from there.</p>
            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
              <img src="/whiskers_left.png" alt="" style={{ position: 'absolute', left: '-32px', height: '44px', width: 'auto', pointerEvents: 'none', zIndex: 1, filter: 'brightness(0) saturate(100%) invert(87%) sepia(33%) saturate(762%) hue-rotate(339deg) brightness(103%) contrast(98%)' }} />
              <button onClick={() => router.push('/dashboard/children/new')}
                style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#080402', backgroundColor: '#eddbc3', border: 'none', borderRadius: '999px', padding: '12px 28px', cursor: 'pointer' }}>
                Add a child
              </button>
              <img src="/whiskers_right.png" alt="" style={{ position: 'absolute', right: '-32px', height: '44px', width: 'auto', pointerEvents: 'none', zIndex: 1, filter: 'brightness(0) saturate(100%) invert(87%) sepia(33%) saturate(762%) hue-rotate(339deg) brightness(103%) contrast(98%)' }} />
            </div>
            <button onClick={() => setShowChildGate(false)}
              style={{ display: 'block', margin: '16px auto 0', background: 'none', border: 'none', fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.78rem', color: 'rgba(237,219,195,0.45)', cursor: 'pointer' }}>
              I'll do it later
            </button>
          </div>
        </div>
      )}

      {/* Child selector modal — shared for heart and basket */}
      {pendingBook && pendingAction && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={() => { setPendingBook(null); setPendingAction(null) }}>
          <div onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: '576px', backgroundColor: '#130d09', borderRadius: '20px 20px 0 0', padding: '24px 20px 32px', border: '1px solid rgba(237,219,195,0.15)' }}>
            <p style={{ fontFamily: 'var(--font-cormorant), serif', color: '#eddbc3', fontSize: '1.3rem', fontWeight: 700, margin: '0 0 4px' }}>
              {pendingAction === 'heart' ? 'Save to My List for…' : 'Add to delivery for…'}
            </p>
            <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#eddbc3', fontSize: '0.72rem', opacity: 0.55, margin: '0 0 20px' }}>{pendingBook.title}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {children.map(child => {
                const isOnList = pendingAction === 'heart' && (wishlists.get(pendingBook.id) || []).includes(child.id)
                return (
                  <button key={child.id}
                    onClick={e => pendingAction === 'heart' ? toggleWishlist(pendingBook, child, e.clientX, e.clientY) : confirmBasket(pendingBook, child, e.currentTarget, e.clientX, e.clientY)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderRadius: '12px', backgroundColor: isOnList ? 'rgba(244,114,182,0.1)' : 'rgba(237,219,195,0.06)', border: `1px solid ${isOnList ? 'rgba(244,114,182,0.35)' : 'rgba(237,219,195,0.15)'}`, cursor: 'pointer' }}>
                    <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#eddbc3', fontSize: '0.9rem', fontWeight: 600 }}>{child.name}</span>
                    {pendingAction === 'heart'
                      ? isOnList
                        ? <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.72rem', color: '#f472b6' }}>Remove ✕</span>
                        : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#eddbc3" strokeWidth="2" style={{ opacity: 0.4 }}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                      : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#eddbc3" strokeWidth="2" style={{ opacity: 0.4 }}><polyline points="9 18 15 12 9 6"/></svg>
                    }
                  </button>
                )
              })}
            </div>
            <button onClick={() => { setPendingBook(null); setPendingAction(null) }}
              style={{ marginTop: '16px', width: '100%', padding: '12px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-montserrat), sans-serif', color: '#eddbc3', fontSize: '0.8rem', opacity: 0.45 }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </main>
  )
}

export default function LibraryPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#080402' }}>
        <p style={{ color: '#eddbc3', fontFamily: 'var(--font-montserrat), sans-serif' }}>Loading...</p>
      </main>
    }>
      <LibraryPageInner />
    </Suspense>
  )
}
