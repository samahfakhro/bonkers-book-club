'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useParams, useSearchParams, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type SeriesInfo = {
  id: string
  name: string
  parent_series_id: string | null
  parent: { id: string; name: string } | null
}

type SubSeries = {
  id: string
  name: string
  series_number: number | null
}

type Book = {
  id: string
  title: string
  author: string
  cover_image_url: string | null
  series_number: number | null
  series_id: string
  sub_series_name?: string
  sub_series_number?: number | null
}

type Child = {
  id: string
  name: string
  nickname: string | null
  avatar_id: string | null
}

type ShelfBook = {
  id: string
  title: string
  author: string
  cover_image_url: string | null
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

export default function SeriesPageWrapper() {
  return <Suspense fallback={<main className="min-h-screen" style={{ backgroundColor: '#fefaf2' }} />}><SeriesPage /></Suspense>
}

function SeriesPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const seriesId = params.id as string
  const childIdParam = searchParams.get('childId')
  const isChildMode = !!childIdParam

  const [series, setSeries] = useState<SeriesInfo | null>(null)
  const [books, setBooks] = useState<Book[]>([])
  const [availableBookIds, setAvailableBookIds] = useState<Set<string>>(new Set())
  const [showAvailableOnly, setShowAvailableOnly] = useState(false)
  const [availabilityOpen, setAvailabilityOpen] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [loading, setLoading] = useState(true)

  const [headerInfo, setHeaderInfo] = useState<{ name: string; avatarId: string | null } | null>(null)
  const [children, setChildren] = useState<Child[]>([])
  const [parentAvatarId, setParentAvatarId] = useState<string | null>(null)
  const [parentName, setParentName] = useState('')
  const [addedBooks, setAddedBooks] = useState<Map<string, string>>(new Map())
  const [addedBookObjects, setAddedBookObjects] = useState<Map<string, ShelfBook>>(new Map())
  const [deliveryMax, setDeliveryMax] = useState(4)
  const [basketOpen, setBasketOpen] = useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [parentPinHash, setParentPinHash] = useState<string | null>(null)
  const [pinPromptTarget, setPinPromptTarget] = useState<string | null>(null)
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState(false)
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

  // Load child header info fast
  useEffect(() => {
    if (!childIdParam) return
    supabase.from('child_profiles').select('id, name, nickname, avatar_id').eq('id', childIdParam).single().then(({ data }) => {
      if (data) setHeaderInfo({ name: (data as any).nickname || (data as any).name, avatarId: (data as any).avatar_id ?? null })
    })
  }, [childIdParam])

  // Load series + books + user data
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: household } = await supabase.from('households').select('*').eq('user_id', user.id).single()

      if (household) {
        setParentName((household as any).first_name ?? '')
        setParentAvatarId((household as any).avatar_id ?? null)
        setParentPinHash((household as any).parent_pin_hash ?? null)
        if (!childIdParam) {
          setHeaderInfo({ name: (household as any).first_name ?? '', avatarId: (household as any).avatar_id ?? null })
        }
      }

      // Load children
      if (household) {
        const { data: kids } = await supabase.from('child_profiles').select('id, name, nickname, avatar_id').eq('household_id', household.id).order('created_at')
        setChildren((kids || []) as Child[])
      }

      // Load basket
      if (household) {
        const { data: draftReq } = await supabase.from('swap_requests').select('id').eq('household_id', household.id).eq('status', 'draft').maybeSingle()
        if (draftReq) {
          const { data: items } = await supabase.from('swap_request_items')
            .select('book_id, child_id, books(id, title, author, cover_image_url)')
            .eq('swap_request_id', draftReq.id)
          if (items) {
            const addedMap = new Map<string, string>()
            const addedObjMap = new Map<string, ShelfBook>()
            for (const item of items as any[]) {
              addedMap.set(item.book_id, item.child_id || '')
              if (item.books) addedObjMap.set(item.book_id, item.books as ShelfBook)
            }
            setAddedBooks(addedMap)
            setAddedBookObjects(addedObjMap)
          }
        }
        const { data: subData } = await supabase.from('subscriptions').select('subscription_plans(books_per_swap)').eq('household_id', household.id).single()
        const { data: loanData } = await supabase.from('loans').select('id, return_requested').eq('household_id', household.id).eq('status', 'active')
        const booksPerSwap: number = (subData as any)?.subscription_plans?.books_per_swap ?? 4
        const booksKept = (loanData || []).filter((l: any) => !l.return_requested).length
        setDeliveryMax(Math.max(1, booksPerSwap - booksKept))
      }

      // Load series via API (service role — bypasses RLS on series table)
      const seriesRes = await fetch(`/api/series?id=${seriesId}`)
      if (!seriesRes.ok) { setLoading(false); return }
      const seriesJson = await seriesRes.json()
      if (!seriesJson.data) { setLoading(false); return }
      setSeries(seriesJson.data as SeriesInfo)

      // Check for sub-series
      const { data: subSeries } = await supabase
        .from('series')
        .select('id, name, series_number')
        .eq('parent_series_id', seriesId)
        .order('series_number')

      let allBooks: Book[] = []

      if (subSeries && subSeries.length > 0) {
        const subIds = (subSeries as SubSeries[]).map(s => s.id)
        const { data: booksData } = await supabase
          .from('books')
          .select('id, title, author, cover_image_url, series_number, series_id')
          .in('series_id', subIds)
          .eq('is_active', true)
        const subMap = new Map((subSeries as SubSeries[]).map(s => [s.id, s]))
        allBooks = (booksData || []).map((b: any) => ({
          ...b,
          sub_series_name: subMap.get(b.series_id)?.name,
          sub_series_number: subMap.get(b.series_id)?.series_number ?? null,
        }))
        allBooks.sort((a, b) => {
          const subA = a.sub_series_number ?? 9999
          const subB = b.sub_series_number ?? 9999
          if (subA !== subB) return subA - subB
          return (a.series_number ?? 9999) - (b.series_number ?? 9999)
        })
      } else {
        const { data: booksData } = await supabase
          .from('books')
          .select('id, title, author, cover_image_url, series_number, series_id')
          .eq('series_id', seriesId)
          .eq('is_active', true)
          .order('series_number')
        allBooks = (booksData || []) as Book[]
      }

      setBooks(allBooks)

      if (allBooks.length > 0) {
        const { data: availData } = await supabase
          .from('book_copies').select('book_id')
          .in('book_id', allBooks.map(b => b.id))
          .eq('status', 'available')
        setAvailableBookIds(new Set((availData || []).map((r: any) => r.book_id)))
      }

      setLoading(false)
    }
    load()
  }, [seriesId])

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

  const headerAvatar = isChildMode
    ? AVATARS.find(a => a.id === headerInfo?.avatarId)
    : PARENT_AVATARS.find(a => a.id === headerInfo?.avatarId)

  const filteredBooks = showAvailableOnly ? books.filter(b => availableBookIds.has(b.id)) : books

  function navigateToBook(id: string) {
    const url = childIdParam ? `/dashboard/library/${id}?childId=${childIdParam}` : `/dashboard/library/${id}`
    router.push(url)
  }

  const navItems = isChildMode ? [
    { label: 'Home', path: `/dashboard/children/${childIdParam}`, exact: true, onClick: () => router.push(`/dashboard/children/${childIdParam}`), icon: () => <svg className="nav-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg> },
    { label: 'Library', path: '/dashboard/library', exact: false, onClick: () => router.push(`/dashboard/library?from=child&childId=${childIdParam}`), icon: () => <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg> },
  ] : [
    { label: 'Home', path: '/dashboard', exact: true, onClick: () => router.push('/dashboard'), icon: () => <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9.5z"/><polyline points="9 21 9 12 15 12 15 21"/></svg> },
    { label: 'Library', path: '/dashboard/library', exact: false, onClick: () => router.push('/dashboard/library'), icon: () => <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg> },
    { label: 'Settings', path: '/dashboard/settings', exact: false, onClick: () => router.push('/dashboard/settings'), icon: () => <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06-.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> },
    { label: 'Support', path: '/dashboard/support', exact: false, onClick: () => router.push('/dashboard/support'), icon: () => <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> },
  ]

  if (loading) return (
    <main className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#fefaf2' }}>
      <p style={{ color: '#1a2f51', fontFamily: 'var(--font-montserrat), sans-serif' }}>Loading…</p>
    </main>
  )

  if (!series) return (
    <main className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#fefaf2' }}>
      <p style={{ color: '#1a2f51', fontFamily: 'var(--font-montserrat), sans-serif' }}>Series not found.</p>
    </main>
  )

  const seriesLabel = series.parent ? `${series.parent.name} · ${series.name}` : series.name

  return (
    <main className="min-h-screen" style={{ backgroundColor: '#fefaf2', paddingBottom: '100px' }}>
      <style>{`
        .series-grid { display: grid; column-gap: 12px; row-gap: 20px; grid-template-columns: repeat(2, 1fr); }
        @media (min-width: 768px) and (max-width: 1024px) { .series-grid { column-gap: 18px; row-gap: 28px; grid-template-columns: repeat(3, 1fr); } }
      `}</style>

      {/* ── Sticky header ── */}
      <div style={{ position: 'sticky', top: 0, zIndex: 40, backgroundColor: '#fefaf2', padding: '16px 20px 10px', paddingTop: 'max(16px, env(safe-area-inset-top))' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div style={{ lineHeight: 1 }}>
            <p style={{ fontFamily: 'var(--font-amatic)', fontWeight: 700, fontSize: '3rem', color: '#1a2f51', letterSpacing: '0.04em', margin: 0 }}>BONKERS</p>
            <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600, fontSize: '0.5rem', color: '#1a2f51', letterSpacing: '0.18em', textTransform: 'uppercase', margin: '2px 0 0' }}>THE CHILDREN&apos;S LIBRARY</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '36px' }}>
            {/* Basket */}
            <button onClick={() => setBasketOpen(o => !o)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}>
              <svg className="basket-icon" viewBox="0 0 24 24" fill="#1a2f51" stroke="none">
                <rect x="2" y="17" width="20" height="4" rx="1"/>
                <rect x="4" y="11" width="16" height="4" rx="1"/>
                <rect x="6" y="5" width="12" height="4" rx="1"/>
              </svg>
              <span className="basket-badge" style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 700, color: '#1a2f51', whiteSpace: 'nowrap' }}>
                {addedBooks.size}/{deliveryMax}
              </span>
            </button>
            {/* Profile */}
            {headerInfo && (
              <button onClick={() => setProfileMenuOpen(o => !o)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                <div style={{ width: '3rem', height: '3rem', borderRadius: '50%', backgroundColor: headerAvatar?.bg || 'rgba(26,47,81,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: headerAvatar ? '1.7rem' : '1.1rem', border: '2px solid rgba(26,47,81,0.15)', flexShrink: 0, fontWeight: 700, color: '#1a2f51' }}>
                  {headerAvatar?.emoji || headerInfo.name[0]?.toUpperCase() || '?'}
                </div>
                <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600, fontSize: '0.55rem', color: '#1a2f51', letterSpacing: '0.12em', textTransform: 'uppercase', lineHeight: 1 }}>{headerInfo.name}</span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#1a2f51" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'transform 0.2s', transform: profileMenuOpen ? 'rotate(180deg)' : 'none' }}><polyline points="6 9 12 15 18 9"/></svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Back + heading ── */}
      <div className="lib-content" style={{ paddingTop: '24px' }}>
        <button onClick={() => router.back()} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(26,47,81,0.55)', padding: 0, marginBottom: '16px' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.8rem', letterSpacing: '0.03em' }}>Back</span>
        </button>
        {series.parent && (
          <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.72rem', fontWeight: 700, color: '#c48b00', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 4px' }}>{series.parent.name}</p>
        )}
        <h1 style={{ fontFamily: 'var(--font-cormorant), serif', fontWeight: 700, fontSize: '2.2rem', color: '#1a2f51', margin: 0, lineHeight: 1.1 }}>{series.name} Series</h1>
        <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.72rem', color: 'rgba(26,47,81,0.5)', margin: '6px 0 0' }}>{filteredBooks.length} {filteredBooks.length === 1 ? 'book' : 'books'}</p>
      </div>

      {/* ── Filter row ── */}
      <div className="lib-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '16px', paddingBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.8rem', fontWeight: 600, color: '#1a2f51', letterSpacing: '0.05em' }}>Filter</span>
          {/* Availability dropdown */}
          <div style={{ position: 'relative' }}>
            <button onClick={() => setAvailabilityOpen(p => !p)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'rgba(26,47,81,0.05)', border: '1px solid rgba(26,47,81,0.15)', borderRadius: '8px', color: '#1a2f51', fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.8rem', fontWeight: 600, padding: '7px 12px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {showAvailableOnly ? 'Available' : 'All books'}
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ opacity: 0.6, transition: 'transform 0.15s', transform: availabilityOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            {availabilityOpen && (
              <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, backgroundColor: '#fefaf2', borderRadius: '16px', overflow: 'hidden', zIndex: 60, minWidth: '170px', boxShadow: '0 8px 32px rgba(0,0,0,0.45)' }}>
                {[{ value: false, label: 'All books' }, { value: true, label: 'Available books only' }].map(opt => (
                  <button key={String(opt.value)} onClick={() => { setShowAvailableOnly(opt.value); setAvailabilityOpen(false) }}
                    style={{ display: 'block', width: '100%', textAlign: 'left', background: showAvailableOnly === opt.value ? 'rgba(26,47,81,0.07)' : 'none', border: 'none', cursor: 'pointer', padding: '11px 16px', fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.8rem', fontWeight: showAvailableOnly === opt.value ? 700 : 500, color: '#1a2f51' }}>
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
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

      {/* ── Books ── */}
      {filteredBooks.length === 0 ? (
        <p className="lib-content" style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.85rem', color: 'rgba(26,47,81,0.45)', textAlign: 'center', marginTop: '48px' }}>
          {showAvailableOnly ? 'No books available right now.' : 'No books in this series yet.'}
        </p>
      ) : viewMode === 'grid' ? (
        <div className="lib-content series-grid" style={{ paddingTop: '4px' }}>
          {filteredBooks.map(book => (
            <button key={book.id} {...makeTapHandlers(() => navigateToBook(book.id))}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', flexDirection: 'column' }}>
              <div style={{ width: '100%', aspectRatio: '2/3', borderRadius: '10px', overflow: 'hidden', backgroundColor: 'rgba(26,47,81,0.08)', marginBottom: '8px', position: 'relative' }}>
                {book.cover_image_url ? <img src={book.cover_image_url} alt={book.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /> : null}
                {!availableBookIds.has(book.id) && (
                  <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(254,250,242,0.55)' }} />
                )}
              </div>
              <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#1a2f51', fontSize: '1.05rem', fontWeight: 700, letterSpacing: '0.03em', lineHeight: 1.3, margin: 0, textAlign: 'center', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{book.title}</p>
              {book.series_number != null && (
                <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.75rem', fontWeight: 700, color: '#c48b00', letterSpacing: '0.06em', margin: '4px 0 0', textAlign: 'center', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                  {book.sub_series_name ? `${book.sub_series_name} · ` : ''}Book {book.series_number}
                </p>
              )}
            </button>
          ))}
        </div>
      ) : (
        <div className="lib-content" style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingTop: '4px' }}>
          {filteredBooks.map(book => (
            <button key={book.id} {...makeTapHandlers(() => navigateToBook(book.id))}
              style={{ backgroundColor: '#fff', border: '1px solid rgba(26,47,81,0.1)', borderRadius: '14px', cursor: 'pointer', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '14px', textAlign: 'left' as const }}>
              <div style={{ width: '52px', height: '76px', borderRadius: '8px', overflow: 'hidden', flexShrink: 0, backgroundColor: 'rgba(26,47,81,0.08)', position: 'relative' }}>
                {book.cover_image_url ? <img src={book.cover_image_url} alt={book.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /> : null}
                {!availableBookIds.has(book.id) && (
                  <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(254,250,242,0.55)' }} />
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#1a2f51', fontSize: '0.88rem', fontWeight: 700, lineHeight: 1.25, margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{book.title}</p>
                <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#1a2f51', fontSize: '0.68rem', opacity: 0.55, margin: '4px 0 0' }}>{book.author}</p>
                {book.series_number != null && (
                  <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.65rem', fontWeight: 700, color: '#c48b00', letterSpacing: '0.05em', margin: '4px 0 0' }}>
                    {book.sub_series_name ? `${book.sub_series_name} · ` : ''}Book {book.series_number}
                  </p>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '6px' }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: availableBookIds.has(book.id) ? '#5a8a5a' : 'rgba(26,47,81,0.2)', flexShrink: 0 }} />
                  <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.62rem', color: availableBookIds.has(book.id) ? '#5a8a5a' : 'rgba(26,47,81,0.4)', fontWeight: 600 }}>
                    {availableBookIds.has(book.id) ? 'Available' : 'Unavailable'}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* ── Bottom nav ── */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 55, backgroundColor: '#1a2f51', borderTop: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '8px 8px', paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}>
          {navItems.map((item, i) => {
            const active = item.exact ? pathname === item.path : pathname.startsWith(item.path)
            return (
              <button key={i} onClick={item.onClick}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', flex: 1, background: 'none', border: 'none', cursor: 'pointer', color: active ? '#f9d174' : '#fefaf2', minWidth: '56px', padding: 0 }}>
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
                      {bk.cover_image_url ? <img src={bk.cover_image_url} alt={bk.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /> : <div style={{ width: '100%', height: '100%', backgroundColor: 'rgba(26,47,81,0.08)' }} />}
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
                  <button key={child.id} onClick={() => { setProfileMenuOpen(false); router.push(`/dashboard/children/${child.id}`) }}
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

    </main>
  )
}
