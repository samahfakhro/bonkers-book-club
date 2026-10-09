'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import NotificationBell from '@/components/NotificationBell'
import { householdDeliveryDay } from '@/lib/delivery-day'

type Book = {
  id: string
  title: string
  cover_url: string | null
  author: string | null
}

type Loan = {
  loanId: string
  book: Book
  childId: string
  childName: string
  returnRequested: boolean
  collected?: boolean   // driver has collected it; waiting to be scanned back in at the warehouse
}

type NextStackBook = {
  id: string
  book: Book
  childId: string
  childName: string
}

type WishlistBook = {
  id: string
  title: string
  cover_image_url: string | null
}

type Child = {
  id: string
  first_name: string
  age: number | null
  interests: string | null
  avatar_id: string | null
  swap_permission: 'parent_only' | 'independent_submit' | 'prepare_only'
  swap_status: 'not_submitted' | 'child_confirmed_pending_approval' | 'submitted'
  swap_request_id: string | null
  books_read_count: number
  top_category: string | null
  book_allocation?: number
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

type Member = {
  id: string
  first_name: string
  email: string
  plan_books: number
  swap_day: string
  swap_cutoff_day: string
  swap_cutoff_time: string
  avatar_id: string | null
}

function getNextCutoff(swapDay: string, cutoffTime: string): Date {
  const days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday']
  const now = new Date()
  const swapIdx = days.indexOf(swapDay.toLowerCase())
  if (swapIdx === -1) return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  const cutoffDayIdx = (swapIdx - 2 + 7) % 7  // 2 days before Bonkers Day
  const [hours, minutes] = cutoffTime.split(':').map(Number)
  const result = new Date(now)
  result.setHours(hours, minutes, 0, 0)
  const diff = (cutoffDayIdx - now.getDay() + 7) % 7
  result.setDate(now.getDate() + (diff === 0 && result <= now ? 7 : diff))
  return result
}

function getNextBonkersDateParts(swapDay: string): { dayName: string; dateStr: string; isToday: boolean } {
  const days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday']
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December']
  const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
  const now = new Date()
  const targetDay = days.indexOf(swapDay.toLowerCase())
  if (targetDay === -1) return { dayName: swapDay, dateStr: '', isToday: false }
  const diff = (targetDay - now.getDay() + 7) % 7
  if (diff === 0) return { dayName: '', dateStr: '', isToday: true }
  const result = new Date(now)
  result.setDate(now.getDate() + diff)
  return { dayName: dayNames[result.getDay()], dateStr: `${result.getDate()} ${months[result.getMonth()]}`, isToday: false }
}

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
  return `${hour}${m > 0 ? `:${String(m).padStart(2,'0')}` : ''}${ampm}`
}

