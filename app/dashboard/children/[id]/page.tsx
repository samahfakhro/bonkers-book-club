'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { householdDeliveryDay } from '@/lib/delivery-day'
import { useTapOnly } from '@/hooks/useTapOnly'

function TapButton({ onTap, style, children }: { onTap: () => void; style?: React.CSSProperties; children: React.ReactNode }) {
  const handlers = useTapOnly(onTap)
  return <button {...handlers} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', ...style }}>{children}</button>
}

const AVATARS = [
  { id: 'lion', emoji: '🦁', bg: '#FCD34D' },
  { id: 'elephant', emoji: '🐘', bg: '#93C5FD' },
  { id: 'fox', emoji: '🦊', bg: '#FB923C' },
  { id: 'owl', emoji: '🦉', bg: '#A78BFA' },
  { id: 'bear', emoji: '🐻', bg: '#86EFAC' },
  { id: 'bunny', emoji: '🐰', bg: '#F9A8D4' },
  { id: 'tiger', emoji: '🐯', bg: '#FDE68A' },
  { id: 'penguin', emoji: '🐧', bg: '#BAE6FD' },
]

const REVIEW_CATEGORIES = [
  { key: 'laugh_level', label: 'Laugh Level' },
  { key: 'weirdness', label: 'Weirdness' },
  { key: 'scariness', label: 'Scariness' },
  { key: 'adventure', label: 'Adventure' },
  { key: 'feelings', label: 'Feelings' },
]

const ACHIEVEMENTS = [
  { id: 'first_book', emoji: '🚀', title: 'First Launch', desc: 'Read 1 book', threshold: 1 },
  { id: 'five_books', emoji: '🌙', title: 'Moon Walker', desc: 'Read 5 books', threshold: 5 },
  { id: 'ten_books', emoji: '⭐', title: 'Star Gazer', desc: 'Read 10 books', threshold: 10 },
  { id: 'twenty_books', emoji: '🪐', title: 'Planet Hopper', desc: 'Read 20 books', threshold: 20 },
  { id: 'fifty_books', emoji: '🌌', title: 'Galaxy Explorer', desc: 'Read 50 books', threshold: 50 },
  { id: 'hundred_books', emoji: '🌠', title: 'Cosmic Legend', desc: 'Read 100 books', threshold: 100 },
]

const WORLDS = [
  { name: 'Planet Lore', emoji: '🪐', unlockAt: 5 },
  { name: 'Moon Base', emoji: '🌙', unlockAt: 10 },
  { name: 'Star Cluster', emoji: '⭐', unlockAt: 20 },
  { name: 'Nebula Cove', emoji: '🌌', unlockAt: 50 },
  { name: 'Cosmic Core', emoji: '🌠', unlockAt: 100 },
]

// Book shelf slots — 83 positions derived from PSD layer data (DOC 1672×941)
// Shelf 1: slots 0–42 | Shelf 2: slots 43–82
const BOOK_SLOTS = [
  {l:'0.0%',t:'17.2%',h:'16.7%'},{l:'1.1%',t:'18.1%',h:'16.4%'},{l:'3.0%',t:'18.7%',h:'16.2%'},
  {l:'4.1%',t:'21.3%',h:'13.9%'},{l:'6.2%',t:'20.8%',h:'15.1%'},{l:'7.7%',t:'22.4%',h:'14.0%'},
  {l:'9.3%',t:'22.1%',h:'14.6%'},{l:'10.5%',t:'22.4%',h:'14.7%'},{l:'11.8%',t:'23.9%',h:'13.5%'},
  {l:'13.7%',t:'24.0%',h:'13.7%'},{l:'14.7%',t:'24.5%',h:'13.9%'},{l:'17.6%',t:'26.1%',h:'12.5%'},
  {l:'18.8%',t:'26.5%',h:'12.4%'},{l:'20.2%',t:'27.5%',h:'11.6%'},{l:'20.1%',t:'26.6%',h:'12.8%'},
  {l:'22.2%',t:'27.1%',h:'12.5%'},{l:'23.0%',t:'28.8%',h:'11.2%'},{l:'24.0%',t:'28.3%',h:'12.1%'},
  {l:'26.3%',t:'29.4%',h:'10.9%'},{l:'26.8%',t:'29.5%',h:'11.3%'},{l:'27.8%',t:'30.2%',h:'10.9%'},
  {l:'28.3%',t:'30.0%',h:'11.5%'},{l:'30.3%',t:'31.4%',h:'10.4%'},{l:'31.8%',t:'32.2%',h:'9.7%'},
  {l:'31.6%',t:'31.2%',h:'10.7%'},{l:'33.3%',t:'32.5%',h:'9.8%'},{l:'34.1%',t:'32.5%',h:'9.8%'},
  {l:'34.3%',t:'32.3%',h:'10.3%'},{l:'35.9%',t:'33.7%',h:'9.2%'},{l:'36.7%',t:'33.6%',h:'9.2%'},
  {l:'36.7%',t:'33.2%',h:'9.9%'},{l:'38.3%',t:'34.2%',h:'9.2%'},{l:'40.0%',t:'34.5%',h:'8.7%'},
  {l:'40.6%',t:'35.1%',h:'8.9%'},{l:'41.6%',t:'35.7%',h:'8.2%'},{l:'42.5%',t:'35.9%',h:'8.5%'},
  {l:'42.8%',t:'35.7%',h:'8.8%'},{l:'44.2%',t:'35.9%',h:'8.2%'},{l:'44.7%',t:'36.6%',h:'8.0%'},
  {l:'45.5%',t:'37.2%',h:'7.4%'},{l:'45.9%',t:'36.9%',h:'7.9%'},{l:'46.7%',t:'37.5%',h:'7.3%'},
  {l:'47.1%',t:'37.0%',h:'7.8%'},
  // shelf 2
  {l:'0.0%',t:'40.3%',h:'15.8%'},{l:'0.6%',t:'39.7%',h:'16.3%'},{l:'3.3%',t:'40.7%',h:'14.9%'},
  {l:'4.5%',t:'40.3%',h:'15.4%'},{l:'7.4%',t:'40.9%',h:'14.9%'},{l:'8.8%',t:'42.3%',h:'13.4%'},
  {l:'10.2%',t:'41.9%',h:'13.8%'},{l:'11.2%',t:'41.3%',h:'14.1%'},{l:'14.4%',t:'43.0%',h:'12.6%'},
  {l:'16.1%',t:'43.1%',h:'12.3%'},{l:'17.6%',t:'43.6%',h:'11.7%'},{l:'19.0%',t:'43.7%',h:'11.7%'},
  {l:'20.4%',t:'43.7%',h:'11.6%'},{l:'21.8%',t:'43.8%',h:'11.4%'},{l:'23.1%',t:'44.6%',h:'10.5%'},
  {l:'24.4%',t:'44.2%',h:'11.1%'},{l:'26.0%',t:'44.4%',h:'10.7%'},{l:'27.0%',t:'44.6%',h:'10.5%'},
  {l:'28.5%',t:'44.9%',h:'10.5%'},{l:'29.8%',t:'45.5%',h:'9.7%'},{l:'30.1%',t:'44.3%',h:'10.7%'},
  {l:'31.6%',t:'45.4%',h:'9.9%'},{l:'32.8%',t:'45.9%',h:'9.5%'},{l:'33.9%',t:'45.6%',h:'9.5%'},
  {l:'34.4%',t:'45.7%',h:'9.1%'},{l:'34.8%',t:'45.3%',h:'9.8%'},{l:'36.3%',t:'45.4%',h:'9.8%'},
  {l:'37.8%',t:'45.6%',h:'9.2%'},{l:'38.3%',t:'45.7%',h:'9.2%'},{l:'39.3%',t:'46.0%',h:'9.2%'},
  {l:'40.4%',t:'46.0%',h:'9.2%'},{l:'41.1%',t:'46.0%',h:'9.0%'},{l:'42.6%',t:'46.2%',h:'8.4%'},
  {l:'43.3%',t:'46.5%',h:'8.5%'},{l:'44.2%',t:'46.1%',h:'9.0%'},{l:'44.9%',t:'46.2%',h:'8.7%'},
  {l:'45.8%',t:'46.5%',h:'8.4%'},{l:'46.3%',t:'47.1%',h:'7.9%'},{l:'46.7%',t:'47.1%',h:'7.7%'},
  {l:'47.4%',t:'47.0%',h:'7.9%'},
]

// Deterministic spine colours from book id
const SPINE_COLOURS = ['#7C3D6B', '#2F5C8B', '#4A7A3E', '#7A3C2F', '#5A4A8B', '#2F7070', '#8B5C2F', '#3A5C4A']
function spineColor(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = ((h * 31) + id.charCodeAt(i)) & 0xffffffff
  return SPINE_COLOURS[Math.abs(h) % SPINE_COLOURS.length]
}

// Deterministic stars for space section
const STARS = Array.from({ length: 60 }, (_, i) => ({
  left: `${((i * 137.508) % 100).toFixed(1)}%`,
  top: `${((i * 97.3) % 100).toFixed(1)}%`,
  size: `${(((i * 1.7) % 2) + 1).toFixed(1)}px`,
  opacity: (((i * 0.618) % 0.7) + 0.15).toFixed(2),
}))

function getChooseCutoffDay(swapDay: string): string {
  const days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday']
  const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
  const idx = days.indexOf(swapDay.toLowerCase())
  if (idx === -1) return swapDay
  return dayNames[(idx - 2 + 7) % 7]
}

function formatCutoffTime(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const ampm = h >= 12 ? 'pm' : 'am'
  const hour = h % 12 || 12
  return m === 0 ? `${hour}:00 ${ampm}` : `${hour}:${String(m).padStart(2, '0')} ${ampm}`
}

