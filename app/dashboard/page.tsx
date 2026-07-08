'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Book = {
  id: string
  title: string
  cover_url: string | null
  author: string | null
}

type SwapStatus = 'not_submitted' | 'child_confirmed_pending_approval' | 'submitted' | 'skipping'

type Child = {
  id: string
  first_name: string
  nickname: string
  avatar_url: string | null
  book_slot_allocation: number
  swap_permission: 'parent_only' | 'child_confirm_parent_approve' | 'independent_submit'
  current_books: Book[]
  swap_status: SwapStatus
}

type Member = {
  id: string
  first_name: string
  last_name: string
  email: string
  plan_name: string
  plan_books: number
  swap_day: string
  swap_cutoff_day: string
  swap_cutoff_time: string
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

function Countdown({ cutoffDay, cutoffTime }: { cutoffDay: string; cutoffTime: string }) {
  const [timeLeft, setTimeLeft] = useState('')
  const [urgent, setUrgent] = useState(false)

  useEffect(() => {
    const tick = () => {
      const cutoff = getNextCutoff(cutoffDay, cutoffTime)
      const diff = cutoff.getTime() - Date.now()
      if (diff <= 0) { setTimeLeft('Cutoff passed'); return }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24))
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      setUrgent(diff < 24 * 60 * 60 * 1000)
      if (days > 0) setTimeLeft(`${days}d ${hours}h ${mins}m`)
      else setTimeLeft(`${hours}h ${mins}m`)
    }
    tick()
    const id = setInterval(tick, 60000)
    return () => clearInterval(id)
  }, [cutoffDay, cutoffTime])

  return (
    <div className="rounded-2xl border-[2px] px-5 py-4 mb-5" style={{ borderColor: urgent ? '#e57451' : '#eddbc3', backgroundColor: urgent ? 'rgba(229,116,81,0.12)' : 'rgba(255,255,255,0.05)' }}>
      <p className="uppercase tracking-widest text-xs mb-1" style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: urgent ? '#e57451' : '#eddbc3', opacity: 0.8 }}>
        Next swap cutoff
      </p>
      <div className="flex items-baseline gap-3">
        <span className="font-black" style={{ fontFamily: 'var(--font-cormorant), serif', color: urgent ? '#e57451' : '#eddbc3', fontSize: '2rem', lineHeight: 1 }}>
          {timeLeft}
        </span>
        <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#eddbc3', fontSize: '0.85rem', opacity: 0.7 }}>
          {cutoffDay.charAt(0).toUpperCase() + cutoffDay.slice(1)} at {cutoffTime}
        </span>
      </div>
    </div>
  )
}