function Countdown({ cutoffDay, cutoffTime, urgent, compact }: { cutoffDay: string; cutoffTime: string; urgent: boolean; compact?: boolean }) {
  const [timeLeft, setTimeLeft] = useState('')
  useEffect(() => {
    const tick = () => {
      const cutoff = getNextCutoff(cutoffDay, cutoffTime)
      const diff = cutoff.getTime() - Date.now()
      if (diff <= 0) { setTimeLeft('—'); return }
      const d = Math.floor(diff / (1000 * 60 * 60 * 24))
      const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      if (compact) {
        if (d > 0) setTimeLeft(`${d}d ${h}h ${m}m`)
        else if (h > 0) setTimeLeft(`${h}h ${m}m`)
        else setTimeLeft(`${m}m`)
      } else {
        if (d > 0) setTimeLeft(`${d}d · ${h}h · ${m}m`)
        else if (h > 0) setTimeLeft(`${h}h · ${m}m`)
        else setTimeLeft(`${m} mins`)
      }
    }
    tick()
    const id = setInterval(tick, 60000)
    return () => clearInterval(id)
  }, [cutoffDay, cutoffTime, compact])

  if (compact) {
    return (
      <div style={{ textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', marginBottom: '2px' }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={urgent ? '#e57451' : '#f9d174'} strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <p style={{ fontFamily: 'var(--font-amatic)', fontWeight: 700, color: urgent ? '#e57451' : '#f9d174', fontSize: '1.1rem', letterSpacing: '0.08em', margin: 0 }}>Time left to choose</p>
        </div>
        <p style={{ fontFamily: 'var(--font-cormorant), serif', color: urgent ? '#e57451' : '#1a2f51', fontSize: '2.2rem', fontWeight: 700, lineHeight: 1, margin: 0, whiteSpace: 'nowrap' }}>{timeLeft}</p>
      </div>
    )
  }

  return (
    <p style={{ fontFamily: 'var(--font-cormorant), serif', color: urgent ? '#e57451' : '#1a2f51', fontSize: '1.4rem', fontWeight: 700, lineHeight: 1, margin: '4px 0 0' }}>
      {timeLeft}
    </p>
  )
}

const CHARACTERS = [
  { src: '/mouse_teacup.png', slot: 'bottom-center' },
  { src: '/mouse_1.png',      slot: 'bottom-left' },
  { src: '/mouse_2.png',      slot: 'add-a-reader' },
  { src: '/mouse_3.png',      slot: 'bottom-right' },
  { src: '/mouse_4.png',      slot: 'bottom-center' },
  { src: '/mouse_5.png',      slot: 'bottom-right' },
  { src: '/mouse_6.png',      slot: 'bottom-left' },
  { src: '/mouse_7.png',      slot: 'first-reader-top' },
  { src: '/mouse_8.png',      slot: 'bottom-left' },
  { src: '/mouse_9.png',      slot: 'bottom-center' },
  { src: '/mouse_10.png',     slot: 'bottom-right' },
  { src: '/mouse_11.png',     slot: 'bottom-left' },
  { src: '/mouse_12.png',     slot: 'bottom-center' },
  { src: '/mouse_13.png',     slot: 'bottom-center' },
  { src: '/mouse_14.png',     slot: 'bottom-center' },
]

export default function DashboardPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const [characterIndex] = useState(() => {
    const today = new Date().toDateString()
    try {
      const stored = JSON.parse(localStorage.getItem('bonkers_char_parent') || 'null')
      if (stored?.date === today && typeof stored.index === 'number') return stored.index
    } catch {}
    const index = Math.floor(Math.random() * CHARACTERS.length)
    try { localStorage.setItem('bonkers_char_parent', JSON.stringify({ date: today, index })) } catch {}
    return index
  })
  const activeCharacter = CHARACTERS[characterIndex]
  const [member, setMember] = useState<Member | null>(null)
  const [children, setChildren] = useState<Child[]>([])
  const [loans, setLoans] = useState<Loan[]>([])
  const [nextStack, setNextStack] = useState<NextStackBook[]>([])
  const [returnMarked, setReturnMarked] = useState<Set<string>>(new Set())
  const [showNoSlotsPopup, setShowNoSlotsPopup] = useState(false)
  const [loading, setLoading] = useState(true)
  const [savedBooks, setSavedBooks] = useState<Map<string, WishlistBook[]>>(new Map())
  const [notifyingBookIds, setNotifyingBookIds] = useState<Set<string>>(new Set())
  const [availableSavedBookIds, setAvailableSavedBookIds] = useState<Set<string>>(new Set())
  const [approvingChildIds, setApprovingChildIds] = useState<Set<string>>(new Set())
  const [userId, setUserId] = useState<string | null>(null)
  const [collapsedChildren, setCollapsedChildren] = useState<Set<string>>(new Set())
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const toggleCollapse = (id: string) => setCollapsedChildren(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })

  useEffect(() => {
    const load = async () => {
      // Exchange PKCE code from email confirmation link if present
      const code = searchParams.get('code')
      if (code) {
        await supabase.auth.exchangeCodeForSession(code)
        router.replace('/dashboard')
        return
      }

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      const user = session.user
      setUserId(user.id)

      const { data: hh } = await supabase
        .from('households')
        .select('*, zones(bonkers_day, cutoff_time)')
        .eq('user_id', user.id)
        .single()

      if (!hh) { router.push('/login'); return }

      // delivery day + cutoff come from the household's zone (empty until a day is set)
      const { day: deliveryDay, cutoffTime: zoneCutoff } = householdDeliveryDay(hh)
      const cutoffDay = deliveryDay ?? ''

      // Fetch plan books separately to avoid join failures
      const { data: subData } = await supabase
        .from('subscriptions')
        .select('plan_id, subscription_plans(books_per_swap)')
        .eq('household_id', hh.id)
        .eq('status', 'active')
        .maybeSingle()
      const planBooks = (subData as any)?.subscription_plans?.books_per_swap ?? 4

      setMember({
        id: hh.id,
        first_name: hh.first_name ?? '',
        email: user.email ?? '',
        plan_books: planBooks,
        swap_day: cutoffDay,
        swap_cutoff_day: cutoffDay,
        swap_cutoff_time: zoneCutoff,
        avatar_id: (hh as any).avatar_id ?? null,
      })

      const { data: childrenData } = await supabase
        .from('child_profiles')
        .select('id, name, date_of_birth, avatar_id, swap_permission, books_read_count')
        .eq('household_id', hh.id)
        .order('created_at')

      const childList: Child[] = []
      const allLoans: Loan[] = []

      if (childrenData) {
        for (const child of childrenData) {
          const { data: loanRows } = await supabase
            .from('loans')
            .select('id, status, return_requested, book_copies(books(id, title, cover_image_url, author))')
            .eq('child_id', child.id)
            .in('status', ['checked_out', 'in_return_transit'])

          for (const l of loanRows ?? []) {
            const raw = (l as any).book_copies?.books
            const book = raw ? { ...raw, cover_url: raw.cover_image_url ?? null } : null
            if (book) {
              allLoans.push({
                loanId: l.id,
                book,
                childId: child.id,
                childName: child.name,
                returnRequested: l.return_requested ?? false,
                collected: (l as any).status === 'in_return_transit',
              })
            }
          }

          const { data: swapReq } = await supabase
            .from('swap_requests')
            .select('id, status')
            .eq('household_id', hh.id)
            .eq('child_id', child.id)
            .in('status', ['draft', 'child_confirmed', 'submitted', 'confirmed'])
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

          let swapStatus: Child['swap_status'] = 'not_submitted'
          if (swapReq?.status === 'submitted' || swapReq?.status === 'confirmed') swapStatus = 'submitted'
          else if (swapReq?.status === 'child_confirmed' || (swapReq?.status === 'draft' && child.swap_permission === 'prepare_only')) swapStatus = 'child_confirmed_pending_approval'

          childList.push({
            id: child.id,
            first_name: child.name,
            age: child.date_of_birth ? Math.floor((Date.now() - new Date(child.date_of_birth).getTime()) / (1000 * 60 * 60 * 24 * 365.25)) : null,
            interests: null,
            avatar_id: child.avatar_id ?? null,
            swap_permission: child.swap_permission,
            swap_status: swapStatus,
            swap_request_id: swapReq?.id ?? null,
            books_read_count: child.books_read_count ?? 0,
            top_category: null,
          })
        }

        // Compute top category per child from loan history
        if (childList.length > 0) {
          const childIds = childList.map(c => c.id)
          const { data: allLoans } = await supabase.from('loans').select('child_id, book_copies(book_id)').in('child_id', childIds)
          if (allLoans && allLoans.length > 0) {
            const bookIds = [...new Set((allLoans as any[]).map(l => l.book_copies?.book_id).filter(Boolean))]
            if (bookIds.length > 0) {
              const { data: cats } = await supabase.from('book_categories').select('book_id, categories(id, name)').in('book_id', bookIds)
              const bookCatMap = new Map<string, string>()
              for (const bc of (cats || []) as any[]) { if (bc.categories) bookCatMap.set(bc.book_id, bc.categories.name) }
              const childCatCounts = new Map<string, Map<string, number>>()
              for (const loan of allLoans as any[]) {
                const bookId = loan.book_copies?.book_id
                const catName = bookId ? bookCatMap.get(bookId) : null
                if (!catName || !loan.child_id) continue
                if (!childCatCounts.has(loan.child_id)) childCatCounts.set(loan.child_id, new Map())
                const counts = childCatCounts.get(loan.child_id)!
                counts.set(catName, (counts.get(catName) || 0) + 1)
              }
              for (const child of childList) {
                const counts = childCatCounts.get(child.id)
                if (!counts) continue
                let topCat = '', topCount = 0
                for (const [cat, count] of counts) { if (count > topCount) { topCat = cat; topCount = count } }
                if (topCat) child.top_category = topCat
              }
            }
          }
        }
      }

      // Seed returnMarked from DB state
      const preMarked = new Set(allLoans.filter(l => l.returnRequested).map(l => l.loanId))

      // Fetch next stack — all per-child swap requests that are active
      const { data: allReqs } = await supabase
        .from('swap_requests')
        .select('id, status, child_id')
        .eq('household_id', hh.id)
        .in('status', ['draft', 'child_confirmed', 'submitted', 'confirmed'])

      const reqIds = (allReqs ?? []).map(r => r.id)

      const { data: nextItems } = reqIds.length > 0 ? await supabase
        .from('swap_request_items')
        .select('id, child_id, books(id, title, cover_image_url, author)')
        .in('swap_request_id', reqIds) : { data: null }

      const picks: NextStackBook[] = (nextItems ?? []).map((item: any) => {
        const child = childList.find(c => c.id === item.child_id)
        const b = item.books ? { ...item.books, cover_url: item.books.cover_image_url ?? null } : null
        return {
          id: item.id,
          book: b,
          childId: item.child_id,
          childName: child?.first_name ?? '',
        }
      }).filter((item: NextStackBook) => item.book)
      // Fetch saved (wishlisted) books per child
      if (childList.length > 0) {
        const childIds = childList.map(c => c.id)
        const { data: wl } = await supabase
          .from('wishlists')
          .select('child_id, book_id, books(id, title, cover_image_url)')
          .in('child_id', childIds)
        if (wl) {
          const wlMap = new Map<string, WishlistBook[]>()
          for (const row of wl as any[]) {
            const book = row.books
            if (!book) continue
            const existing = wlMap.get(row.child_id) || []
            wlMap.set(row.child_id, [...existing, { id: book.id, title: book.title, cover_image_url: book.cover_image_url }])
          }
          setSavedBooks(wlMap)
          // Load availability for saved books
          const allSavedIds = [...new Set([...wlMap.values()].flatMap(books => books.map(b => b.id)))]
          if (allSavedIds.length > 0) {
            const { data: availCopies } = await supabase.from('book_copies').select('book_id').in('book_id', allSavedIds).eq('status', 'available')
            setAvailableSavedBookIds(new Set((availCopies || []).map((c: any) => c.book_id)))
          }
        }
      }

      // Load parent notification subscriptions
      const { data: notifData } = await supabase.from('book_availability_notifications').select('book_id').eq('user_id', user.id)
      if (notifData) setNotifyingBookIds(new Set(notifData.map((n: any) => n.book_id)))

      setChildren(childList)
      setCollapsedChildren(prev => prev.size === 0 ? new Set(childList.map(c => c.id)) : prev)
      setLoans(allLoans)
      setReturnMarked(preMarked)
      setNextStack(picks)
      setLoading(false)
    }
    load()
    window.addEventListener('focus', load)
    const channel = supabase.channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'swap_request_items' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wishlists' }, load)
      .subscribe()
    return () => {
      window.removeEventListener('focus', load)
      supabase.removeChannel(channel)
    }
  }, [])

  useEffect(() => {
    if (loading) return
    const scrollTo = searchParams.get('scrollTo')
    if (scrollTo) {
      const el = document.getElementById(scrollTo)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [loading, searchParams])

  const cutoffDay = member?.swap_cutoff_day ?? ''
  const cutoffTime = member?.swap_cutoff_time ?? '20:00'
  const isBonkersToday = getNextBonkersDateParts(cutoffDay).isToday
  const cutoff = getNextCutoff(cutoffDay, cutoffTime)
  const cutoffPassed = cutoff.getTime() <= Date.now()
  const cutoffUrgent = !cutoffPassed && cutoff.getTime() - Date.now() < 24 * 60 * 60 * 1000

  const planTotal = member?.plan_books ?? 4
  const booksKept = loans.filter(l => !returnMarked.has(l.loanId)).length
  const availableSlots = Math.max(0, planTotal - booksKept - nextStack.length)
  const hasSlots = availableSlots > 0

  const toggleReturn = async (loanId: string) => {
    setReturnMarked(prev => {
      const next = new Set(prev)
      if (next.has(loanId)) next.delete(loanId)
      else next.add(loanId)
      return next
    })
    const isNowReturning = !returnMarked.has(loanId)
    await supabase.from('loans').update({ return_requested: isNowReturning }).eq('id', loanId)
  }

  const removeFromStack = async (itemId: string, childId: string) => {
    setNextStack(prev => prev.filter(b => b.id !== itemId))
    await supabase.from('swap_request_items').delete().eq('id', itemId)

    const child = children.find(c => c.id === childId)
    if (child?.swap_status === 'submitted' && child.swap_request_id) {
      // prepare_only reverts to child_confirmed (parent can re-submit immediately, Option A)
      // others revert to draft
      const targetStatus = child.swap_permission === 'prepare_only' ? 'child_confirmed' : 'draft'
      const newSwapStatus: Child['swap_status'] = child.swap_permission === 'prepare_only' ? 'child_confirmed_pending_approval' : 'not_submitted'
      await supabase.from('swap_requests').update({ status: targetStatus }).eq('id', child.swap_request_id)
      setChildren(prev => prev.map(c => c.id === childId ? { ...c, swap_status: newSwapStatus } : c))
    }
  }

  const removeFromSaved = async (childId: string, bookId: string) => {
    await supabase.from('wishlists').delete().eq('child_id', childId).eq('book_id', bookId)
    setSavedBooks(prev => {
      const n = new Map(prev)
      n.set(childId, (n.get(childId) || []).filter(b => b.id !== bookId))
      return n
    })
  }

  const quickAddToDelivery = async (e: React.MouseEvent, childId: string, bookId: string) => {
    e.stopPropagation()
    const targetChild = children.find(c => c.id === childId)
    let reqId = targetChild?.swap_request_id ?? null
    if (!reqId && member?.id) {
      const { data: newReq } = await supabase.from('swap_requests').insert({ household_id: member.id, child_id: childId, status: 'draft' }).select('id').single()
      if (newReq) {
        reqId = newReq.id
        setChildren(prev => prev.map(c => c.id === childId ? { ...c, swap_request_id: newReq.id } : c))
      }
    }
    if (!reqId) return
    await supabase.from('swap_request_items').insert({ swap_request_id: reqId, book_id: bookId, child_id: childId })
    const book = [...savedBooks.values()].flat().find(b => b.id === bookId)
    setNextStack(prev => {
      if (prev.some(n => n.book?.id === bookId)) return prev
      return [...prev, { id: `temp-${bookId}`, book: { id: bookId, title: book?.title || '', cover_url: book?.cover_image_url || null, author: '' }, childId, childName: targetChild?.first_name || '' }]
    })
  }

  const approveSwap = async (requestId: string, childId: string) => {
    setApprovingChildIds(prev => new Set(prev).add(childId))
    await supabase.from('swap_requests').update({ status: 'submitted' }).eq('id', requestId)
    setChildren(prev => prev.map(c => c.id === childId ? { ...c, swap_status: 'submitted' } : c))
    setApprovingChildIds(prev => { const n = new Set(prev); n.delete(childId); return n })
  }

  const unsubmitSwap = async (requestId: string, childId: string) => {
    const child = children.find(c => c.id === childId)
    // prepare_only reverts to child_confirmed (Option A: parent can re-submit immediately)
    const targetStatus = child?.swap_permission === 'prepare_only' ? 'child_confirmed' : 'draft'
    const newSwapStatus: Child['swap_status'] = child?.swap_permission === 'prepare_only' ? 'child_confirmed_pending_approval' : 'not_submitted'
    await supabase.from('swap_requests').update({ status: targetStatus }).eq('id', requestId)
    setChildren(prev => prev.map(c => c.id === childId ? { ...c, swap_status: newSwapStatus } : c))
  }

  const quickToggleNotify = async (e: React.MouseEvent, bookId: string) => {
    e.stopPropagation()
    if (!userId) return
    const isNowNotifying = notifyingBookIds.has(bookId)
    setNotifyingBookIds(prev => {
      const n = new Set(prev)
      if (isNowNotifying) n.delete(bookId); else n.add(bookId)
      return n
    })
    if (isNowNotifying) {
      await supabase.from('book_availability_notifications').delete().eq('user_id', userId).eq('book_id', bookId)
    } else {
      await supabase.from('book_availability_notifications').insert({ user_id: userId, book_id: bookId })
    }
  }

  const handleChooseBooks = () => {
    if (hasSlots) {
      router.push('/dashboard/library?from=parent')
    } else {
      setShowNoSlotsPopup(true)
    }
  }

  const eyebrow: React.CSSProperties = {
    fontFamily: 'var(--font-montserrat), sans-serif',
    fontWeight: 700,
    fontSize: '0.65rem',
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    color: '#f9d174',
    margin: 0,
  }

  const heading: React.CSSProperties = {
    fontFamily: 'var(--font-cormorant), serif',
    color: '#1a2f51',
    fontSize: '2rem',
    fontWeight: 700,
    lineHeight: 1.05,
    margin: '2px 0 0',
    textTransform: 'capitalize',
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#fefaf2' }}>
        <p style={{ fontFamily: 'var(--font-cormorant), serif', color: '#1a2f51', fontSize: '1.5rem' }}>Loading...</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen pb-28" style={{ backgroundColor: '#fefaf2' }}>
      <style>{`
        .ghost-grid { display: grid; gap: 10px; grid-template-columns: repeat(2, 1fr); }
        @media (min-width: 600px) { .ghost-grid { grid-template-columns: repeat(4, 1fr); } }
        .dash-heading-lg { font-size: 0.94rem !important; }
        .dash-heading-sm { font-size: 0.85rem !important; }
        .dash-action-pill { padding: 16px 28px; font-size: 0.9rem; }
        @media (min-width: 768px) { .dash-action-pill { padding: 22px 36px; font-size: 1.05rem; } }
        .dash-whisker { height: 44px; }
        @media (min-width: 768px) { .dash-whisker { height: 64px; } }
      `}</style>
      <div className="max-w-xl mx-auto px-4 pt-6">

        {/* Header */}
        <div className="flex items-start justify-between mb-7">
          <div style={{ lineHeight: 1 }}>
            <p style={{ fontFamily: 'var(--font-amatic)', fontWeight: 700, fontSize: '3rem', color: '#1a2f51', letterSpacing: '0.04em', margin: 0 }}>BONKERS</p>
            <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600, fontSize: '0.5rem', color: '#1a2f51', letterSpacing: '0.18em', textTransform: 'uppercase', margin: '2px 0 0' }}>THE CHILDREN'S LIBRARY</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
          <NotificationBell />
          {(() => {
            const av = AVATARS.find(a => a.id === member?.avatar_id)
            return (
              <button onClick={() => setProfileMenuOpen(o => !o)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                <div style={{ width: '3rem', height: '3rem', borderRadius: '50%', backgroundColor: av ? av.bg : 'rgba(26,47,81,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: av ? '1.7rem' : '1.3rem', flexShrink: 0, border: '2px solid rgba(26,47,81,0.2)', fontFamily: 'var(--font-cormorant), serif', fontWeight: 700, color: '#1a2f51' }}>
                  {av ? av.emoji : (member?.first_name?.[0]?.toUpperCase() || '?')}
                </div>
                {member?.first_name && <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600, fontSize: '0.55rem', color: '#1a2f51', letterSpacing: '0.12em', textTransform: 'uppercase', lineHeight: 1 }}>{member.first_name}</span>}
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#1a2f51" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'transform 0.2s', transform: profileMenuOpen ? 'rotate(180deg)' : 'none' }}><polyline points="6 9 12 15 18 9"/></svg>
              </button>
            )
          })()}
          </div>
        </div>

        <h1 style={{ fontFamily: 'var(--font-cormorant), serif', color: '#1a2f51', fontSize: '2.8rem', fontWeight: 700, lineHeight: 1, marginTop: '24px', marginBottom: '34px', textAlign: 'center' }}>Hello, {member?.first_name || 'there'}!</h1>

        {/* ── NEXT BONKERS DAY ── */}
        {(() => {
          const { dayName, dateStr, isToday } = getNextBonkersDateParts(cutoffDay)
          return (
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
              <p className="dash-heading-sm" style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600, fontSize: '0.65rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#1a2f51', margin: '0 0 4px' }}>Your next Bonkers Day is</p>
              {cutoffDay ? (
            <>
              <p style={{ fontFamily: 'var(--font-cormorant), serif', color: '#1a2f51', fontSize: '1.8rem', fontWeight: 700, lineHeight: 1, margin: '0 0 6px' }}>{isToday ? 'Today!' : `${dayName} ${dateStr}`}</p>
              {!isToday && <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.72rem', color: '#1a2f51', opacity: 0.65, margin: 0 }}>Choose your books by {getChooseCutoffDay(cutoffDay)} at {formatCutoffTime(cutoffTime)}</p>}
            </>
          ) : (
            <>
              <p style={{ fontFamily: 'var(--font-cormorant), serif', color: '#1a2f51', fontSize: '1.8rem', fontWeight: 700, lineHeight: 1, margin: '0 0 6px' }}>Coming soon</p>
              <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.72rem', color: '#1a2f51', opacity: 0.65, margin: 0 }}>We’ll let you know your delivery day very soon.</p>
            </>
          )}
            </div>
          )
        })()}

        {/* ── OVER ALLOWANCE (more books at home than the plan allows) ── */}
        {(() => {
          const atHome = loans.filter(l => !l.collected).length
          const extra = atHome - planTotal
          if (extra <= 0) return null
          return (
            <div style={{ border: '2px solid #e8533a', backgroundColor: '#fff6f3', borderRadius: '16px', padding: '16px 18px', marginBottom: '28px' }}>
              <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 800, fontSize: '1.1rem', color: '#e8533a', margin: '0 0 6px' }}>{atHome}/{planTotal} books at home</p>
              <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.88rem', color: '#1a2f51', lineHeight: 1.55, margin: 0 }}>
                You have {extra} more book{extra === 1 ? '' : 's'} at home than your plan allows. Please mark {extra === 1 ? 'it' : 'them'} as <strong>Returning</strong> and pop {extra === 1 ? 'it' : 'them'} in your tote for your next Bonkers Day.
                {planTotal < 6 && atHome <= 6 && <> Want to keep more? <a href="/dashboard/settings" style={{ color: '#1a2f51', fontWeight: 700 }}>Upgrade to 6 books</a>.</>}
              </p>
            </div>
          )
        })()}

        {/* ── YOUR READERS HEADING ── */}
        <h2 style={{ fontFamily: 'var(--font-cormorant), serif', fontWeight: 700, color: '#1a2f51', fontSize: '2rem', margin: '0 0 16px', lineHeight: 1 }}>Your Readers</h2>

        {/* ── PER-CHILD SECTIONS ── */}
        {(() => {
          const allocatedTotal = children.reduce((sum, c) => sum + (c.book_allocation ?? 0), 0)
          const sharedPool = Math.max(0, planTotal - allocatedTotal)
          const sharedKept = loans.filter(l => {
            const c = children.find(ch => ch.id === l.childId)
            return !c?.book_allocation && !returnMarked.has(l.loanId)
          }).length
          const sharedNextCount = nextStack.filter(n => {
            const c = children.find(ch => ch.id === n.childId)
            return !c?.book_allocation
          }).length
          const sharedAvailable = Math.max(0, sharedPool - sharedKept - sharedNextCount)

          return children.map((child, ci) => {
            const childLoans = loans.filter(l => l.childId === child.id)
            const childNext = nextStack.filter(n => n.childId === child.id)
            const childSaved = savedBooks.get(child.id) || []
            const isPending = child.swap_status === 'child_confirmed_pending_approval' && childNext.length > 0

            const childAvailableSlots = child.book_allocation
              ? Math.max(0, child.book_allocation - childLoans.filter(l => !returnMarked.has(l.loanId)).length - childNext.length)
              : sharedAvailable

            const displayedSaved = cutoffPassed
              ? childSaved.filter(book => !childNext.some(n => n.book?.id === book.id))
              : childSaved

            return (
              <React.Fragment key={child.id}>
              {ci === 0 && activeCharacter.slot === 'first-reader-top' && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '-50px', position: 'relative', zIndex: 1, paddingRight: '24px' }}>
                  <img src={activeCharacter.src} alt="" className="dashboard-character-sm" style={{ height: '45px', width: 'auto', pointerEvents: 'none', position: 'relative', top: '-38px' }} />
                </div>
              )}
              <section style={{ marginBottom: '16px', backgroundColor: 'transparent', borderRadius: '16px', border: '2px solid #e8e0d4', padding: '20px 16px' }}>
                {/* Child header */}
                {(() => {
                  const isCollapsed = collapsedChildren.has(child.id)
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: isCollapsed ? 0 : '18px' }}>
                      <div onClick={() => router.push(`/dashboard/children/${child.id}`)} style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, cursor: 'pointer' }}>
                      {(() => { const av = AVATARS.find(a => a.id === child.avatar_id); return (
                      <div style={{ width: '3rem', height: '3rem', borderRadius: '50%', backgroundColor: av?.bg || 'rgba(26,47,81,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '2px solid rgba(26,47,81,0.1)', fontSize: av ? '1.7rem' : '1.3rem' }}>
                        {av ? av.emoji : <span style={{ fontFamily: 'var(--font-cormorant), serif', color: '#1a2f51', fontWeight: 700 }}>{child.first_name[0]}</span>}
                      </div>) })()}
                      <div style={{ flex: 1 }}>
                        <p style={{ fontFamily: 'var(--font-cormorant), serif', fontWeight: 700, color: '#1a2f51', fontSize: '1.6rem', margin: 0, lineHeight: 1 }}>{child.first_name}</p>
                        {child.age && <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#1a2f51', fontSize: '0.72rem', opacity: 0.45, margin: '2px 0 0' }}>Age {child.age}</p>}
                      </div>
                      </div>
                      <div onClick={() => toggleCollapse(child.id)} style={{ cursor: 'pointer', padding: '4px', flexShrink: 0 }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1a2f51" strokeWidth="2.5" style={{ opacity: 0.7, transition: 'transform 0.2s', transform: isCollapsed ? 'rotate(0deg)' : 'rotate(180deg)', display: 'block' }}><polyline points="6 9 12 15 18 9"/></svg>
                      </div>
                    </div>
                  )
                })()}

                {!collapsedChildren.has(child.id) && <>


                {/* At home */}
                {(() => {
                  const childTotalSlots = child.book_allocation ?? planTotal
                  const atHomeGhostCount = Math.max(0, childTotalSlots - childLoans.length)
                  return (
                    <div style={{ marginBottom: '18px' }}>
                      <p className="dash-heading-lg" style={{ fontFamily: 'var(--font-cormorant), serif', fontWeight: 700, fontSize: '1.1rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#1a2f51', margin: '0 0 10px' }}>At home</p>
                      <div className="ghost-grid" style={{ display: 'grid', gap: '10px' }}>
                        {childLoans.map(loan => {
                          const isReturn = returnMarked.has(loan.loanId)
                          return (
                            <div key={loan.loanId} style={{ textAlign: 'center' }}>
                              <div style={{ aspectRatio: '3/4', borderRadius: '10px', overflow: 'hidden', backgroundColor: 'rgba(26,47,81,0.07)', border: `1.5px solid ${isReturn ? 'rgba(232,83,58,0.35)' : 'rgba(26,47,81,0.1)'}`, opacity: loan.collected ? 0.35 : isReturn ? 0.5 : 1, transition: 'all 0.2s' }}>
                                {loan.book.cover_url
                                  ? <img src={loan.book.cover_url} alt={loan.book.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                  : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.3 }}><svg width="16" height="16" viewBox="0 0 24 24" fill="#1a2f51"><path d="M6 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/></svg></div>
                                }
                              </div>
                              {loan.collected ? <span style={{ display: 'inline-block', marginTop: '5px', padding: '3px 8px', borderRadius: '20px', fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 700, fontSize: '0.52rem', letterSpacing: '0.04em', backgroundColor: '#eef1f8', color: '#1a2f51' }}>On its way back 🚐</span> : (
                              <button onClick={() => toggleReturn(loan.loanId)} style={{ marginTop: '5px', padding: '3px 8px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 700, fontSize: '0.52rem', letterSpacing: '0.06em', backgroundColor: isReturn ? '#e8533a' : 'rgba(26,47,81,0.08)', color: isReturn ? '#fff' : 'rgba(26,47,81,0.45)', transition: 'all 0.2s' }}>
                                {isReturn ? 'Returning' : 'Keeping'}
                              </button>
                              )}
                            </div>
                          )
                        })}
                        {Array.from({ length: atHomeGhostCount }).map((_, i) => (
                          <div key={i} style={{ aspectRatio: '3/4', borderRadius: '10px', border: '2px dashed rgba(26,47,81,0.3)', backgroundColor: 'transparent' }} />
                        ))}
                      </div>
                    </div>
                  )
                })()}

                {/* Coming next */}
                <div style={{ marginBottom: displayedSaved.length > 0 ? '18px' : 0 }}>
                  <div style={{ marginBottom: '20px' }}>
                    <p className="dash-heading-lg" style={{ fontFamily: 'var(--font-cormorant), serif', fontWeight: 700, fontSize: '1.1rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#1a2f51', margin: '0 0 16px' }}>{isBonkersToday ? 'Coming Today' : 'Coming Next'}</p>
                    {(isPending || (child.swap_permission === 'parent_only' && childNext.length > 0 && child.swap_status !== 'submitted')) && child.swap_request_id && (
                      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '22px' }}>
                        <img src="/spines/whiskers_left_yellow.png" alt="" className="dash-whisker" style={{ width: 'auto', flexShrink: 0, marginRight: '8px', pointerEvents: 'none' }} />
                        <button
                          onClick={e => { e.stopPropagation(); approveSwap(child.swap_request_id!, child.id) }}
                          disabled={approvingChildIds.has(child.id)}
                          className="dash-action-pill"
                          style={{ borderRadius: '999px', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 500, fontSize: '0.9rem', letterSpacing: '0.15em', textTransform: 'uppercase', backgroundColor: '#1a2f51', color: 'white', opacity: approvingChildIds.has(child.id) ? 0.6 : 1 }}>
                          {approvingChildIds.has(child.id) ? 'Approving…' : 'Approve'}
                        </button>
                        <img src="/spines/whiskers_right_yellow.png" alt="" className="dash-whisker" style={{ width: 'auto', flexShrink: 0, marginLeft: '8px', pointerEvents: 'none' }} />
                      </div>
                    )}
                    {child.swap_status === 'submitted' && childNext.length > 0 && !cutoffPassed && child.swap_request_id && (
                      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '10px', marginBottom: '22px' }}>
                        <div className="dash-action-pill" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', borderRadius: '999px', backgroundColor: 'rgba(72,199,142,0.2)', border: 'none' }}>
                          <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#1a2f51', fontSize: '0.9rem', fontWeight: 500, letterSpacing: '0.15em', textTransform: 'uppercase' }}>Submitted</span>
                        </div>
                        <button
                          onClick={e => { e.stopPropagation(); unsubmitSwap(child.swap_request_id!, child.id) }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px', color: '#1a2f51', WebkitTapHighlightColor: 'transparent', transition: 'transform 0.1s', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                          onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.9)')}
                          onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
                          onTouchStart={e => (e.currentTarget.style.transform = 'scale(0.9)')}
                          onTouchEnd={e => (e.currentTarget.style.transform = 'scale(1)')}>
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1a2f51" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-5.4"/>
                          </svg>
                          <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#1a2f51', marginLeft: '6px' }}>Undo</span>
                        </button>
                      </div>
                    )}
                  </div>
                  {cutoffPassed && childNext.length > 0 ? (
                    <>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', marginBottom: '8px', padding: '4px 10px', borderRadius: '20px', backgroundColor: 'rgba(80,200,120,0.1)', border: '1px solid rgba(80,200,120,0.25)' }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#50c878" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                        <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#50c878', fontSize: '0.6rem', fontWeight: 700, margin: 0, letterSpacing: '0.08em' }}>Locked in — on their way!</p>
                      </div>
                      <div className="ghost-grid" style={{ display: 'grid', gap: '10px' }}>
                        {childNext.map(item => (
                          <div key={item.id}>
                            <div style={{ aspectRatio: '3/4', borderRadius: '10px', overflow: 'hidden', backgroundColor: 'rgba(26,47,81,0.07)', border: '1px solid rgba(26,47,81,0.1)' }}>
                              {item.book.cover_url ? <img src={item.book.cover_url} alt={item.book.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.3 }}><svg width="16" height="16" viewBox="0 0 24 24" fill="#1a2f51"><path d="M6 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2"/></svg></div>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="ghost-grid" style={{ display: 'grid', gap: '10px' }}>
                      {childNext.map(item => (
                        <div key={item.id} style={{ position: 'relative' }}>
                          <div style={{ aspectRatio: '3/4', borderRadius: '10px', overflow: 'hidden', backgroundColor: 'rgba(26,47,81,0.07)', border: '1px solid rgba(26,47,81,0.1)' }}>
                            {item.book.cover_url ? <img src={item.book.cover_url} alt={item.book.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.3 }}><svg width="16" height="16" viewBox="0 0 24 24" fill="#1a2f51"><path d="M6 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/></svg></div>}
                          </div>
                          <button onClick={() => removeFromStack(item.id, child.id)} style={{ position: 'absolute', top: '-5px', right: '-5px', width: '20px', height: '20px', borderRadius: '50%', backgroundColor: 'rgba(26,47,81,0.9)', border: '1.5px solid #fefaf2', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, zIndex: 1 }}>
                            <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="#fefaf2" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          </button>
                        </div>
                      ))}
                      {Array.from({ length: childAvailableSlots }).map((_, i) => (
                        <button key={i} onClick={() => router.push('/dashboard/library?from=parent')} style={{ aspectRatio: '3/4', borderRadius: '10px', border: '2px dashed rgba(26,47,81,0.3)', backgroundColor: 'transparent', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', cursor: 'pointer', padding: '6px', width: '100%' }}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(26,47,81,0.4)" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                          <span style={{ fontFamily: 'var(--font-cormorant), serif', color: 'rgba(26,47,81,0.5)', fontSize: '0.65rem', fontWeight: 600, lineHeight: 1.2, textAlign: 'center' }}>Add a book</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Saved */}
                {displayedSaved.length > 0 && (
                  <div>
                    <p className="dash-heading-lg" style={{ fontFamily: 'var(--font-cormorant), serif', fontWeight: 700, fontSize: '1.1rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#1a2f51', margin: '0 0 10px' }}>Saved</p>
                    <div className="ghost-grid" style={{ display: 'grid', gap: '10px' }}>
                      {displayedSaved.map(book => {
                        const isAvail = availableSavedBookIds.has(book.id)
                        const inDelivery = childNext.some(n => n.book?.id === book.id)
                        const isNotifying = notifyingBookIds.has(book.id)
                        return (
                          <div key={book.id} style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                            <div onClick={() => router.push(`/dashboard/library/${book.id}`)} style={{ cursor: 'pointer', width: '100%' }}>
                              <div style={{ aspectRatio: '3/4', borderRadius: '10px', overflow: 'hidden', backgroundColor: 'rgba(26,47,81,0.07)' }}>
                                {book.cover_image_url ? <img src={book.cover_image_url} alt={book.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="12" height="12" viewBox="0 0 24 24" fill="rgba(26,47,81,0.15)" stroke="none"><path d="M6 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/></svg></div>}
                              </div>
                            </div>
                            {isAvail ? (
                              <button onClick={e => { if (!inDelivery) quickAddToDelivery(e, child.id, book.id); else e.stopPropagation() }} style={{ background: 'none', border: 'none', cursor: inDelivery ? 'default' : 'pointer', padding: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {inDelivery ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#84a98c" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg> : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f9d174" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>}
                              </button>
                            ) : (
                              <button onClick={e => quickToggleNotify(e, book.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <svg width="11" height="11" viewBox="0 0 24 24" fill={isNotifying ? '#f9d174' : 'none'} stroke="#f9d174" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                              </button>
                            )}
                            <button onClick={e => { e.stopPropagation(); removeFromSaved(child.id, book.id) }} style={{ position: 'absolute', top: '-4px', right: '-4px', width: '16px', height: '16px', borderRadius: '50%', backgroundColor: 'rgba(26,47,81,0.9)', border: '1px solid rgba(26,47,81,0.25)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                              <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="#fefaf2" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                </>}
              </section>
              </React.Fragment>
            )
          })
        })()}

        <button onClick={() => router.push('/dashboard/children/new')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px 16px', borderRadius: '16px', backgroundColor: 'transparent', border: '1.5px dashed rgba(26,47,81,0.45)', cursor: 'pointer', width: '100%', marginBottom: activeCharacter.slot === 'add-a-reader' ? '0px' : '28px' }}>
          <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600, fontSize: '0.68rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(26,47,81,0.6)' }}>+ Add a Reader</span>
        </button>
        {activeCharacter.slot === 'add-a-reader' && (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '28px' }}>
            <img src={activeCharacter.src} alt="" className="dashboard-character-addreader" style={{ height: '120px', width: 'auto', pointerEvents: 'none' }} />
          </div>
        )}

      </div>

      {/* ── NO SLOTS POPUP ── */}
      {showNoSlotsPopup && (
        <div
          className="fixed inset-0 flex items-end justify-center"
          style={{ zIndex: 50, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          onClick={() => setShowNoSlotsPopup(false)}>
          <div
            onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: '576px', backgroundColor: '#fefaf2', borderRadius: '24px 24px 0 0', padding: '28px 24px 40px', border: '1px solid rgba(26,47,81,0.1)', borderBottom: 'none' }}>
            <div style={{ width: '40px', height: '4px', borderRadius: '2px', backgroundColor: 'rgba(26,47,81,0.15)', margin: '0 auto 20px' }} />
            <p style={{ fontFamily: 'var(--font-cormorant), serif', color: '#1a2f51', fontSize: '1.6rem', fontWeight: 700, margin: '0 0 8px' }}>No slots available</p>
            <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#1a2f51', fontSize: '0.85rem', opacity: 0.7, lineHeight: 1.6, margin: '0 0 24px' }}>
              You've filled all your slots for next stack. To add more books, mark some of your current books to return — that frees up the space.
            </p>
            <button
              onClick={() => setShowNoSlotsPopup(false)}
              style={{ display: 'block', width: '100%', padding: '15px', backgroundColor: '#e8533a', border: 'none', borderRadius: '14px', cursor: 'pointer', fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 700, fontSize: '0.85rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#fff' }}>
              Got it
            </button>
          </div>
        </div>
      )}

      {/* ── BOTTOM NAV ── */}
      <div className="fixed bottom-0 left-0 right-0" style={{ backgroundColor: '#1a2f51', borderTop: 'none', zIndex: 40 }}>
        <div className="max-w-xl mx-auto flex items-center justify-around px-2" style={{ paddingTop: '8px', paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}>
          {[
            { label: 'Home', path: '/dashboard', exact: true, icon: <svg className="nav-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>, onClick: () => router.push('/dashboard') },
            { label: 'Library', path: '/dashboard/library', exact: false, icon: <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>, onClick: () => router.push('/dashboard/library?from=parent') },
            { label: 'Settings', path: '/dashboard/settings', exact: false, icon: <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>, onClick: () => router.push('/dashboard/settings') },
            { label: 'Support', path: '/dashboard/support', exact: false, icon: <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>, onClick: () => router.push('/dashboard/support') },
          ].map((item, i) => {
            const active = item.exact ? pathname === item.path : pathname.startsWith(item.path)
            return (
              <button key={i} onClick={item.onClick} className="flex flex-col items-center gap-1 flex-1" style={{ background: 'none', border: 'none', cursor: 'pointer', color: active ? '#f9d174' : '#fefaf2', opacity: 1, padding: '6px 0' }}>
                {item.icon}
                <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.58rem', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700 }}>{item.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Profile dropdown */}
      {profileMenuOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60 }} onClick={() => setProfileMenuOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: '72px', right: '16px', width: 'min(260px, calc(100vw - 32px))', backgroundColor: '#fefaf2', borderRadius: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.18)', overflow: 'hidden', border: '1px solid rgba(26,47,81,0.1)' }}>
            {children.length > 0 && (
              <>
                <div style={{ padding: '12px 16px 10px', borderBottom: '1px solid rgba(26,47,81,0.1)' }}>
                  <p className="dash-heading-sm" style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 700, fontSize: '0.65rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#1a2f51', margin: 0 }}>Your Readers</p>
                </div>
                <div style={{ padding: '6px 0' }}>
                  {children.map(child => (
                    <button key={child.id}
                      onClick={() => { setProfileMenuOpen(false); router.push(`/dashboard/children/${child.id}`) }}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                      {(() => { const av = AVATARS.find(a => a.id === child.avatar_id); return (
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: av?.bg || 'rgba(26,47,81,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1.5px solid rgba(26,47,81,0.12)', fontSize: av ? '1rem' : undefined }}>
                        {av ? av.emoji : <span style={{ fontFamily: 'var(--font-cormorant), serif', color: '#1a2f51', fontSize: '1rem', fontWeight: 700 }}>{child.first_name[0]}</span>}
                      </div>) })()}
                      <p style={{ fontFamily: 'var(--font-cormorant), serif', fontWeight: 700, fontSize: '1.05rem', color: '#1a2f51', margin: 0 }}>{child.first_name}</p>
                    </button>
                  ))}
                </div>
              </>
            )}
            <div style={{ borderTop: '1px solid rgba(26,47,81,0.1)' }}>
              <button onClick={async () => { setProfileMenuOpen(false); await supabase.auth.signOut(); router.push('/') }}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1a2f51" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.78rem', color: '#1a2f51', margin: 0, fontWeight: 600 }}>Log out</p>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CHARACTER IMAGE ── */}
      {activeCharacter.slot === 'bottom-left' && (
        <div className="dashboard-character-bottom" style={{ display: 'flex', justifyContent: 'flex-start', paddingBottom: '8px', paddingLeft: '8px' }}>
          <img src={activeCharacter.src} alt="" className="dashboard-character" style={{ width: 'auto', pointerEvents: 'none' }} />
        </div>
      )}
      {activeCharacter.slot === 'bottom-center' && (
        <div className="dashboard-character-bottom" style={{ display: 'flex', justifyContent: 'center', paddingBottom: '8px' }}>
          <img src={activeCharacter.src} alt="" className="dashboard-character" style={{ width: 'auto', pointerEvents: 'none' }} />
        </div>
      )}
      {activeCharacter.slot === 'bottom-right' && (
        <div className="dashboard-character-bottom" style={{ display: 'flex', justifyContent: 'flex-end', paddingBottom: '8px', paddingRight: '8px' }}>
          <img src={activeCharacter.src} alt="" className="dashboard-character" style={{ width: 'auto', pointerEvents: 'none' }} />
        </div>
      )}
    </main>
  )
}