function getNextBonkersDate(swapDay: string | undefined): { dayName: string; dateStr: string; isToday: boolean } {
  if (!swapDay) return { dayName: 'Tuesday', dateStr: '', isToday: false }
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  const now = new Date()
  const targetDay = days.indexOf(swapDay.toLowerCase())
  if (targetDay === -1) return { dayName: swapDay, dateStr: '', isToday: false }
  const diff = (targetDay - now.getDay() + 7) % 7
  if (diff === 0) return { dayName: '', dateStr: '', isToday: true }
  const result = new Date(now)
  result.setDate(now.getDate() + diff)
  return { dayName: dayNames[result.getDay()], dateStr: `${result.getDate()} ${months[result.getMonth()]}`, isToday: false }
}


type ChildProfile = {
  id: string
  name: string
  nickname: string | null
  avatar_id: string | null
  date_of_birth: string | null
  swap_permission: 'parent_only' | 'independent_submit' | 'prepare_only'
  book_slot_allocation: number | null
  books_read_count: number
  reviews_count: number
}

type BookItem = { id: string; title: string; cover_url: string | null; author: string | null }
type LoanItem = { loanId: string; book: BookItem; returnRequested: boolean; collected?: boolean } // collected = driver has it, awaiting warehouse scan-in
type ReadBook = { loanId: string; book: BookItem; returnedAt: string | null; rating: number | null }
type WishlistItem = { id: string; book: BookItem }
type Sibling = { id: string; name: string; nickname: string | null; avatar_id: string | null }
type DraftBook = { book: BookItem }

const CHILD_CHARACTERS: { src: string; slot: 'default' | 'below-cutoff' | 'on-books-at-home' }[] = [
  { src: '/mouse_teacup.png', slot: 'default' },
  { src: '/mouse_1.png',      slot: 'default' },
  { src: '/mouse_2.png',      slot: 'below-cutoff' },
  { src: '/mouse_3.png',      slot: 'default' },
  { src: '/mouse_4.png',      slot: 'default' },
  { src: '/mouse_5.png',      slot: 'default' },
  { src: '/mouse_6.png',      slot: 'default' },
  { src: '/mouse_7.png',      slot: 'on-books-at-home' },
  { src: '/mouse_8.png',      slot: 'default' },
  { src: '/mouse_9.png',      slot: 'default' },
  { src: '/mouse_10.png',     slot: 'default' },
  { src: '/mouse_11.png',     slot: 'default' },
  { src: '/mouse_12.png',     slot: 'default' },
  { src: '/mouse_13.png',     slot: 'default' },
  { src: '/mouse_14.png',     slot: 'default' },
  { src: '/chase.png',        slot: 'default' },
  { src: '/penguin_1.png',    slot: 'default' },
  { src: '/penguin_2.png',    slot: 'default' },
  { src: '/penguin_3.png',    slot: 'default' },
  { src: '/penguin_4.png',    slot: 'default' },
  { src: '/whale_2.png',      slot: 'default' },
  { src: '/whale_3.png',      slot: 'default' },
  { src: '/whale_4.png',      slot: 'default' },
  { src: '/whale_5.png',      slot: 'default' },
]