function SwapBadge({ status, permission, onAction }: { status: SwapStatus; permission: Child['swap_permission']; onAction: () => void }) {
  if (status === 'submitted') {
    return (
      <div className="flex items-center gap-2 mt-2">
        <img src="/checkmark_orange.png" alt="" style={{ width: '14px', height: '14px' }} />
        <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.75rem', color: '#eddbc3', opacity: 0.8 }}>Swap submitted</span>
      </div>
    )
  }
  if (status === 'child_confirmed_pending_approval') {
    return (
      <button onClick={onAction} className="mt-2 rounded-xl px-4 py-2 font-bold text-sm transition-all hover:opacity-90" style={{ backgroundColor: '#e57451', color: '#fff', fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.75rem' }}>
        Approve swap →
      </button>
    )
  }
  if (status === 'skipping') {
    return (
      <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.75rem', color: '#eddbc3', opacity: 0.5 }}>Skipping this week</span>
    )
  }
  return (
    <button onClick={onAction} className="mt-2 rounded-xl px-4 py-2 font-bold transition-all hover:opacity-90" style={{ backgroundColor: 'rgba(237,219,195,0.15)', border: '1px solid #eddbc3', color: '#eddbc3', fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.75rem' }}>
      {permission === 'parent_only' ? 'Build swap →' : 'No swap yet'}
    </button>
  )
}

function ChildCard({ child, onSwapAction }: { child: Child; onSwapAction: (childId: string) => void }) {
  return (
    <div className="rounded-2xl border-[2px] p-4" style={{ borderColor: '#eddbc3', backgroundColor: 'rgba(255,255,255,0.05)' }}>
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="rounded-full flex-shrink-0 flex items-center justify-center" style={{ width: '48px', height: '48px', backgroundColor: 'rgba(237,219,195,0.2)', border: '2px solid #eddbc3' }}>
          {child.avatar_url
            ? <img src={child.avatar_url} alt="" style={{ width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover' }} />
            : <span style={{ fontFamily: 'var(--font-cormorant), serif', color: '#eddbc3', fontSize: '1.4rem', fontWeight: 700 }}>{child.first_name[0]}</span>
          }
        </div>

        {/* Name + swap status */}
        <div className="flex-1 min-w-0">
          <p className="font-bold" style={{ fontFamily: 'var(--font-cormorant), serif', color: '#eddbc3', fontSize: '1.3rem', lineHeight: 1.1 }}>
            {child.first_name} <span style={{ opacity: 0.6, fontSize: '1rem', fontWeight: 400 }}>({child.nickname})</span>
          </p>
          <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#eddbc3', fontSize: '0.7rem', opacity: 0.6, marginTop: '2px' }}>
            {child.book_slot_allocation} book{child.book_slot_allocation !== 1 ? 's' : ''} / swap
          </p>
          <SwapBadge status={child.swap_status} permission={child.swap_permission} onAction={() => onSwapAction(child.id)} />
        </div>

        {/* Tap into profile */}
        <button style={{ color: '#eddbc3', opacity: 0.5, fontSize: '1.2rem', flexShrink: 0 }}>›</button>
      </div>

      {/* Current books */}
      {child.current_books.length > 0 && (
        <div className="mt-4">
          <p className="uppercase tracking-widest mb-2" style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#eddbc3', fontSize: '0.65rem', opacity: 0.6 }}>Currently reading</p>
          <div className="flex gap-3 flex-wrap">
            {child.current_books.map(book => (
              <div key={book.id} className="flex flex-col items-center gap-1" style={{ width: '60px' }}>
                <div className="rounded-lg overflow-hidden flex items-center justify-center" style={{ width: '60px', height: '80px', backgroundColor: 'rgba(237,219,195,0.15)', border: '1px solid rgba(237,219,195,0.3)' }}>
                  {book.cover_url
                    ? <img src={book.cover_url} alt={book.title} style={{ width: '60px', height: '80px', objectFit: 'cover' }} />
                    : <img src="/magic_book.png" alt="" style={{ width: '36px', height: 'auto', opacity: 0.5 }} />
                  }
                </div>
                <p className="text-center leading-tight" style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#eddbc3', fontSize: '0.6rem', opacity: 0.7, width: '60px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                  {book.title}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {child.current_books.length === 0 && (
        <div className="mt-4 rounded-xl px-3 py-2" style={{ backgroundColor: 'rgba(237,219,195,0.08)' }}>
          <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#eddbc3', fontSize: '0.7rem', opacity: 0.5 }}>No books at home yet</p>
        </div>
      )}
    </div>
  )
}

function NavLink({ icon, img, imgStyle, label, onClick }: { icon?: string; img?: string; imgStyle?: React.CSSProperties; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1 flex-1" style={{ color: '#eddbc3' }}>
      <span className="flex items-center justify-center" style={{ height: '40px' }}>
        {img ? <img src={img} alt="" style={{ height: '32px', width: 'auto', ...imgStyle }} /> : <span style={{ fontSize: '1.4rem', lineHeight: 1 }}>{icon}</span>}
      </span>
      <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.6rem', letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 700 }}>{label}</span>
    </button>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const [member, setMember] = useState<Member | null>(null)
  const [children, setChildren] = useState<Child[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: householdData } = await supabase
        .from('households')
        .select('id, first_name, last_name, swap_day, community_id, communities(swap_days)')
        .eq('user_id', user.id)
        .single()

      if (householdData) {
        const swapDays = (householdData as any).communities?.swap_days
        const firstSwapDay = Array.isArray(swapDays) ? swapDays[0] : (swapDays ?? 'tuesday')
        setMember({
          id: householdData.id,
          first_name: householdData.first_name ?? '',
          last_name: householdData.last_name ?? '',
          email: user.email ?? '',
          plan_name: '',
          plan_books: 0,
          swap_day: firstSwapDay,
          swap_cutoff_day: firstSwapDay,
          swap_cutoff_time: '18:00',
        })
      }

      const memberData = householdData

      const { data: childrenData } = await supabase
        .from('child_profiles')
        .select('id, name, nickname, avatar_id, book_slot_allocation, swap_permission')
        .eq('household_id', memberData?.id ?? '')
        .order('created_at')

      if (childrenData) {
        const enriched = await Promise.all(childrenData.map(async (child) => {
          const { data: loans } = await supabase
            .from('loans')
            .select('id, book_copies(id, books(id, title, cover_url, author))')
            .eq('child_id', child.id)
            .eq('status', 'checked_out')

          const { data: swapReq } = await supabase
            .from('swap_requests')
            .select('id, status')
            .eq('household_id', memberData?.id ?? '')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

          let swapStatus: SwapStatus = 'not_submitted'
          if (swapReq?.status === 'submitted' || swapReq?.status === 'confirmed') swapStatus = 'submitted'
          else if (swapReq?.status === 'child_confirmed') swapStatus = 'child_confirmed_pending_approval'

          const books = (loans ?? [])
            .map((l: any) => l.book_copies?.books)
            .filter(Boolean)

          return {
            id: child.id,
            first_name: child.name,
            nickname: child.nickname,
            avatar_url: child.avatar_url ?? null,
            book_slot_allocation: child.book_slot_allocation,
            swap_permission: child.swap_permission,
            current_books: books,
            swap_status: swapStatus,
          }
        }))
        setChildren(enriched)
      }

      setLoading(false)
    }
    load()
  }, [])

  const handleSwapAction = (childId: string) => {
    router.push(`/dashboard/swap/${childId}`)
  }

  const cutoffDay = member?.swap_cutoff_day ?? 'tuesday'
  const cutoffTime = member?.swap_cutoff_time ?? '18:00'

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ backgroundImage: 'url(/background_3.png)', backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <p style={{ fontFamily: 'var(--font-cormorant), serif', color: '#eddbc3', fontSize: '1.5rem' }}>Loading...</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen pb-24" style={{ backgroundImage: 'url(/background_3.png)', backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' }}>
      <div className="max-w-xl mx-auto px-4 pt-8">

        {/* Header */}
        <div className="flex flex-col items-center mb-6">
          <img src="/Bonkers_Word_Logo_White1.png" alt="Bonkers Book Club" style={{ width: '120px', height: 'auto', display: 'block', margin: '0 auto' }} />
        </div>

        {/* Swap day */}
        <div className="text-center mb-3">
          <p className="uppercase tracking-widest text-xs mb-1" style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#eddbc3', opacity: 0.7 }}>Your swap day is</p>
          <div className="flex items-center justify-center gap-2">
            <img src="/whiskers_left.png" alt="" style={{ height: '44px', width: 'auto' }} />
            <p style={{ fontFamily: 'var(--font-cormorant), serif', color: '#eddbc3', fontSize: '3rem', fontWeight: 700, lineHeight: 1 }}>
              {cutoffDay.charAt(0).toUpperCase() + cutoffDay.slice(1)}
            </p>
            <img src="/whiskers_right.png" alt="" style={{ height: '44px', width: 'auto' }} />
          </div>
        </div>

        {/* Countdown */}
        <Countdown cutoffDay={cutoffDay} cutoffTime={cutoffTime} />
        <p className="text-center mb-5" style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#eddbc3', fontSize: '0.8rem', lineHeight: '1.5', opacity: 0.85, marginTop: '-16px' }}>
          Choose your next books before the countdown ends. No request? No problem. Your books will stay with you until you&apos;re ready to swap.
        </p>


        {/* Children */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 style={{ fontFamily: 'var(--font-cormorant), serif', color: '#eddbc3', fontSize: '1.5rem', fontWeight: 700 }}>
              Your readers
            </h2>
            <button
              onClick={() => router.push('/dashboard/children/new')}
              className="rounded-xl px-3 py-1"
              style={{ border: '1px solid #eddbc3', fontFamily: 'var(--font-montserrat), sans-serif', color: '#eddbc3', fontSize: '0.7rem' }}
            >
              + Add child
            </button>
          </div>

          {children.length === 0 && (
            <div className="rounded-2xl border-[2px] border-dashed px-5 py-8 text-center" style={{ borderColor: '#eddbc3', opacity: 0.5 }}>
              <p style={{ fontFamily: 'var(--font-cormorant), serif', color: '#eddbc3', fontSize: '1.2rem' }}>No child profiles yet</p>
              <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#eddbc3', fontSize: '0.75rem', marginTop: '4px' }}>Add your first reader to get started</p>
            </div>
          )}

          {children.map(child => (
            <ChildCard key={child.id} child={child} onSwapAction={handleSwapAction} />
          ))}
        </div>

      </div>

      {/* Bottom nav */}
      <div className="fixed bottom-0 left-0 right-0 flex items-center justify-around px-4 py-3 border-t" style={{ backgroundColor: 'rgba(26,15,10,0.85)', borderColor: 'rgba(237,219,195,0.2)', backdropFilter: 'blur(8px)' }}>
        <NavLink img="/house_treehouse.png" imgStyle={{ height: '40px' }} label="Home" onClick={() => {}} />
        <div style={{ width: '1px', height: '40px', backgroundColor: 'rgba(26,15,10,0.15)' }} />
        <NavLink img="/Book_Stack.png" label="Library" onClick={() => router.push('/dashboard/library')} />
        <div style={{ width: '1px', height: '40px', backgroundColor: 'rgba(26,15,10,0.15)' }} />
        <NavLink img="/piggybank.png" label="Billing" onClick={() => router.push('/dashboard/billing')} />
        <div style={{ width: '1px', height: '40px', backgroundColor: 'rgba(26,15,10,0.15)' }} />
        <NavLink img="/magicwand_yellow.png" imgStyle={{ marginLeft: '8px', marginTop: '6px' }} label="Settings" onClick={() => router.push('/dashboard/settings')} />
      </div>
    </main>
  )
}
