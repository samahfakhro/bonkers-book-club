'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'

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
}

type NextStackBook = {
  id: string
  book: Book
  childId: string
  childName: string
}

type Child = {
  id: string
  first_name: string
  age: number | null
  interests: string | null
  avatar_url: string | null
  swap_permission: 'parent_only' | 'child_confirm_parent_approve' | 'independent_submit'
  swap_status: 'not_submitted' | 'child_confirmed_pending_approval' | 'submitted'
  books_read_count: number
  top_category: string | null
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

function getNextCutoff(cutoffDay: string, cutoffTime: string): Date {
  const days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday']
  const now = new Date()
  const targetDay = days.indexOf(cutoffDay.toLowerCase())
  if (targetDay === -1) return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  const [hours, minutes] = cutoffTime.split(':').map(Number)
  const result = new Date(now)
  result.setHours(hours, minutes, 0, 0)
  const diff = (targetDay - now.getDay() + 7) % 7
  result.setDate(now.getDate() + (diff === 0 && result <= now ? 7 : diff))
  return result
}

function getNextBonkersDateParts(swapDay: string): { dayName: string; dateStr: string } {
  const days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday']
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December']
  const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
  const now = new Date()
  const targetDay = days.indexOf(swapDay.toLowerCase())
  if (targetDay === -1) return { dayName: swapDay, dateStr: '' }
  const diff = (targetDay - now.getDay() + 7) % 7
  const result = new Date(now)
  result.setDate(now.getDate() + (diff === 0 ? 7 : diff))
  return { dayName: dayNames[result.getDay()], dateStr: `${result.getDate()} ${months[result.getMonth()]}` }
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
        <p style={{ fontFamily: 'var(--font-cormorant), serif', color: urgent ? '#e57451' : '#eddbc3', fontSize: '2.2rem', fontWeight: 700, lineHeight: 1, margin: 0, whiteSpace: 'nowrap' }}>{timeLeft}</p>
      </div>
    )
  }

  return (
    <p style={{ fontFamily: 'var(--font-cormorant), serif', color: urgent ? '#e57451' : '#eddbc3', fontSize: '2.4rem', fontWeight: 700, lineHeight: 1, margin: '4px 0 0' }}>
      {timeLeft}
    </p>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const [member, setMember] = useState<Member | null>(null)
  const [children, setChildren] = useState<Child[]>([])
  const [loans, setLoans] = useState<Loan[]>([])
  const [nextStack, setNextStack] = useState<NextStackBook[]>([])
  const [returnMarked, setReturnMarked] = useState<Set<string>>(new Set())
  const [showNoSlotsPopup, setShowNoSlotsPopup] = useState(false)
  const [loading, setLoading] = useState(true)

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

      const { data: hh } = await supabase
        .from('households')
        .select('*, communities(swap_days)')
        .eq('user_id', user.id)
        .single()

      if (!hh) { router.push('/login'); return }

      const swapDays = (hh as any).communities?.swap_days
      const cutoffDay = Array.isArray(swapDays) ? swapDays[0] : (swapDays ?? 'tuesday')

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
        swap_cutoff_time: '20:00',
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
            .select('id, return_requested, book_copies(books(id, title, cover_url, author))')
            .eq('child_id', child.id)
            .eq('status', 'checked_out')

          for (const l of loanRows ?? []) {
            const book = (l as any).book_copies?.books
            if (book) {
              allLoans.push({
                loanId: l.id,
                book,
                childId: child.id,
                childName: child.name,
                returnRequested: l.return_requested ?? false,
              })
            }
          }

          const { data: swapReq } = await supabase
            .from('swap_requests')
            .select('id, status')
            .eq('household_id', hh.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

          let swapStatus: Child['swap_status'] = 'not_submitted'
          if (swapReq?.status === 'submitted' || swapReq?.status === 'confirmed') swapStatus = 'submitted'
          else if (swapReq?.status === 'child_confirmed') swapStatus = 'child_confirmed_pending_approval'

          childList.push({
            id: child.id,
            first_name: child.name,
            age: child.date_of_birth ? Math.floor((Date.now() - new Date(child.date_of_birth).getTime()) / (1000 * 60 * 60 * 24 * 365.25)) : null,
            interests: null,
            avatar_url: child.avatar_id ?? null,
            swap_permission: child.swap_permission,
            swap_status: swapStatus,
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

      // Fetch next stack (swap_request_items pending delivery)
      const { data: nextItems } = await supabase
        .from('swap_request_items')
        .select('id, child_id, books(id, title, cover_url, author)')
        .eq('household_id', hh.id)
        .eq('status', 'confirmed')
        .order('created_at')

      const picks: NextStackBook[] = (nextItems ?? []).map((item: any) => {
        const child = childList.find(c => c.id === item.child_id)
        return {
          id: item.id,
          book: item.books,
          childId: item.child_id,
          childName: child?.first_name ?? '',
        }
      }).filter((item: NextStackBook) => item.book)
      setChildren(childList)
      setLoans(allLoans)
      setReturnMarked(preMarked)
      setNextStack(picks)
      setLoading(false)
    }
    load()
  }, [])

  useEffect(() => {
    if (loading) return
    const scrollTo = searchParams.get('scrollTo')
    if (scrollTo) {
      const el = document.getElementById(scrollTo)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [loading, searchParams])

  const cutoffDay = member?.swap_cutoff_day ?? 'tuesday'
  const cutoffTime = member?.swap_cutoff_time ?? '20:00'
  const cutoff = getNextCutoff(cutoffDay, cutoffTime)
  const cutoffPassed = cutoff.getTime() <= Date.now()
  const cutoffUrgent = !cutoffPassed && cutoff.getTime() - Date.now() < 24 * 60 * 60 * 1000

  const planTotal = member?.plan_books ?? 4
  const booksKept = loans.filter(l => !returnMarked.has(l.loanId)).length
  const availableSlots = Math.max(0, planTotal - booksKept - nextStack.length)
  const hasSlots = availableSlots > 0

  const pendingApprovalChildren = children.filter(c => c.swap_status === 'child_confirmed_pending_approval')

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

  const removeFromStack = async (itemId: string) => {
    setNextPile(prev => prev.filter(b => b.id !== itemId))
    await supabase.from('swap_request_items').delete().eq('id', itemId)
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
    color: '#eddbc3',
    fontSize: '2rem',
    fontWeight: 700,
    lineHeight: 1.05,
    margin: '2px 0 0',
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#080402' }}>
        <p style={{ fontFamily: 'var(--font-cormorant), serif', color: '#eddbc3', fontSize: '1.5rem' }}>Loading...</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen pb-28" style={{ backgroundColor: '#080402' }}>
      <div className="max-w-xl mx-auto px-4 pt-6">

        {/* Header */}
        <div className="flex items-start justify-between mb-7">
          <div style={{ lineHeight: 1 }}>
            <p style={{ fontFamily: 'var(--font-amatic)', fontWeight: 700, fontSize: '3rem', color: '#eddbc3', letterSpacing: '0.04em', margin: 0 }}>BONKERS</p>
            <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600, fontSize: '0.5rem', color: '#eddbc3', letterSpacing: '0.18em', textTransform: 'uppercase', margin: '2px 0 0' }}>THE CHILDREN'S LIBRARY</p>
          </div>
          {(() => {
            const av = AVATARS.find(a => a.id === member?.avatar_id)
            return (
              <button onClick={() => router.push('/dashboard/settings')} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                <div style={{ width: '3rem', height: '3rem', borderRadius: '50%', backgroundColor: av ? av.bg : 'rgba(237,219,195,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.7rem', flexShrink: 0, border: '2px solid rgba(237,219,195,0.25)' }}>
                  {av ? av.emoji : '👤'}
                </div>
                <p style={{ fontFamily: 'var(--font-amatic)', fontWeight: 700, fontSize: '1.5rem', color: '#f9d174', letterSpacing: '0.04em', margin: 0, lineHeight: 1 }}>
                  {member?.first_name || ''}
                </p>
              </button>
            )
          })()}
        </div>

        {/* Hello greeting */}
        <div className="flex items-center gap-3" style={{ marginBottom: '20px' }}>
          {(() => {
            const av = AVATARS.find(a => a.id === member?.avatar_id)
            return av ? (
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: av.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', flexShrink: 0 }}>
                {av.emoji}
              </div>
            ) : null
          })()}
          <p style={{ fontFamily: 'var(--font-amatic)', fontWeight: 700, fontSize: '1.5rem', color: '#eddbc3', letterSpacing: '0.04em', margin: 0, lineHeight: 1 }}>
            Hello, {member?.first_name || 'there'}!
          </p>
          <img src="/whiskers_right.png" alt="" style={{ height: '32px', width: 'auto', pointerEvents: 'none', filter: 'brightness(0) saturate(100%) invert(87%) sepia(33%) saturate(762%) hue-rotate(339deg) brightness(103%) contrast(98%)' }} />
        </div>

        {/* ── BOOKS AT HOME ── */}
        <section style={{ marginBottom: '28px' }}>
          <h2 style={{ ...heading, marginBottom: '2px' }}>Books at Home</h2>
          <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#eddbc3', fontSize: '0.82rem', margin: '10px 0 2px' }}>
            {loans.length} book{loans.length !== 1 ? 's' : ''} at home
          </p>

          {loans.length === 0 ? (
            <>
              <div style={{ position: 'relative', marginBottom: '24px' }}>
                <style>{`@media (max-width: 360px) { .ghost-grid { grid-template-columns: repeat(auto-fill, minmax(60px, 1fr)) !important; } } @media (min-width: 600px) { .ghost-grid { grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)) !important; } }`}</style>
                <div className="ghost-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '10px', marginTop: '16px' }}>
                  {Array.from({ length: planTotal }).map((_, i) => (
                    <div key={i} style={{ aspectRatio: '3/4', borderRadius: '10px', border: '2px dashed rgba(237,219,195,0.45)', backgroundColor: 'rgba(237,219,195,0.09)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                      <img src="/bonky_front.png" alt="" style={{ height: '70%', width: 'auto', opacity: 0.32, pointerEvents: 'none' }} />
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>

              {/* Cover grid — wraps to next row if needed */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '14px', paddingTop: '52px' }}>
                {loans.map((loan, index) => {
                  const isReturn = returnMarked.has(loan.loanId)
                  const isLast = index === loans.length - 1
                  return (
                    <div key={loan.loanId} style={{ textAlign: 'center', position: 'relative' }}>
                      {isLast && (
                        <img src="/bonky_34a.png" alt="" style={{ position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)', height: '64px', width: 'auto', pointerEvents: 'none', zIndex: 2 }} />
                      )}
                      <div style={{ width: '66px', height: '90px', borderRadius: '8px', overflow: 'hidden', backgroundColor: 'rgba(237,219,195,0.1)', border: `2px solid ${isReturn ? 'rgba(232,83,58,0.5)' : 'rgba(237,219,195,0.15)'}`, opacity: isReturn ? 0.45 : 1, transition: 'all 0.2s' }}>
                        {loan.book.cover_url
                          ? <img src={loan.book.cover_url} alt={loan.book.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.3 }}>
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="#eddbc3"><path d="M6 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/></svg>
                            </div>
                        }
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Keep/Return list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {loans.map(loan => {
                  const isReturn = returnMarked.has(loan.loanId)
                  return (
                    <div key={loan.loanId} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', borderRadius: '14px', backgroundColor: isReturn ? 'rgba(232,83,58,0.08)' : 'rgba(255,255,255,0.04)', border: `1px solid ${isReturn ? 'rgba(232,83,58,0.3)' : 'rgba(237,219,195,0.12)'}`, transition: 'all 0.2s' }}>
                      <div style={{ width: '44px', height: '60px', borderRadius: '6px', overflow: 'hidden', flexShrink: 0, backgroundColor: 'rgba(237,219,195,0.1)' }}>
                        {loan.book.cover_url
                          ? <img src={loan.book.cover_url} alt={loan.book.title} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: isReturn ? 0.5 : 1, transition: 'opacity 0.2s' }} />
                          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.3 }}>
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="#eddbc3"><path d="M6 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/></svg>
                            </div>
                        }
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: isReturn ? 'rgba(237,219,195,0.45)' : '#eddbc3', fontSize: '0.82rem', fontWeight: 600, margin: 0, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: isReturn ? 'line-through' : 'none' }}>{loan.book.title}</p>
                        {children.length > 1 && <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#f9d174', fontSize: '0.68rem', opacity: 0.7, margin: '2px 0 0' }}>{loan.childName}</p>}
                      </div>
                      <button
                        onClick={() => toggleReturn(loan.loanId)}
                        style={{
                          flexShrink: 0, padding: '6px 12px', borderRadius: '20px', border: 'none', cursor: 'pointer',
                          fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 700, fontSize: '0.68rem', letterSpacing: '0.08em',
                          backgroundColor: isReturn ? '#e8533a' : 'rgba(237,219,195,0.12)',
                          color: isReturn ? '#fff' : '#eddbc3',
                          transition: 'all 0.2s',
                        }}>
                        {isReturn ? 'Returning' : 'Keeping'}
                      </button>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </section>

        {/* ── NEXT BONKERS DAY CARD ── */}
        <section style={{ marginBottom: '28px', position: 'relative' }}>
          {(() => {
            const { dayName, dateStr } = getNextBonkersDateParts(cutoffDay)
            return (
              <div style={{ borderRadius: '20px', border: `2px solid ${cutoffUrgent ? '#e57451' : 'rgba(237,219,195,0.2)'}`, backgroundColor: 'rgba(255,255,255,0.03)', padding: '18px 20px', textAlign: 'center' }}>
                <p style={{ fontFamily: 'var(--font-amatic)', fontWeight: 700, fontSize: '1.1rem', letterSpacing: '0.12em', color: cutoffUrgent ? '#e57451' : '#f9d174', margin: '0 0 2px' }}>Next Bonkers Day</p>
                <p style={{ fontFamily: 'var(--font-cormorant), serif', color: '#eddbc3', fontSize: '1.4rem', fontWeight: 700, lineHeight: 1, margin: 0 }}>{dayName} {dateStr}</p>
                <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={cutoffUrgent ? '#e57451' : '#f9d174'} strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    <p style={{ fontFamily: 'var(--font-amatic)', fontWeight: 700, color: cutoffUrgent ? '#e57451' : '#f9d174', fontSize: '1rem', letterSpacing: '0.08em', margin: 0 }}>Time left to choose</p>
                  </div>
                  <Countdown cutoffDay={cutoffDay} cutoffTime={cutoffTime} urgent={cutoffUrgent} compact />
                </div>
              </div>
            )
          })()}
        </section>

        {/* ── PENDING CHILD APPROVALS ── */}
        {pendingApprovalChildren.length > 0 && (
          <section style={{ marginBottom: '28px' }}>
            <p style={eyebrow}>Waiting for You</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
              {pendingApprovalChildren.map(child => (
                <div key={child.id} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px', borderRadius: '16px', border: '1.5px solid rgba(249,209,116,0.35)', backgroundColor: 'rgba(249,209,116,0.06)' }}>
                  <div style={{ width: '42px', height: '42px', borderRadius: '50%', backgroundColor: 'rgba(237,219,195,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {child.avatar_url
                      ? <img src={child.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                      : <span style={{ fontFamily: 'var(--font-cormorant), serif', color: '#eddbc3', fontSize: '1.2rem', fontWeight: 700 }}>{child.first_name[0]}</span>
                    }
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#f9d174', fontSize: '0.78rem', fontWeight: 700, margin: 0 }}>{child.first_name} has chosen their books</p>
                    <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#eddbc3', fontSize: '0.72rem', opacity: 0.6, margin: '2px 0 0' }}>Tap to review and approve</p>
                  </div>
                  <button
                    onClick={() => router.push(`/dashboard/approve/${child.id}`)}
                    style={{ flexShrink: 0, padding: '8px 14px', borderRadius: '10px', backgroundColor: '#f9d174', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 700, fontSize: '0.7rem', letterSpacing: '0.08em', color: '#1a1a1a' }}>
                    Review →
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── YOUR READERS ── */}
        <section style={{ marginBottom: '28px' }}>
          <p style={{ ...eyebrow, fontFamily: 'var(--font-amatic)', fontSize: '1.5rem', letterSpacing: '0.08em', textTransform: 'none', color: '#f9d174' }}>Your readers</p>
          <h2 style={{ ...heading, marginBottom: '16px' }}>Who&apos;s reading?</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
            {children.map(child => (
              <button key={child.id} onClick={() => router.push(`/dashboard/children/${child.id}`)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '20px 16px 16px', borderRadius: '20px', backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(237,219,195,0.12)', textAlign: 'left', cursor: 'pointer', width: '100%' }}>
                {/* Avatar */}
                <div style={{ width: '64px', height: '64px', borderRadius: '50%', overflow: 'hidden', backgroundColor: 'rgba(237,219,195,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px', border: '2px solid rgba(237,219,195,0.15)' }}>
                  {child.avatar_url
                    ? <img src={child.avatar_url} alt={child.first_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ fontFamily: 'var(--font-cormorant), serif', color: '#eddbc3', fontSize: '1.6rem', fontWeight: 700 }}>{child.first_name[0]}</span>
                  }
                </div>
                {/* Name */}
                <p style={{ fontFamily: 'var(--font-cormorant), serif', fontWeight: 700, color: '#eddbc3', fontSize: '1.6rem', margin: 0, lineHeight: 1 }}>{child.first_name}</p>
                {/* Age */}
                {child.age && <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#eddbc3', fontSize: '0.82rem', margin: '4px 0 0' }}>Age {child.age}</p>}
                {/* Books read */}
                <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600, color: '#eddbc3', fontSize: '0.78rem', margin: '6px 0 0' }}>
                  {!child.books_read_count ? 'No books read yet' : `${child.books_read_count} book${child.books_read_count !== 1 ? 's' : ''} read`}
                </p>
                {/* Top category */}
                {child.top_category && (
                  <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600, color: '#eddbc3', fontSize: '0.78rem', margin: '4px 0 0' }}>
                    Loves {child.top_category}
                  </p>
                )}
                {/* Interests — shown when built */}
                {child.interests && (
                  <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: 'rgba(237,219,195,0.6)', fontSize: '0.68rem', margin: '6px 0 0', lineHeight: 1.4 }}>
                    {child.first_name} loves {child.interests}
                  </p>
                )}
              </button>
            ))}
            {/* Add a Reader — square card only when odd number of children */}
            {children.length % 2 !== 0 && (
              <button onClick={() => router.push('/dashboard/children/new')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '20px 16px', borderRadius: '20px', backgroundColor: 'transparent', border: '1px dashed rgba(237,219,195,0.25)', cursor: 'pointer', width: '100%', minHeight: '160px' }}>
                <span style={{ fontSize: '1.6rem', color: 'rgba(237,219,195,0.3)' }}>+</span>
                <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600, fontSize: '0.68rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(237,219,195,0.35)' }}>Add a Reader</span>
              </button>
            )}
          </div>
          {/* Add a Reader — thin wide button when even number of children */}
          {children.length % 2 === 0 && (
            <button onClick={() => router.push('/dashboard/children/new')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px 16px', borderRadius: '16px', backgroundColor: 'transparent', border: '1px dashed rgba(237,219,195,0.25)', cursor: 'pointer', width: '100%', marginTop: '12px' }}>
              <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600, fontSize: '0.68rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(237,219,195,0.35)' }}>+ Add a Reader</span>
            </button>
          )}
        </section>

        {/* ── YOUR NEXT PILE ── */}
        <section id="next-stack" style={{ marginBottom: '28px' }}>
          <p style={{ ...eyebrow, fontFamily: 'var(--font-amatic)', fontSize: '1.5rem', letterSpacing: '0.08em', textTransform: 'none', color: '#f9d174' }}>Coming your way</p>
          <h2 style={heading}>Your Next Stack</h2>

          {cutoffPassed && nextStack.length > 0 ? (
            <>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '8px', padding: '6px 12px', borderRadius: '20px', backgroundColor: 'rgba(80,200,120,0.12)', border: '1px solid rgba(80,200,120,0.3)' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#50c878" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#50c878', fontSize: '0.72rem', fontWeight: 700, margin: 0, letterSpacing: '0.08em' }}>Locked in — on their way!</p>
              </div>
              <div className="flex gap-3 mt-4" style={{ overflowX: 'auto', paddingBottom: '4px' }}>
                {nextStack.map(item => (
                  <div key={item.id} style={{ flexShrink: 0 }}>
                    <div style={{ width: '80px', height: '108px', borderRadius: '10px', overflow: 'hidden', backgroundColor: 'rgba(237,219,195,0.08)', border: '1px solid rgba(237,219,195,0.2)' }}>
                      {item.book.cover_url
                        ? <img src={item.book.cover_url} alt={item.book.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.3 }}><svg width="24" height="24" viewBox="0 0 24 24" fill="#eddbc3"><path d="M6 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/></svg></div>
                      }
                    </div>
                    {children.length > 1 && <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#f9d174', fontSize: '0.62rem', margin: '4px 0 0', textAlign: 'center' }}>{item.childName}</p>}
                  </div>
                ))}
              </div>
            </>
          ) : nextStack.length > 0 ? (
            <>
              <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#eddbc3', fontSize: '0.78rem', opacity: 0.5, marginTop: '6px' }}>
                Still editable until {cutoffDay.charAt(0).toUpperCase() + cutoffDay.slice(1)} at {formatCutoffTime(cutoffTime)}.
              </p>
              <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {nextStack.map(item => (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', borderRadius: '14px', backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(237,219,195,0.12)' }}>
                    <div style={{ width: '44px', height: '60px', borderRadius: '6px', overflow: 'hidden', flexShrink: 0, backgroundColor: 'rgba(237,219,195,0.1)' }}>
                      {item.book.cover_url
                        ? <img src={item.book.cover_url} alt={item.book.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.3 }}><svg width="20" height="20" viewBox="0 0 24 24" fill="#eddbc3"><path d="M6 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/></svg></div>
                      }
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#eddbc3', fontSize: '0.82rem', fontWeight: 600, margin: 0, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.book.title}</p>
                      {children.length > 1 && <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#f9d174', fontSize: '0.68rem', opacity: 0.7, margin: '2px 0 0' }}>For {item.childName}</p>}
                    </div>
                    <button
                      onClick={() => removeFromStack(item.id)}
                      style={{ flexShrink: 0, width: '30px', height: '30px', borderRadius: '50%', border: '1px solid rgba(237,219,195,0.2)', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#eddbc3', opacity: 0.5 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                ))}
              </div>
              {availableSlots > 0 && (
                <div className="ghost-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '10px', marginTop: '16px' }}>
                  {Array.from({ length: availableSlots }).map((_, i) => (
                    <div key={i} style={{ aspectRatio: '3/4', borderRadius: '10px', border: '2px dashed rgba(237,219,195,0.45)', backgroundColor: 'rgba(237,219,195,0.09)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                      <img src="/bonky_front.png" alt="" style={{ height: '70%', width: 'auto', opacity: 0.32, pointerEvents: 'none' }} />
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div style={{ marginTop: '12px' }}>
              <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#eddbc3', fontSize: '0.82rem', opacity: 0.5, margin: '0 0 12px' }}>
                {nextStack.length} book{nextStack.length !== 1 ? 's' : ''} chosen
              </p>
              {availableSlots > 0 && (
                <div className="ghost-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '10px', marginTop: '4px' }}>
                  {Array.from({ length: availableSlots }).map((_, i) => (
                    <div key={i} style={{ aspectRatio: '3/4', borderRadius: '10px', border: '2px dashed rgba(237,219,195,0.45)', backgroundColor: 'rgba(237,219,195,0.09)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                      <img src="/bonky_front.png" alt="" style={{ height: '70%', width: 'auto', opacity: 0.32, pointerEvents: 'none' }} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        {/* ── YOUR BONKERS (settings) ── */}
        <section style={{ marginBottom: '28px' }}>
          <p style={{ ...eyebrow, fontFamily: 'var(--font-amatic)', fontSize: '1.5rem', letterSpacing: '0.08em', textTransform: 'none', color: '#f9d174', marginBottom: '12px' }}>Support</p>
          <div style={{ borderRadius: '16px', border: '1px solid rgba(237,219,195,0.12)', backgroundColor: 'rgba(255,255,255,0.03)', overflow: 'hidden' }}>
            <button
              onClick={() => router.push('/dashboard/settings')}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '16px 18px', background: 'none', outline: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
              <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#eddbc3', fontSize: '0.85rem' }}>Help & FAQs</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#eddbc3" strokeWidth="2" style={{ opacity: 0.3 }}><polyline points="9 18 15 12 9 6"/></svg>
            </button>
            <div style={{ borderTop: '1px solid rgba(237,219,195,0.08)', margin: '0 18px' }} />
            <button
              onClick={() => router.push('/dashboard/settings')}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '16px 18px', background: 'none', outline: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
              <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#eddbc3', fontSize: '0.85rem' }}>Contact us</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#eddbc3" strokeWidth="2" style={{ opacity: 0.3 }}><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
        </section>

      </div>

      {/* ── NO SLOTS POPUP ── */}
      {showNoSlotsPopup && (
        <div
          className="fixed inset-0 flex items-end justify-center"
          style={{ zIndex: 50, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          onClick={() => setShowNoSlotsPopup(false)}>
          <div
            onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: '576px', backgroundColor: '#14100d', borderRadius: '24px 24px 0 0', padding: '28px 24px 40px', border: '1px solid rgba(237,219,195,0.15)', borderBottom: 'none' }}>
            <div style={{ width: '40px', height: '4px', borderRadius: '2px', backgroundColor: 'rgba(237,219,195,0.2)', margin: '0 auto 20px' }} />
            <p style={{ fontFamily: 'var(--font-cormorant), serif', color: '#eddbc3', fontSize: '1.6rem', fontWeight: 700, margin: '0 0 8px' }}>No slots available</p>
            <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#eddbc3', fontSize: '0.85rem', opacity: 0.7, lineHeight: 1.6, margin: '0 0 24px' }}>
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
      <div className="fixed bottom-0 left-0 right-0" style={{ backgroundColor: 'rgba(8,4,2,0.95)', borderTop: '1px solid rgba(237,219,195,0.12)', backdropFilter: 'blur(16px)', zIndex: 40 }}>
        <div className="max-w-xl mx-auto flex items-center justify-around px-2" style={{ paddingTop: '8px', paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}>
          {[
            { label: 'Home', path: '/dashboard', exact: true, icon: <svg className="nav-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>, onClick: () => router.push('/dashboard') },
            { label: 'Library', path: '/dashboard/library', exact: false, icon: <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>, onClick: () => router.push('/dashboard/library?from=parent') },
            { label: 'Account', path: '/dashboard/account', exact: false, icon: <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>, onClick: () => router.push('/dashboard/account') },
            { label: 'Settings', path: '/dashboard/settings', exact: false, icon: <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>, onClick: () => router.push('/dashboard/settings') },
          ].map((item, i) => {
            const active = item.exact ? pathname === item.path : pathname.startsWith(item.path)
            return (
              <button key={i} onClick={item.onClick} className="flex flex-col items-center gap-1 flex-1" style={{ background: 'none', border: 'none', cursor: 'pointer', color: active ? '#f9d174' : '#eddbc3', opacity: 1, padding: '6px 0' }}>
                {item.icon}
                <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.58rem', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700 }}>{item.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </main>
  )
}