export default function ChildProfilePage() {
  const router = useRouter()
  const params = useParams()
  const pathname = usePathname()
  const childId = params.id as string

  const [character] = useState(() => {
    const today = new Date().toDateString()
    try {
      const stored = JSON.parse(localStorage.getItem('bonkers_char_child') || 'null')
      if (stored?.date === today && typeof stored.index === 'number') return CHILD_CHARACTERS[stored.index]
    } catch {}
    const index = Math.floor(Math.random() * CHILD_CHARACTERS.length)
    try { localStorage.setItem('bonkers_char_child', JSON.stringify({ date: today, index })) } catch {}
    return CHILD_CHARACTERS[index]
  })
  const [child, setChild] = useState<ChildProfile | null>(null)
  const [siblings, setSiblings] = useState<Sibling[]>([])
  const [planBooks, setPlanBooks] = useState(4)
  const [swapDay, setSwapDay] = useState('')
  const [cutoffTime, setCutoffTime] = useState('20:00:00')
  const [currentLoans, setCurrentLoans] = useState<LoanItem[]>([])
  const [readBooks, setReadBooks] = useState<ReadBook[]>([])
  const [draftItems, setDraftItems] = useState<DraftBook[]>([])
  const [totalDraftCount, setTotalDraftCount] = useState(0)
  const [wishlist, setWishlist] = useState<WishlistItem[]>([])
  const [picksBooks, setPicksBooks] = useState<BookItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSpine, setSelectedSpine] = useState<ReadBook | null>(null)
  const [showSwitcher, setShowSwitcher] = useState(false)
  const [parentPinHash, setParentPinHash] = useState<string | null>(null)
  const [parentAvatar, setParentAvatar] = useState<{ emoji: string; bg: string } | null>(null)
  const [parentName, setParentName] = useState<string | null>(null)
  const [pinPromptTarget, setPinPromptTarget] = useState<string | null>(null)
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState(false)
  const pinInputRef = useRef<HTMLInputElement | null>(null)
  const [returnMarked, setReturnMarked] = useState<Set<string>>(new Set())
  const [bonkyLooking, setBonkyLooking] = useState<'forward' | 'side'>('forward')
  const [bonkyBlink, setBonkyBlink] = useState(false)
  const [bonkyBreathing, setBonkyBreathing] = useState(false)
  const [bonkyZs, setBonkyZs] = useState<Array<{left: number, rot: number}>>([])
  const [doorOpen, setDoorOpen] = useState(false)
  const [insideHouse, setInsideHouse] = useState(false)
  const [bonkyZKey, setBonkyZKey] = useState(0)
  const [roomSpineSelected, setRoomSpineSelected] = useState<number | null>(null)
  const [availableWishlistIds, setAvailableWishlistIds] = useState<Set<string>>(new Set())
  const [notifyingBookIds, setNotifyingBookIds] = useState<Set<string>>(new Set())
  const [draftSwapRequestId, setDraftSwapRequestId] = useState<string | null>(null)
  const [swapRequestStatus, setSwapRequestStatus] = useState<string | null>(null)
  const [householdId, setHouseholdId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [reviewingBook, setReviewingBook] = useState<ReadBook | null>(null)
  const [reviewStars, setReviewStars] = useState(0)
  const [reviewCategories, setReviewCategories] = useState<Record<string, number>>({})
  const [reviewText, setReviewText] = useState('')
  const [reviewSaving, setReviewSaving] = useState(false)

  const universeRef = useRef<HTMLDivElement>(null)
  const roomScrollRef = useRef<HTMLDivElement>(null)
  const wishlistScrollRef = useRef<HTMLDivElement>(null)
  const readBooksScrollRef = useRef<HTMLDivElement>(null)
  const [wishlistHasMore, setWishlistHasMore] = useState(false)
  const [readBooksHasMore, setReadBooksHasMore] = useState(false)
  const bonkyHour = new Date().getHours()
  const isBonkyTime = bonkyHour >= 6 && bonkyHour < 19

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const [{ data: childData }, { data: hh }] = await Promise.all([
        supabase.from('child_profiles').select('id, name, nickname, avatar_id, date_of_birth, swap_permission, book_slot_allocation, books_read_count, reviews_count').eq('id', childId).single(),
        supabase.from('households').select('*, zones(bonkers_day, cutoff_time)').eq('user_id', user.id).single(),
      ])

      if (!childData || !hh) { router.push('/dashboard'); return }
      setChild(childData)
      setUserId(user.id)
      setHouseholdId(hh.id)
      setParentPinHash((hh as any).parent_pin_hash ?? null)
      const av = AVATARS.find((a: { id: string; emoji: string; bg: string }) => a.id === (hh as any).avatar_id)
      if (av) setParentAvatar(av)
      setParentName((hh as any).first_name ?? null)

      // delivery day + cutoff come from the household's zone (empty until a day is set)
      const { day, cutoffTime: zoneCutoff } = householdDeliveryDay(hh)
      setSwapDay(day ?? '')
      setCutoffTime(zoneCutoff)

      const { data: subData } = await supabase.from('subscriptions').select('subscription_plans(books_per_swap)').eq('household_id', hh.id).eq('status', 'active').maybeSingle()
      const plan = (subData as any)?.subscription_plans?.books_per_swap ?? 4
      setPlanBooks(plan)

      const { data: siblingsData } = await supabase.from('child_profiles').select('id, name, nickname, avatar_id').eq('household_id', hh.id).neq('id', childId).order('created_at')
      setSiblings(siblingsData || [])

      // Current loans (books at home)
      const { data: loansData } = await supabase.from('loans').select('id, status, return_requested, book_copies(books(id, title, cover_image_url, author))').eq('child_id', childId).in('status', ['checked_out', 'in_return_transit'])
      const loans: LoanItem[] = []
      for (const l of loansData || []) {
        const raw = (l as any).book_copies?.books
        if (raw) loans.push({ loanId: l.id, book: { ...raw, cover_url: raw.cover_image_url ?? null }, returnRequested: !!(l as any).return_requested, collected: (l as any).status === 'in_return_transit' })
      }
      setCurrentLoans(loans)
      // the parent may already have marked books as returning — show them that way here too
      setReturnMarked(new Set(loans.filter(l => l.returnRequested).map(l => l.loanId)))

      // Read books (returned loans)
      const { data: returnedData } = await supabase.from('loans').select('id, returned_at, book_copies(books(id, title, cover_image_url, author))').eq('child_id', childId).eq('status', 'returned').order('returned_at', { ascending: false })
      let reviewMap = new Map<string, number>()
      try {
        const { data: reviews } = await supabase.from('book_reviews').select('book_id, star_rating').eq('child_id', childId)
        for (const r of reviews || []) if (r.star_rating) reviewMap.set(r.book_id, r.star_rating)
      } catch {}
      const read: ReadBook[] = []
      for (const l of returnedData || []) {
        const raw = (l as any).book_copies?.books
        if (raw) read.push({ loanId: l.id, book: { ...raw, cover_url: raw.cover_image_url ?? null }, returnedAt: (l as any).returned_at ?? null, rating: reviewMap.get(raw.id) ?? null })
      }
      setReadBooks(read)

      // Swap request items for Coming Next (draft = editable, submitted = approved/locked)
      const { data: activeReq } = await supabase.from('swap_requests').select('id, status').eq('household_id', hh.id).eq('child_id', childId).in('status', ['draft', 'child_confirmed', 'submitted']).order('created_at', { ascending: false }).limit(1).maybeSingle()
      if (activeReq) {
        setSwapRequestStatus(activeReq.status)
        setDraftSwapRequestId(activeReq.id)
        const { data: items } = await supabase.from('swap_request_items').select('books(id, title, cover_image_url, author)').eq('swap_request_id', activeReq.id)
        const all = items || []
        setTotalDraftCount(all.length)
        setDraftItems((all as any[]).map(i => ({ book: i.books ? { ...i.books, cover_url: i.books.cover_image_url ?? null } : null })).filter(i => i.book))
      }

      // Wishlist
      try {
        const { data: wishData } = await supabase.from('child_wishlist_items').select('id, books(id, title, cover_image_url, author)').eq('child_id', childId).order('created_at', { ascending: false })
        const wl = ((wishData || []) as any[]).map(w => ({ id: w.id, book: w.books ? { ...w.books, cover_url: w.books.cover_image_url ?? null } : null })).filter(w => w.book)
        setWishlist(wl)
        const wishBookIds = wl.map((w: any) => w.book.id)
        if (wishBookIds.length > 0) {
          const { data: availCopies } = await supabase.from('book_copies').select('book_id').in('book_id', wishBookIds).eq('status', 'available')
          setAvailableWishlistIds(new Set((availCopies || []).map((c: any) => c.book_id)))
        }
        const { data: notifData } = await supabase.from('book_availability_notifications').select('book_id').eq('user_id', user.id)
        if (notifData) setNotifyingBookIds(new Set(notifData.map((n: any) => n.book_id)))
      } catch {}

      // Bonkers Picks: books in same categories as most borrowed, not already read, within age group
      try {
        const age = childData.date_of_birth ? Math.floor((Date.now() - new Date(childData.date_of_birth).getTime()) / (1000 * 60 * 60 * 24 * 365.25)) : null
        const readBookIds = read.map(r => r.book.id)
        const { data: catLoans } = await supabase.from('loans').select('book_copies(book_id)').eq('child_id', childId)
        const borrowedBookIds = [...new Set(((catLoans || []) as any[]).map(l => l.book_copies?.book_id).filter(Boolean))]
        if (borrowedBookIds.length > 0) {
          const { data: topCats } = await supabase.from('book_categories').select('category_id').in('book_id', borrowedBookIds)
          const catCount = new Map<string, number>()
          for (const c of (topCats || []) as any[]) catCount.set(c.category_id, (catCount.get(c.category_id) || 0) + 1)
          const sortedCats = [...catCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(e => e[0])
          if (sortedCats.length > 0) {
            let query = supabase.from('books').select('id, title, cover_image_url, author').limit(10)
            if (age !== null) { query = query.gte('min_age', Math.max(0, age - 2)).lte('min_age', age + 2) }
            const { data: pickCandidates } = await query
            const candidateIds = (pickCandidates || []).map((b: any) => b.id).filter((id: string) => !readBookIds.includes(id))
            if (candidateIds.length > 0) {
              const { data: catFiltered } = await supabase.from('book_categories').select('book_id').in('category_id', sortedCats).in('book_id', candidateIds)
              const pickIds = [...new Set(((catFiltered || []) as any[]).map(b => b.book_id))]
              const picks = (pickCandidates || []).filter((b: any) => pickIds.includes(b.id)).slice(0, 8).map((b: any) => ({ ...b, cover_url: b.cover_image_url ?? null }))
              setPicksBooks(picks)
            }
          }
        }
      } catch {}

      setLoading(false)
      setTimeout(() => {
        if (wishlistScrollRef.current) setWishlistHasMore(wishlistScrollRef.current.scrollWidth > wishlistScrollRef.current.clientWidth)
        if (readBooksScrollRef.current) setReadBooksHasMore(readBooksScrollRef.current.scrollWidth > readBooksScrollRef.current.clientWidth)
      }, 100)
    }
    load()
    window.addEventListener('focus', load)
    const channel = supabase.channel('child-profile-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'swap_request_items' }, load)
      .subscribe()
    return () => { window.removeEventListener('focus', load); supabase.removeChannel(channel) }
  }, [childId])

  useEffect(() => {
    if (universeRef.current) {
      const el = universeRef.current
      el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2
    }
  }, [loading])

  useEffect(() => {
    let active = true
    let timer: ReturnType<typeof setTimeout>
    function toggle(next: 'forward' | 'side') {
      if (!active) return
      setBonkyLooking(next)
      const hold = next === 'forward' ? 7000 : 5000
      timer = setTimeout(() => toggle(next === 'forward' ? 'side' : 'forward'), hold)
    }
    timer = setTimeout(() => toggle('side'), 7000)
    return () => { active = false; clearTimeout(timer) }
  }, [])

  useEffect(() => {
    let active = true
    let timer: ReturnType<typeof setTimeout>
    function breathe() {
      if (!active) return
      setBonkyBreathing(true)
      timer = setTimeout(() => {
        if (!active) return
        setBonkyBreathing(false)
        timer = setTimeout(() => { if (active) breathe() }, 3000)
      }, 1000)
    }
    timer = setTimeout(breathe, 1000)
    return () => { active = false; clearTimeout(timer) }
  }, [])

  useEffect(() => {
    let active = true
    let timer: ReturnType<typeof setTimeout>
    function scheduleBlink() {
      if (!active) return
      const delay = 3000 + Math.random() * 5000
      timer = setTimeout(() => {
        if (!active) return
        setBonkyBlink(true)
        setTimeout(() => { if (active) setBonkyBlink(false) }, 150)
        scheduleBlink()
      }, delay)
    }
    scheduleBlink()
    return () => { active = false; clearTimeout(timer) }
  }, [])

  useEffect(() => {
    let active = true
    function cycle() {
      if (!active) return
      const count = Math.random() < 0.5 ? 3 : 2
      const batch = Array.from({ length: count }, () => ({
        left: 5 + Math.random() * 40,
        rot: Math.round(-25 + Math.random() * 50),
      }))
      setBonkyZs(batch)
      setBonkyZKey(k => k + 1)
      setTimeout(() => { if (active) setBonkyZs([]) }, 2600)
      const pause = 3500 + Math.random() * 4000
      setTimeout(() => { if (active) cycle() }, pause)
    }
    setTimeout(cycle, 1500 + Math.random() * 1500)
    return () => { active = false }
  }, [])

  const toggleReturn = async (loanId: string) => {
    const nowReturning = !returnMarked.has(loanId)
    setReturnMarked(prev => { const n = new Set(prev); nowReturning ? n.add(loanId) : n.delete(loanId); return n })
    await supabase.from('loans').update({ return_requested: nowReturning }).eq('id', loanId)
  }

  const removeFromWishlist = async (wishlistItemId: string) => {
    setWishlist(prev => prev.filter(w => w.id !== wishlistItemId))
    await supabase.from('child_wishlist_items').delete().eq('id', wishlistItemId)
  }

  const quickAddToDelivery = async (bookId: string, bookTitle: string, coverUrl: string | null) => {
    let reqId = draftSwapRequestId
    if (!reqId && householdId) {
      const { data: newReq, error: reqErr } = await supabase.from('swap_requests').insert({ household_id: householdId, child_id: childId, status: 'draft' }).select('id').single()
      if (reqErr) { console.error('swap_request create failed:', reqErr); return }
      if (newReq) { setDraftSwapRequestId(newReq.id); setSwapRequestStatus('draft'); reqId = newReq.id }
    }
    if (!reqId) return
    // RLS requires draft status for inserts — reset if child_confirmed or submitted
    if (swapRequestStatus === 'submitted' || swapRequestStatus === 'child_confirmed') {
      await supabase.from('swap_requests').update({ status: 'draft' }).eq('id', reqId)
      setSwapRequestStatus('draft')
    }
    const { error: itemErr } = await supabase.from('swap_request_items').insert({ swap_request_id: reqId, book_id: bookId, child_id: childId })
    if (itemErr && itemErr.code !== '23505') { console.error('swap_request_items insert failed:', itemErr); return }
    setDraftItems(prev => {
      if (prev.some(d => d.book.id === bookId)) return prev
      return [...prev, { book: { id: bookId, title: bookTitle, cover_url: coverUrl, author: null } }]
    })
  }

  const sendToParent = async () => {
    if (!draftSwapRequestId) return
    await supabase.from('swap_requests').update({ status: 'child_confirmed' }).eq('id', draftSwapRequestId)
    setSwapRequestStatus('child_confirmed')
  }

  const takeBack = async () => {
    if (!draftSwapRequestId) return
    await supabase.from('swap_requests').update({ status: 'draft' }).eq('id', draftSwapRequestId)
    setSwapRequestStatus('draft')
  }

  const submitSwap = async () => {
    if (!draftSwapRequestId) return
    await supabase.from('swap_requests').update({ status: 'submitted' }).eq('id', draftSwapRequestId)
    setSwapRequestStatus('submitted')
  }

  const unsubmitSwap = async () => {
    if (!draftSwapRequestId) return
    await supabase.from('swap_requests').update({ status: 'draft' }).eq('id', draftSwapRequestId)
    setSwapRequestStatus('draft')
  }

  const quickToggleNotify = async (bookId: string) => {
    if (!userId) return
    const isNowNotifying = notifyingBookIds.has(bookId)
    setNotifyingBookIds(prev => { const n = new Set(prev); isNowNotifying ? n.delete(bookId) : n.add(bookId); return n })
    if (isNowNotifying) {
      await supabase.from('book_availability_notifications').delete().eq('user_id', userId).eq('book_id', bookId)
    } else {
      await supabase.from('book_availability_notifications').insert({ user_id: userId, book_id: bookId })
    }
  }

  const openReview = async (rb: ReadBook) => {
    setReviewStars(rb.rating ?? 0)
    setReviewCategories({})
    setReviewText('')
    const { data } = await supabase.from('book_reviews').select('star_rating, review_text, category_ratings').eq('child_id', childId).eq('book_id', rb.book.id).maybeSingle()
    if (data) {
      setReviewStars(data.star_rating ?? 0)
      setReviewText(data.review_text ?? '')
      setReviewCategories((data.category_ratings as Record<string, number>) ?? {})
    }
    setReviewingBook(rb)
  }

  const saveReview = async () => {
    if (!reviewingBook) return
    setReviewSaving(true)
    const payload = { child_id: childId, book_id: reviewingBook.book.id, star_rating: reviewStars || null, review_text: reviewText || null, category_ratings: Object.keys(reviewCategories).length ? reviewCategories : null }
    const { data: existing } = await supabase.from('book_reviews').select('id').eq('child_id', childId).eq('book_id', reviewingBook.book.id).maybeSingle()
    if (existing) {
      await supabase.from('book_reviews').update(payload).eq('id', existing.id)
    } else {
      await supabase.from('book_reviews').insert(payload)
    }
    setReadBooks(prev => prev.map(r => r.loanId === reviewingBook.loanId ? { ...r, rating: reviewStars || null } : r))
    setReviewSaving(false)
    setReviewingBook(null)
  }

  const childName = child?.nickname || child?.name || '...'
  const avatar = AVATARS.find(a => a.id === child?.avatar_id)
  const booksRead = child?.books_read_count ?? 0
  const canPickBooks = child?.swap_permission === 'independent_submit' || child?.swap_permission === 'prepare_only'
  const canIndependentSwap = canPickBooks


  // Books on the way slot calculation
  const hasAllocation = (child?.book_slot_allocation ?? 0) > 0
  const emptySlotCount = hasAllocation
    ? Math.max(0, (child!.book_slot_allocation!) - draftItems.length)
    : Math.max(0, planBooks - totalDraftCount)

  const { dayName, dateStr, isToday } = getNextBonkersDate(swapDay)

  const cutoffPassed = (() => {
    if (!swapDay || !cutoffTime) return false
    const days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday']
    const swapIdx = days.indexOf(swapDay.toLowerCase())
    if (swapIdx === -1) return false
    const cutoffDayIdx = (swapIdx - 2 + 7) % 7
    const [h, m] = cutoffTime.split(':').map(Number)
    const now = new Date()
    const cutoff = new Date(now)
    cutoff.setHours(h, m, 0, 0)
    let daysBack = (now.getDay() - cutoffDayIdx + 7) % 7
    if (daysBack === 0 && cutoff > now) daysBack = 7
    cutoff.setDate(now.getDate() - daysBack)
    return now >= cutoff
  })()
  const effectiveStatus = swapRequestStatus === 'submitted' && cutoffPassed ? 'locked' : swapRequestStatus

  const shelf = (title: string, count?: number) => (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '14px' }}>
      <p style={{ fontFamily: 'var(--font-amatic)', fontWeight: 700, fontSize: '1.9rem', color: '#eddbc3', letterSpacing: '0.04em', margin: 0 }}>{title}</p>
      {count !== undefined && <p style={{ fontFamily: 'var(--font-cormorant), serif', color: 'rgba(237,219,195,0.45)', fontSize: '1rem', fontWeight: 700, margin: 0 }}>{count}</p>}
    </div>
  )

  const emptyMsg = (msg: string) => (
    <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: 'rgba(237,219,195,0.3)', fontSize: '0.8rem', margin: '0 0 8px' }}>{msg}</p>
  )

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#fefaf2' }}>
        <p style={{ fontFamily: 'var(--font-cormorant), serif', color: '#1a2f51', fontSize: '1.5rem' }}>Loading...</p>
      </main>
    )
  }

  function tryParentNav(url: string) {
    setShowSwitcher(false)
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
    <main className="min-h-screen" style={{ backgroundColor: '#fefaf2', position: 'relative' }}>
      <style>{`
        .ghost-grid { display: grid; gap: 10px; grid-template-columns: repeat(2, 1fr); }
        @media (min-width: 600px) { .ghost-grid { grid-template-columns: repeat(4, 1fr); } }
        .action-img-lg { width: 200px; }
        .action-img-sm { width: 120px; }
        @media (min-width: 600px) { .action-img-lg { width: 280px; } .action-img-sm { width: 180px; } }
        .action-pill-wrap { padding: 20px 0; }
        @media (min-width: 768px) { .action-pill-wrap { padding: 36px 0; } }
        .action-pill-wrap.send-to-parent { padding-top: 16px; }
        @media (min-width: 768px) { .action-pill-wrap.send-to-parent { padding-top: 16px; } }
        .action-whisker { height: 40px; }
        @media (min-width: 768px) { .action-whisker { height: 64px; } }
        .delivery-star { transform-origin: center; }
        @media (max-width: 767px) { .delivery-star { transform: scale(0.55) !important; } }
        .action-pill { padding: 16px 28px; }
        @media (min-width: 768px) { .action-pill { padding: 22px 32px; } }
        .action-pill-sm { padding: 10px 18px; }
        @media (min-width: 768px) { .action-pill-sm { padding: 13px 22px; } }
      `}</style>

      {/* ── TOP BAR ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 20px 0', position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 }}>
        <div style={{ lineHeight: 1 }}>
          <p style={{ fontFamily: 'var(--font-amatic)', fontWeight: 700, fontSize: '2.4rem', color: '#eddbc3', letterSpacing: '0.04em', margin: 0 }}>BONKERS</p>
          <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600, fontSize: '0.45rem', color: '#eddbc3', letterSpacing: '0.18em', textTransform: 'uppercase', margin: '2px 0 0' }}>THE CHILDREN&apos;S LIBRARY</p>
        </div>
        <button onClick={() => setShowSwitcher(o => !o)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          <div style={{ width: '3rem', height: '3rem', borderRadius: '50%', backgroundColor: avatar?.bg || 'rgba(237,219,195,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.7rem', flexShrink: 0, border: '2px solid rgba(237,219,195,0.25)' }}>
            {avatar?.emoji || childName[0]}
          </div>
          <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600, fontSize: '0.55rem', color: '#f9d174', letterSpacing: '0.12em', textTransform: 'uppercase', lineHeight: 1 }}>{childName}</span>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#f9d174" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'transform 0.2s', transform: showSwitcher ? 'rotate(180deg)' : 'none' }}><polyline points="6 9 12 15 18 9"/></svg>
        </button>
      </div>

      {/* ── SPACE UNIVERSE ── */}
      <section className="universe-section" style={{ marginTop: '0', position: 'relative', height: 'calc(100dvh - 56px - env(safe-area-inset-bottom, 0px))', overflow: 'hidden' }}>
        <style>{`.universe-inner::-webkit-scrollbar{display:none} @keyframes bonky-z{0%{opacity:0;transform:translateY(0) scale(0.8)}15%{opacity:1}85%{opacity:1}100%{opacity:0;transform:translateY(-32px) scale(1.1)}} @media(max-width:767px){.universe-section{height:55vh!important;min-height:0!important}} @media(min-width:768px){.universe-section{height:auto!important}.universe-wrapper{position:relative!important;inset:unset!important;width:100%!important}.universe-inner{height:auto!important;overflow-x:hidden!important;width:100%!important}.universe-canvas{height:auto!important;width:100%!important;display:block!important}.universe-layer4{width:100%!important;height:auto!important}.universe-img{width:100%!important;height:auto!important;max-width:100%!important}.universe-content{padding-left:44px!important;padding-right:44px!important}}`}</style>

        {/* Universe view */}
        <div className="universe-wrapper" style={{ position: 'absolute', inset: 0, opacity: insideHouse ? 0 : 1, transform: insideHouse ? 'scale(1.5)' : 'scale(1)', transformOrigin: '33% 55%', transition: 'transform 0.55s ease-in-out, opacity 0.55s ease-in-out', pointerEvents: insideHouse ? 'none' : 'auto' }}>
        <div ref={universeRef} className="universe-inner" style={{ height: '100%', overflowX: 'auto', scrollbarWidth: 'none', cursor: 'grab', display: 'flex', justifyContent: 'center' }}>

          {/* Virtual universe canvas — width set by image content */}
          <div className="universe-canvas" style={{ height: '100%', position: 'relative', display: 'inline-block', flexShrink: 0 }}>

            {/* ── LAYER 1: Base atmospheric background ── */}
            <div style={{ position: 'absolute', inset: 0, backgroundColor: '#080402' }} />

            {/* ── LAYER 2: Stars + floating creatures — added later ── */}
            <div style={{ position: 'absolute', inset: 0 }} />

            {/* ── LAYER 3: Distant clouds / nebulae — empty, added later ── */}
            <div style={{ position: 'absolute', inset: 0 }} />

            {/* ── LAYER 4: Destination worlds ── */}
            <div className="universe-layer4" style={{ position: 'relative', height: '100%' }}>
              {/* Bonky's Home — sets the canvas width */}
              <img
                src="/universe_bonky_home.png"
                alt="Bonky's Home"
                className="universe-img"
                style={{
                  display: 'block',
                  height: '100%',
                  width: 'auto',
                  maxWidth: 'none',
                  pointerEvents: 'none',
                }}
              />
              {/* Bonky's door — tap to open */}
              <div
                onClick={() => { if (doorOpen || insideHouse) return; setDoorOpen(true); setTimeout(() => { setInsideHouse(true); setDoorOpen(false); setTimeout(() => { if (roomScrollRef.current) { const el = roomScrollRef.current; el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2 } }, 50) }, 700) }}
                style={{ position: 'absolute', left: '32.5%', top: '46.5%', height: '12.5%', cursor: 'pointer' }}
              >
                <img
                  src="/bonkyhouse_opendoor.png"
                  alt=""
                  style={{ height: '100%', width: 'auto', opacity: doorOpen ? 1 : 0, transition: doorOpen ? 'opacity 0.2s ease' : 'opacity 0.6s ease', pointerEvents: 'none', display: 'block' }}
                />
              </div>

              {/* Bonky reading on the cushions — 6am to 7pm only */}
              {isBonkyTime && <div style={{ position: 'absolute', left: '41%', top: '49%', height: '15%', transform: 'translateX(-50%)', pointerEvents: 'none' }}>
                {/* Base body — always visible */}
                <img src="/bonky_reading2.png" alt="" style={{ display: 'block', height: '100%', width: 'auto', pointerEvents: 'none' }} />
                {/* Side glance overlay */}
                <img src="/bonky_reading3.png" alt="" style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: 'auto', opacity: bonkyLooking === 'side' && !bonkyBlink ? 1 : 0, display: 'block', pointerEvents: 'none' }} />
                {/* Blink overlay — sits on top of whichever look is active */}
                <img src="/bonky_reading5.png" alt="" style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: 'auto', opacity: bonkyBlink ? 1 : 0, display: 'block', pointerEvents: 'none' }} />
              </div>}

              {/* Bonky sleeping in hammock — 7pm to 6am */}
              {!isBonkyTime && (
                <div style={{ position: 'absolute', left: '13%', top: '41%', height: '9%', pointerEvents: 'none' }}>
                  <img src="/bonky_sleeping1.png" alt="" style={{ display: 'block', height: '100%', width: 'auto', pointerEvents: 'none', transform: 'translateZ(0)' }} />
                  <img src="/bonky_sleeping2.png" alt="" style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: 'auto', display: 'block', opacity: bonkyBreathing ? 1 : 0, transition: 'opacity 0.8s ease-in-out', pointerEvents: 'none', transform: 'translateZ(0)', willChange: 'opacity' }} />
                  {bonkyZs.map((z, i) => (
                    <span key={`${bonkyZKey}-${i}`} style={{ position: 'absolute', top: `${5 + i * 8}%`, left: `${z.left}%`, fontFamily: 'var(--font-amatic)', fontWeight: 700, fontSize: '0.6rem', color: '#c9b8e8', pointerEvents: 'none', animation: 'bonky-z 2.5s ease-out forwards', transform: `rotate(${z.rot}deg)`, display: 'inline-block', lineHeight: 1 }}>z</span>
                  ))}
                </div>
              )}
            </div>


            {/* ── LAYER 5: Connections (ladders, bridges) — empty, added later ── */}
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />

            {/* ── LAYER 6: Foreground clouds / atmosphere — empty, added later ── */}
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />

            {/* ── LAYER 7: Interactive effects — empty, added later ── */}
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />

          </div>
        </div>
        </div>{/* end universe wrapper */}

        {/* Room view */}
        <div style={{ position: 'absolute', inset: 0, opacity: insideHouse ? 1 : 0, transform: insideHouse ? 'scale(1)' : 'scale(1.2)', transformOrigin: '90% 50%', transition: 'transform 0.55s ease-in-out, opacity 0.55s ease-in-out', pointerEvents: insideHouse ? 'auto' : 'none' }}>
          <div ref={roomScrollRef} style={{ height: '100%', overflowX: 'auto', scrollbarWidth: 'none' }}>
            <div style={{ height: '100%', position: 'relative', display: 'inline-block', flexShrink: 0 }} onClick={() => setRoomSpineSelected(null)}>
              <img src="/bonkyhouse_room.png" alt="" style={{ display: 'block', height: '100%', width: 'auto', maxWidth: 'none', pointerEvents: 'none' }} />
              {/* Books on shelf — spine fills each slot as child returns books */}
              {[...readBooks].reverse().slice(0, BOOK_SLOTS.length).map((rb, i) => (
                <img
                  key={rb.loanId}
                  src={`/spines/layer%20${i + 1}.png`}
                  alt=""
                  onClick={e => { e.stopPropagation(); setRoomSpineSelected(roomSpineSelected === i ? null : i) }}
                  style={{ position: 'absolute', left: BOOK_SLOTS[i].l, top: BOOK_SLOTS[i].t, height: BOOK_SLOTS[i].h, width: 'auto', display: 'block', cursor: 'pointer' }}
                />
              ))}
              {/* Spine popup */}
              {roomSpineSelected !== null && (() => {
                const reversedBooks = [...readBooks].reverse()
                const rb = reversedBooks[roomSpineSelected]
                const spineLeft = parseFloat(BOOK_SLOTS[roomSpineSelected].l)
                const spineTop = parseFloat(BOOK_SLOTS[roomSpineSelected].t)
                const popupLeft = spineLeft > 60 ? spineLeft - 20 : spineLeft + 3
                const popupTop = Math.max(1, spineTop - 3)
                return (
                  <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', left: `${popupLeft}%`, top: `${popupTop}%`, width: '18%', backgroundColor: 'rgba(12,6,2,0.95)', border: '1px solid rgba(237,219,195,0.25)', borderRadius: '10px', padding: '10px 10px 12px', zIndex: 20, boxShadow: '0 8px 24px rgba(0,0,0,0.7)' }}>
                    <p style={{ fontFamily: 'var(--font-amatic)', fontWeight: 700, fontSize: '0.8rem', color: '#f9d174', margin: '0 0 5px', lineHeight: 1 }}>Book {roomSpineSelected + 1}</p>
                    {rb ? (
                      <>
                        <TapButton onTap={() => router.push(`/dashboard/library/${rb.book.id}?from=child&childId=${childId}`)} style={{ width: '100%', textAlign: 'left' }}>
                          {rb.book.cover_url && <img src={rb.book.cover_url} alt="" style={{ width: '100%', borderRadius: '6px', display: 'block', marginBottom: '6px' }} />}
                          <p style={{ fontFamily: 'var(--font-cormorant), serif', fontWeight: 700, fontSize: '0.8rem', color: '#eddbc3', margin: '0 0 2px', lineHeight: 1.3 }}>{rb.book.title}</p>
                          {rb.book.author && <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.48rem', color: 'rgba(237,219,195,0.45)', margin: '0 0 4px', letterSpacing: '0.03em' }}>{rb.book.author}</p>}
                        </TapButton>
                        {rb.returnedAt && <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.45rem', color: 'rgba(237,219,195,0.35)', margin: '0 0 6px', letterSpacing: '0.03em' }}>Read {new Date(rb.returnedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>}
                        <button onClick={() => router.push(`/dashboard/children/${childId}/reviews?bookId=${rb.book.id}`)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', gap: '2px' }}>
                          {[1,2,3,4,5].map(s => (
                            <span key={s} style={{ fontSize: '0.7rem', opacity: rb.rating !== null ? (s <= rb.rating! ? 1 : 0.2) : 0.25 }}>⭐</span>
                          ))}
                        </button>
                      </>
                    ) : (
                      <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.5rem', color: 'rgba(237,219,195,0.35)', margin: 0 }}>No book data yet</p>
                    )}
                  </div>
                )
              })()}

              {/* Exit door — tap to go back outside */}
              <div onClick={() => setInsideHouse(false)} style={{ position: 'absolute', right: 0, top: '20%', width: '16%', height: '78%', cursor: 'pointer' }} />
            </div>
          </div>
        </div>

        {/* Enter My World button */}
        <button onClick={() => router.push(`/dashboard/children/${childId}/universe`)} style={{ position: 'absolute', bottom: '120px', right: '12px', zIndex: 20, background: 'rgba(8,4,2,0.6)', border: '1px solid rgba(237,219,195,0.3)', borderRadius: '20px', padding: '7px 13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#eddbc3" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
          <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.6rem', color: '#eddbc3', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Enter My World</span>
        </button>

      </section>

      <style>{`@media(max-width:767px){.cloud-border{top:-80px!important;margin-bottom:-80px!important}} @media(max-width:1024px){.universe-content{padding-top:0px!important;margin-top:-32px!important}}`}</style>
      <img src="/cloudborder.png" alt="" className="cloud-border" style={{ display: 'block', width: '100%', position: 'relative', top: '-205px', marginBottom: '-205px', pointerEvents: 'none', zIndex: 2 }} />

      <div className="universe-content" style={{ padding: '32px 20px 7rem', backgroundColor: '#fefaf2' }}>

        {/* ── HELLO + NEXT BONKERS DAY ── */}
        <h1 style={{ fontFamily: 'var(--font-cormorant), serif', color: '#1a2f51', fontSize: '2.8rem', fontWeight: 700, lineHeight: 1, marginTop: '24px', marginBottom: '16px', textAlign: 'center' }}>Hello, {childName}!</h1>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600, fontSize: '0.65rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#1a2f51', margin: '0 0 4px' }}>Your next Bonkers Day is</p>
          {swapDay ? (
            <>
              <p style={{ fontFamily: 'var(--font-cormorant), serif', color: '#1a2f51', fontSize: '1.8rem', fontWeight: 700, lineHeight: 1, margin: '0 0 6px' }}>{isToday ? 'Today!' : `${dayName} ${dateStr}`}</p>
              {!isToday && <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.72rem', color: '#1a2f51', opacity: 0.65, margin: 0 }}>Choose your books by {getChooseCutoffDay(swapDay)} at {formatCutoffTime(cutoffTime)}</p>}
            </>
          ) : (
            <>
              <p style={{ fontFamily: 'var(--font-cormorant), serif', color: '#1a2f51', fontSize: '1.8rem', fontWeight: 700, lineHeight: 1, margin: '0 0 6px' }}>Coming soon</p>
              <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.72rem', color: '#1a2f51', opacity: 0.65, margin: 0 }}>We’ll let you know your delivery day very soon.</p>
            </>
          )}
        </div>

        {character.slot === 'below-cutoff' && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '-32px', marginBottom: '16px' }}>
            <img src={character.src} alt="" className="child-character" style={{ width: 'auto', pointerEvents: 'none' }} />
          </div>
        )}

        {/* ── BOOKS AT HOME ── */}
        {character.slot === 'default' && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '0 0 8px' }}>
            <img src={character.src} alt="" className="child-character" style={{ width: 'auto', pointerEvents: 'none' }} />
          </div>
        )}
        {character.slot === 'on-books-at-home' && (
          <div className="child-character-sm-wrap" style={{ display: 'flex', justifyContent: 'center', marginBottom: '-32px', position: 'relative', zIndex: 1 }}>
            <img src={character.src} alt="" className="child-character-sm" style={{ width: 'auto', pointerEvents: 'none' }} />
          </div>
        )}

        <section style={{ marginBottom: '16px', marginTop: '16px' }}>
          {effectiveStatus === 'locked' && currentLoans.length > 0 ? (() => {
            const keepingLoans = currentLoans.filter(l => !returnMarked.has(l.loanId))
            const returningLoans = currentLoans.filter(l => returnMarked.has(l.loanId))
            const showReturning = returningLoans.length > 0
            const showKeeping = keepingLoans.length > 0
            const showBoth = showReturning && showKeeping
            return (
              <div style={{ border: '2px solid #e8e0d4', borderRadius: '16px', overflow: 'hidden', display: 'flex', minHeight: '120px' }}>
                {/* Returning side */}
                {showReturning && (
                  <div style={{ flex: 1, padding: '16px 12px', backgroundImage: 'url(/background_3.png)', backgroundSize: 'cover', backgroundPosition: 'center' }}>
                    <p style={{ fontFamily: 'var(--font-cormorant)', fontWeight: 700, fontSize: 'clamp(0.9rem, 3.5vw, 1.4rem)', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#eddbc3', margin: '0 0 6px' }}>Returning <span style={{ opacity: 0.45 }}>{returningLoans.length}</span></p>
                    <img src="/van.png" alt="" style={{ width: 'min(100%, 110px)', height: 'auto', display: 'block', marginBottom: '8px' }} />
                    <div className="ghost-grid" style={{ display: 'grid', gap: '8px', gridTemplateColumns: 'repeat(2, 1fr)' }}>
                      {returningLoans.map(loan => (
                        <div key={loan.loanId} style={{ aspectRatio: '3/4', borderRadius: '10px', overflow: 'hidden', backgroundColor: 'rgba(26,47,81,0.3)', border: '1.5px solid rgba(237,219,195,0.2)' }}>
                          {loan.book.cover_url
                            ? <img src={loan.book.cover_url} alt={loan.book.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.3 }}><svg width="16" height="16" viewBox="0 0 24 24" fill="#eddbc3"><path d="M6 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/></svg></div>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {/* Divider — only when both sides visible */}
                {showBoth && <div style={{ width: '2px', backgroundColor: '#e8e0d4', flexShrink: 0 }} />}
                {/* Keeping side */}
                {showKeeping && (
                  <div style={{ flex: 1, padding: '16px 12px', backgroundColor: 'rgba(210,230,245,0.25)' }}>
                    <p style={{ fontFamily: 'var(--font-cormorant)', fontWeight: 700, fontSize: 'clamp(0.9rem, 3.5vw, 1.4rem)', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#1a2f51', margin: '0 0 10px' }}>Keeping <span style={{ opacity: 0.45 }}>{keepingLoans.length}</span></p>
                    <div className="ghost-grid" style={{ display: 'grid', gap: '8px', gridTemplateColumns: 'repeat(2, 1fr)' }}>
                      {keepingLoans.map(loan => (
                        <div key={loan.loanId} style={{ aspectRatio: '3/4', borderRadius: '10px', overflow: 'hidden', backgroundColor: 'rgba(26,47,81,0.07)', border: '1.5px solid rgba(26,47,81,0.1)' }}>
                          {loan.book.cover_url
                            ? <img src={loan.book.cover_url} alt={loan.book.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.3 }}><svg width="16" height="16" viewBox="0 0 24 24" fill="#1a2f51"><path d="M6 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2"/></svg></div>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })() : (
          <div style={{ border: '2px solid #e8e0d4', borderRadius: '16px', padding: '20px 16px', backgroundColor: 'rgba(210,230,245,0.25)' }}>
            <p style={{ fontFamily: 'var(--font-cormorant), serif', fontWeight: 700, fontSize: '1.4rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#1a2f51', margin: '0 0 10px' }}>Books at Home {currentLoans.length > 0 && <span style={{ opacity: 0.45 }}>{currentLoans.length}</span>}</p>
            <div className="ghost-grid" style={{ display: 'grid', gap: '10px' }}>
              {currentLoans.map(loan => {
                const isReturn = returnMarked.has(loan.loanId)
                return (
                  <div key={loan.loanId} style={{ textAlign: 'center' }}>
                    <div style={{ aspectRatio: '3/4', borderRadius: '10px', overflow: 'hidden', backgroundColor: 'rgba(26,47,81,0.07)', border: `1.5px solid ${isReturn ? 'rgba(232,83,58,0.35)' : 'rgba(26,47,81,0.1)'}`, opacity: isReturn ? 0.5 : 1, transition: 'all 0.2s' }}>
                      {loan.book.cover_url
                        ? <img src={loan.book.cover_url} alt={loan.book.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.3 }}><svg width="16" height="16" viewBox="0 0 24 24" fill="#1a2f51"><path d="M6 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/></svg></div>
                      }
                    </div>
                    {loan.collected ? <span style={{ display: 'inline-block', marginTop: '5px', padding: '3px 8px', borderRadius: '20px', fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 700, fontSize: '0.52rem', letterSpacing: '0.04em', backgroundColor: '#eef1f8', color: '#1a2f51' }}>On its way back 🚐</span> : canIndependentSwap && (
                      <button onClick={() => toggleReturn(loan.loanId)} style={{ marginTop: '5px', padding: '3px 8px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 700, fontSize: '0.52rem', letterSpacing: '0.06em', backgroundColor: isReturn ? '#e8533a' : 'rgba(26,47,81,0.08)', color: isReturn ? '#fff' : 'rgba(26,47,81,0.45)', transition: 'all 0.2s' }}>
                        {isReturn ? 'Returning' : 'Keeping'}
                      </button>
                    )}
                  </div>
                )
              })}
              {Array.from({ length: Math.max(0, planBooks - currentLoans.length) }).map((_, i) => (
                <div key={i} style={{ aspectRatio: '3/4', borderRadius: '10px', border: '2px dashed rgba(26,47,81,0.2)', backgroundColor: 'transparent' }} />
              ))}
            </div>
          </div>
          )}
        </section>

        {/* ── COMING NEXT ── */}
        <section style={{ marginBottom: '16px' }}>
          <div style={{ border: '2px solid #e8e0d4', borderRadius: '16px', padding: '20px 16px', backgroundColor: child?.swap_permission === 'prepare_only' && effectiveStatus === 'submitted' ? 'rgba(72,199,142,0.12)' : 'rgba(255,240,150,0.08)', ...(effectiveStatus === 'locked' && draftItems.length > 0 ? { backgroundImage: 'url(/background_3.png)', backgroundSize: 'cover', backgroundPosition: 'center', border: '2px solid #1a2f51' } : {}) }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <p style={{ fontFamily: 'var(--font-cormorant), serif', fontWeight: 700, fontSize: '1.4rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: effectiveStatus === 'locked' && draftItems.length > 0 ? '#eddbc3' : '#1a2f51', margin: 0 }}>{isToday ? 'Coming Today' : 'Coming Next'} {draftItems.length > 0 && <span style={{ opacity: 0.45 }}>{draftItems.length}</span>}</p>
              {draftItems.length > 0 && effectiveStatus === 'submitted' && child?.swap_permission !== 'prepare_only' && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 10px', borderRadius: '20px', backgroundColor: 'rgba(80,200,120,0.12)', border: '1px solid rgba(80,200,120,0.35)' }}>
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#50c878" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#50c878', fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.08em' }}>Submitted</span>
                </div>
              )}
            </div>
            {/* Action / status pills under heading */}
            {draftItems.length > 0 && effectiveStatus === 'locked' && (
              <div className="action-pill-wrap" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <img src="/bonky_delivering2.png" alt="" className="action-img-lg" style={{ display: 'block' }} />
                  {[
                    { top: '-8%',  left: '0%',   size: 28, src: '/sparklestar_yellow.png',    rotate: 15  },
                    { top: '-12%', left: '38%',  size: 20, src: '/sparklestar_pink.png',      rotate: -10 },
                    { top: '-6%',  right: '-4%', size: 32, src: '/sparklestar_turquoise.png', rotate: 20  },
                    { top: '45%',  right: '-6%', size: 22, src: '/sparklestar_yellow.png',    rotate: -15 },
                    { bottom: '50%', left: '-28%', size: 24, src: '/sparklestar_pink.png',     rotate: 10  },
                    { top: '20%',  left: '-6%',  size: 18, src: '/sparklestar_purple.png',    rotate: -25 },
                    { bottom: '65%', right: '-28%', size: 26, src: '/sparklestar_purple.png',  rotate: 12  },
                  ].map((s, i) => (
                    <img key={i} src={s.src} alt="" width={s.size} height={s.size} className="delivery-star"
                      style={{ position: 'absolute', top: (s as any).top, left: (s as any).left, right: (s as any).right, bottom: (s as any).bottom, transform: `rotate(${s.rotate}deg)`, pointerEvents: 'none' }} />
                  ))}
                </div>
              </div>
            )}
            {child?.swap_permission === 'prepare_only' && draftItems.length > 0 && effectiveStatus === 'submitted' && (
              <div className="action-pill-wrap" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
                <img src="/approveda.png" alt="" className="action-img-lg" style={{ display: 'block' }} />
                <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 700, fontSize: '1.1rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#1a2f51' }}>Approved!</span>
              </div>
            )}
            {canPickBooks && child?.swap_permission === 'prepare_only' && effectiveStatus === 'draft' && draftItems.length > 0 && (
              <div className="action-pill-wrap send-to-parent" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0' }}>
                <img src="/sendtoparenta.png" alt="" className="action-img-lg" style={{ display: 'block', position: 'relative', zIndex: 1 }} />
                <div style={{ display: 'inline-flex', alignItems: 'center', marginTop: '-12px' }}>
                  <img src="/spines/whiskers_left_yellow.png" alt="" className="action-whisker" style={{ width: 'auto', flexShrink: 0, marginRight: '8px', pointerEvents: 'none' }} />
                  <button onClick={sendToParent} className="action-pill" style={{ backgroundColor: '#1a2f51', border: 'none', borderRadius: '999px', fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 500, fontSize: '0.9rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'white', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', WebkitTapHighlightColor: 'transparent', transition: 'transform 0.1s' }}
                    onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.96)')}
                    onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
                    onTouchStart={e => (e.currentTarget.style.transform = 'scale(0.96)')}
                    onTouchEnd={e => (e.currentTarget.style.transform = 'scale(1)')}>
                    Send to Parent
                  </button>
                  <img src="/spines/whiskers_right_yellow.png" alt="" className="action-whisker" style={{ width: 'auto', flexShrink: 0, marginLeft: '8px', pointerEvents: 'none' }} />
                </div>
              </div>
            )}
            {child?.swap_permission === 'prepare_only' && draftItems.length > 0 && effectiveStatus === 'child_confirmed' && (
              <div className="action-pill-wrap" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0' }}>
                <img src="/awaitingapprovala.png" alt="" className="action-img-lg" style={{ display: 'block', position: 'relative', zIndex: 1 }} />
                <div className="action-pill" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1a2f51', border: 'none', borderRadius: '999px', fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 500, fontSize: '0.9rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'white', marginTop: '-12px' }}>
                  Waiting for Parent
                </div>
                {canPickBooks && (
                  <button onClick={takeBack} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px', marginTop: '6px', color: '#1a2f51', WebkitTapHighlightColor: 'transparent', transition: 'transform 0.1s', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                    onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.9)')}
                    onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
                    onTouchStart={e => (e.currentTarget.style.transform = 'scale(0.9)')}
                    onTouchEnd={e => (e.currentTarget.style.transform = 'scale(1)')}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1a2f51" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-5.4"/>
                    </svg>
                    <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#1a2f51', marginLeft: '6px' }}>Undo</span>
                  </button>
                )}
              </div>
            )}
            <div className="ghost-grid" style={{ display: 'grid', gap: '10px' }}>
              {draftItems.map((item, i) => (
                <TapButton key={i} onTap={() => router.push(`/dashboard/library/${item.book.id}?from=child&childId=${childId}`)} style={{ display: 'block', width: '100%' }}>
                  <div style={{ aspectRatio: '3/4', borderRadius: '10px', overflow: 'hidden', backgroundColor: 'rgba(26,47,81,0.07)', border: '1px solid rgba(26,47,81,0.1)' }}>
                    {item.book.cover_url
                      ? <img src={item.book.cover_url} alt={item.book.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.3 }}><svg width="16" height="16" viewBox="0 0 24 24" fill="#1a2f51"><path d="M6 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/></svg></div>}
                  </div>
                </TapButton>
              ))}
              {canIndependentSwap && Array.from({ length: emptySlotCount }).map((_, i) => (
                <div key={i} style={{ aspectRatio: '3/4', borderRadius: '10px', border: '2px dashed rgba(26,47,81,0.3)', backgroundColor: 'transparent' }} />
              ))}
              {!canIndependentSwap && Array.from({ length: emptySlotCount }).map((_, i) => (
                <div key={i} style={{ aspectRatio: '3/4', borderRadius: '10px', border: '2px dashed rgba(26,47,81,0.2)', backgroundColor: 'transparent' }} />
              ))}
            </div>

            {/* Action buttons */}
            {canPickBooks && (
              <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                {child?.swap_permission === 'independent_submit' && (effectiveStatus === 'draft' || !effectiveStatus) && draftItems.length > 0 && (
                  <button onClick={submitSwap} style={{ width: '100%', padding: '11px', borderRadius: '12px', backgroundColor: '#1a2f51', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#f9d174' }}>
                    Submit
                  </button>
                )}
                {child?.swap_permission === 'independent_submit' && effectiveStatus === 'submitted' && (
                  <button onClick={unsubmitSwap} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.65rem', color: 'rgba(26,47,81,0.45)', textDecoration: 'underline', padding: '4px 0' }}>
                    Un-submit
                  </button>
                )}
              </div>
            )}
          </div>
        </section>

        {/* ── MY SAVED LIST ── */}
        <section style={{ marginBottom: '16px' }}>
          <div style={{ border: '2px solid #e8e0d4', borderRadius: '16px', padding: '20px 16px', backgroundColor: 'rgba(255,200,210,0.08)' }}>
            <p style={{ fontFamily: 'var(--font-cormorant), serif', fontWeight: 700, fontSize: '1.4rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#1a2f51', margin: '0 0 10px' }}>My Saved List {wishlist.length > 0 && <span style={{ opacity: 0.45 }}>{wishlist.length}</span>}</p>
            {(() => {
              const readBookIds = new Set(readBooks.map(r => r.book.id))
              const filtered = wishlist.filter(w => !readBookIds.has(w.book.id))
              return (
                <div style={{ position: 'relative' }}>
                <div ref={wishlistScrollRef} onScroll={() => { if (wishlistScrollRef.current) { const el = wishlistScrollRef.current; setWishlistHasMore(el.scrollLeft + el.clientWidth < el.scrollWidth - 8) } }} style={{ display: 'flex', gap: '8px', overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: '4px' }}>
                  {filtered.length === 0
                    ? Array.from({ length: planBooks }).map((_, i) => (
                        <div key={i} className="child-scroll-book" style={{ aspectRatio: '3/4', borderRadius: '10px', border: '2px dashed rgba(26,47,81,0.2)', backgroundColor: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="rgba(26,47,81,0.2)" stroke="rgba(26,47,81,0.2)" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                        </div>
                      ))
                    : filtered.map(w => {
                        const isAvail = availableWishlistIds.has(w.book.id)
                        const inDelivery = draftItems.some(d => d.book.id === w.book.id)
                        const isNotifying = notifyingBookIds.has(w.book.id)
                        return (
                          <div key={w.id} className="child-scroll-book" style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                            <TapButton onTap={() => router.push(`/dashboard/library/${w.book.id}?from=child&childId=${childId}`)} style={{ width: '100%' }}>
                              <div style={{ aspectRatio: '3/4', borderRadius: '10px', overflow: 'hidden', backgroundColor: 'rgba(26,47,81,0.07)', border: '1px solid rgba(26,47,81,0.1)' }}>
                                {w.book.cover_url
                                  ? <img src={w.book.cover_url} alt={w.book.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                  : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.3 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="#1a2f51"><path d="M6 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/></svg></div>
                                }
                              </div>
                            </TapButton>
                            {canIndependentSwap && (
                              isAvail ? (
                                <button onClick={() => { if (!inDelivery) quickAddToDelivery(w.book.id, w.book.title, w.book.cover_url) }}
                                  style={{ background: 'none', border: 'none', cursor: inDelivery ? 'default' : 'pointer', padding: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  {inDelivery
                                    ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#84a98c" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                                    : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(26,47,81,0.5)" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                                  }
                                </button>
                              ) : (
                                <button onClick={() => quickToggleNotify(w.book.id)}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill={isNotifying ? 'rgba(26,47,81,0.6)' : 'none'} stroke="rgba(26,47,81,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                                  </svg>
                                </button>
                              )
                            )}
                            <button onClick={() => removeFromWishlist(w.id)}
                              style={{ position: 'absolute', top: '-4px', right: '-4px', width: '18px', height: '18px', borderRadius: '50%', backgroundColor: '#1a2f51', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                          </div>
                        )
                      })
                  }
                </div>
                {wishlistHasMore && (
                  <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: '48px', background: 'linear-gradient(to right, transparent, #fefaf2)', borderRadius: '0 10px 10px 0', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: '6px', pointerEvents: 'none' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(26,47,81,0.5)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                  </div>
                )}
                </div>
              )
            })()}
          </div>
        </section>

        {/* TODO: Add "Bonkers' Picks" personalised recommendations section here post-launch */}

        {/* ── BOOKS I'VE READ ── */}
        <section style={{ marginBottom: '16px' }}>
          <div style={{ border: '2px solid #e8e0d4', borderRadius: '16px', padding: '20px 16px', backgroundColor: 'rgba(150,120,200,0.08)' }}>
            <p style={{ fontFamily: 'var(--font-cormorant), serif', fontWeight: 700, fontSize: '1.4rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#1a2f51', margin: '0 0 10px' }}>Books I&apos;ve Read {readBooks.length > 0 && <span style={{ opacity: 0.45 }}>{readBooks.length}</span>}</p>
            <div style={{ position: 'relative' }}>
              <div ref={readBooksScrollRef} onScroll={() => { if (readBooksScrollRef.current) { const el = readBooksScrollRef.current; setReadBooksHasMore(el.scrollLeft + el.clientWidth < el.scrollWidth - 8) } }} style={{ display: 'flex', gap: '8px', overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: '4px' }}>
                {readBooks.length === 0
                  ? Array.from({ length: planBooks }).map((_, i) => (
                      <div key={i} className="child-scroll-book" style={{ aspectRatio: '3/4', borderRadius: '10px', border: '2px dashed rgba(26,47,81,0.2)', backgroundColor: 'transparent' }} />
                    ))
                  : readBooks.map(rb => (
                      <div key={rb.loanId} className="child-scroll-book" style={{ position: 'relative' }}>
                        <button onClick={() => setSelectedSpine(selectedSpine?.loanId === rb.loanId ? null : rb)}
                          style={{ display: 'block', background: 'none', border: 'none', cursor: 'pointer', padding: 0, width: '100%' }}>
                          <div style={{ aspectRatio: '3/4', borderRadius: '10px', overflow: 'hidden', backgroundColor: 'rgba(26,47,81,0.07)', border: `1.5px solid ${selectedSpine?.loanId === rb.loanId ? '#fee297' : 'rgba(26,47,81,0.1)'}`, transition: 'border-color 0.15s' }}>
                            {rb.book.cover_url
                              ? <img src={rb.book.cover_url} alt={rb.book.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              : <div style={{ width: '100%', height: '100%', backgroundColor: spineColor(rb.book.id), display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px' }}>
                                  <p style={{ fontFamily: 'var(--font-cormorant), serif', color: '#fff', fontSize: '0.6rem', textAlign: 'center', margin: 0, lineHeight: 1.3 }}>{rb.book.title}</p>
                                </div>
                            }
                          </div>
                        </button>
                        <button onClick={() => openReview(rb)} style={{ position: 'absolute', bottom: '6px', right: '6px', width: '22px', height: '22px', borderRadius: '50%', backgroundColor: '#fff', border: '1.5px solid #e8e0d4', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#1a2f51" strokeWidth="1.8"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                        </button>
                      </div>
                    ))
                }
              </div>
              {readBooksHasMore && (
                <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: '48px', background: 'linear-gradient(to right, transparent, #fefaf2)', borderRadius: '0 10px 10px 0', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: '6px', pointerEvents: 'none' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(26,47,81,0.5)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                </div>
              )}
            </div>
            {selectedSpine && (
              <div style={{ marginTop: '12px', backgroundColor: '#fefaf2', border: '1px solid #e8e0d4', borderRadius: '14px', padding: '14px 16px', display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                {selectedSpine.book.cover_url && (
                  <TapButton onTap={() => router.push(`/dashboard/library/${selectedSpine.book.id}?from=child&childId=${childId}`)} style={{ flexShrink: 0 }}>
                    <img src={selectedSpine.book.cover_url} alt="" style={{ width: '52px', height: '70px', objectFit: 'cover', borderRadius: '6px', display: 'block' }} />
                  </TapButton>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <TapButton onTap={() => router.push(`/dashboard/library/${selectedSpine.book.id}?from=child&childId=${childId}`)} style={{ textAlign: 'left', width: '100%' }}>
                    <p style={{ fontFamily: 'var(--font-cormorant), serif', fontWeight: 700, fontSize: '1.05rem', color: '#1a2f51', margin: '0 0 2px', lineHeight: 1.3 }}>{selectedSpine.book.title}</p>
                    {selectedSpine.book.author && <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.62rem', color: 'rgba(26,47,81,0.45)', margin: '0 0 6px' }}>{selectedSpine.book.author}</p>}
                  </TapButton>
                  {selectedSpine.returnedAt && <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.6rem', color: 'rgba(26,47,81,0.4)', margin: '0 0 6px' }}>Read {new Date(selectedSpine.returnedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>}
                  <button onClick={() => router.push(`/dashboard/children/${childId}/reviews?bookId=${selectedSpine.book.id}`)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', gap: '3px', alignItems: 'center' }}>
                    {[1,2,3,4,5].map(s => (
                      <span key={s} style={{ fontSize: '0.85rem', opacity: selectedSpine.rating !== null ? (s <= selectedSpine.rating! ? 1 : 0.2) : 0.25 }}>⭐</span>
                    ))}
                    {selectedSpine.rating === null && <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.6rem', color: 'rgba(26,47,81,0.4)', margin: '0 0 0 4px' }}>Write a review</p>}
                  </button>
                </div>
                <button onClick={() => setSelectedSpine(null)} style={{ background: 'none', border: 'none', padding: '2px', cursor: 'pointer', flexShrink: 0, color: 'rgba(26,47,81,0.35)', fontSize: '1rem', lineHeight: 1 }}>✕</button>
              </div>
            )}
          </div>
        </section>

      </div>

      {/* ── BOTTOM NAV ── */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, backgroundColor: '#1a2f51', borderTop: 'none', zIndex: 55 }}>
        <div style={{ maxWidth: '576px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '8px 8px', paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}>
          {[
            { label: 'Home', icon: <svg className="nav-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>, onClick: () => router.push(`/dashboard/children/${childId}`), active: pathname === `/dashboard/children/${childId}` },
            { label: 'Library', icon: <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>, onClick: () => router.push(`/dashboard/library?from=child&childId=${childId}`), active: pathname.startsWith('/dashboard/library') },
          ].map(item => (
            <button key={item.label} onClick={item.onClick} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', padding: '4px 12px', background: 'none', border: 'none', cursor: 'pointer', color: item.active ? '#f9d174' : '#fefaf2', minWidth: '56px' }}>
              {item.icon}
              <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.6rem', letterSpacing: '0.06em', fontWeight: item.active ? 700 : 400 }}>{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── REVIEW CARD ── */}
      {reviewingBook && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(8,4,2,0.75)', zIndex: 60, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={() => setReviewingBook(null)}>
          <div onClick={e => e.stopPropagation()} style={{ backgroundColor: '#1a1008', borderRadius: '24px 24px 0 0', border: '1px solid rgba(237,219,195,0.15)', width: '100%', maxWidth: '576px', maxHeight: '88vh', overflowY: 'auto', padding: '24px 20px 40px', position: 'relative' }}>

            {/* X button */}
            <button onClick={() => setReviewingBook(null)} style={{ position: 'absolute', top: '16px', right: '16px', background: 'rgba(237,219,195,0.1)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#eddbc3', fontSize: '1rem' }}>✕</button>

            {/* Book header */}
            <div style={{ display: 'flex', gap: '14px', marginBottom: '22px', paddingRight: '36px' }}>
              {reviewingBook.book.cover_url && (
                <img src={reviewingBook.book.cover_url} alt="" style={{ width: '64px', height: '86px', objectFit: 'cover', borderRadius: '8px', flexShrink: 0 }} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontFamily: 'var(--font-cormorant), serif', fontWeight: 700, fontSize: '1.15rem', color: '#eddbc3', margin: '0 0 3px', lineHeight: 1.3 }}>{reviewingBook.book.title}</p>
                {reviewingBook.book.author && <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.65rem', color: 'rgba(237,219,195,0.5)', margin: '0 0 8px' }}>{reviewingBook.book.author}</p>}
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <div style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: '#4ade80', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                  <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.6rem', color: 'rgba(237,219,195,0.45)', margin: 0, letterSpacing: '0.06em' }}>READ</p>
                </div>
              </div>
            </div>

            {/* What did you think */}
            <p style={{ fontFamily: 'var(--font-amatic)', fontWeight: 700, fontSize: '1.6rem', color: '#eddbc3', margin: '0 0 12px', letterSpacing: '0.04em' }}>What did you think?</p>

            {/* Overall stars */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '22px' }}>
              {[1,2,3,4,5].map(s => (
                <button key={s} onClick={() => setReviewStars(s)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill={s <= reviewStars ? '#f9d174' : 'none'} stroke={s <= reviewStars ? '#f9d174' : 'rgba(237,219,195,0.35)'} strokeWidth="1.6"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                </button>
              ))}
            </div>

            {/* Category ratings */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '22px' }}>
              {REVIEW_CATEGORIES.map(cat => (
                <div key={cat.key} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600, fontSize: '0.68rem', color: 'rgba(237,219,195,0.7)', letterSpacing: '0.06em', width: '84px', flexShrink: 0, margin: 0 }}>{cat.label}</p>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {[1,2,3,4,5].map(v => (
                      <button key={v} onClick={() => setReviewCategories(prev => ({ ...prev, [cat.key]: prev[cat.key] === v ? 0 : v }))} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                        <div style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: v <= (reviewCategories[cat.key] ?? 0) ? '#eddbc3' : 'transparent', border: '1.5px solid rgba(237,219,195,0.35)', transition: 'background-color 0.15s' }} />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Text box */}
            <textarea
              value={reviewText}
              onChange={e => setReviewText(e.target.value)}
              placeholder="Anything else you want to say about this book..."
              style={{ width: '100%', minHeight: '80px', backgroundColor: 'rgba(237,219,195,0.05)', border: '1px solid rgba(237,219,195,0.2)', borderRadius: '12px', padding: '12px', fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.78rem', color: '#eddbc3', resize: 'none', outline: 'none', boxSizing: 'border-box', marginBottom: '16px' }}
            />

            {/* Save button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={saveReview} disabled={reviewSaving} style={{ backgroundColor: '#f9d174', color: '#080402', fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 700, fontSize: '0.75rem', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '10px 22px', borderRadius: '20px', border: 'none', cursor: 'pointer', opacity: reviewSaving ? 0.6 : 1 }}>
                {reviewSaving ? 'Saving…' : 'Save Review'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ── PROFILE SWITCHER DROPDOWN ── */}
      {showSwitcher && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60 }} onClick={() => setShowSwitcher(false)}>
          <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: '72px', right: '10px', width: 'min(260px, calc(100vw - 20px))', backgroundColor: '#fefaf2', borderRadius: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.55)', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px 10px', borderBottom: '1px solid rgba(26,47,81,0.1)' }}>
              <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 700, fontSize: '0.65rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#1a2f51', margin: 0 }}>Switch Profile</p>
            </div>
            <div style={{ padding: '6px 0' }}>
              {/* Siblings */}
              {siblings.map(sib => {
                const sibAv = AVATARS.find(a => a.id === sib.avatar_id)
                const sibName = sib.nickname || sib.name
                return (
                  <button key={sib.id} onClick={() => { setShowSwitcher(false); router.push(`/dashboard/children/${sib.id}`) }}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: sibAv?.bg || 'rgba(26,47,81,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', flexShrink: 0 }}>{sibAv?.emoji || sibName[0]}</div>
                    <p style={{ fontFamily: 'var(--font-cormorant), serif', fontWeight: 700, fontSize: '1.05rem', color: '#1a2f51', margin: 0 }}>{sibName}</p>
                  </button>
                )
              })}
              {/* Parent dashboard */}
              <button onClick={() => tryParentNav('/dashboard')}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: parentAvatar?.bg || 'rgba(26,47,81,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: parentAvatar ? '1rem' : '1rem', flexShrink: 0, fontFamily: 'var(--font-cormorant), serif', fontWeight: 700, color: '#1a2f51' }}>{parentAvatar?.emoji || (parentName?.[0]?.toUpperCase() ?? '?')}</div>
                <p style={{ fontFamily: 'var(--font-cormorant), serif', fontWeight: 700, fontSize: '1.05rem', color: '#1a2f51', margin: 0 }}>{parentName || 'Parent Dashboard'}</p>
              </button>
            </div>
            <div style={{ borderTop: '1px solid rgba(26,47,81,0.1)', padding: '6px 0' }}>
              <button onClick={async () => { setShowSwitcher(false); await supabase.auth.signOut(); router.push('/') }}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1a2f51" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.78rem', color: '#1a2f51', margin: 0, fontWeight: 600 }}>Log out</p>
              </button>
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

    </main>
  )
}
