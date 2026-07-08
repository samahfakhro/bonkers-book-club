'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const READING_LEVELS = [
  { id: 'little', label: 'Hatchling', age: '3–5 yrs' },
  { id: 'growing', label: 'Chick', age: '5–7 yrs' },
  { id: 'confident', label: 'Bird', age: '8–10 yrs' },
]

const READING_MODES = [
  { value: 'read_to', label: 'Read To' },
  { value: 'independent', label: 'Independent' },
  { value: 'both', label: 'Both' },
]

const SWAP_PERMISSIONS = [
  {
    value: 'prepare_only',
    label: 'Fly with the Flock',
    image: '/bonky_family.png',
    bullets: [
      { text: 'Parent must approve\nevery swap', yes: true },
    ],
  },
  {
    value: 'independent_submit',
    label: 'Fly Solo',
    image: '/bonky_cape.png',
    bullets: [
      { text: 'Child confirms swaps\nwithout parent approval', yes: true },
    ],
  },
]


const inputClass = "w-full rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-amber-400 bg-[#efe7dd] border-none"

export default function NewChildPage() {
  const router = useRouter()
  const [householdId, setHouseholdId] = useState<string | null>(null)
  const [planBookCount, setPlanBookCount] = useState<number | null>(null)
  const [existingAllocated, setExistingAllocated] = useState(0)
  const [loading, setLoading] = useState(false)
  const [dbError, setDbError] = useState('')
  const [slotsError, setSlotsError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const [form, setForm] = useState({
    name: '',
    dob: '',
    readingLevel: '',
    readingMode: '',
    bookSlots: 2,
    swapPermission: 'prepare_only',
    pin: '',
  })

  const set = (field: string, value: string | number) =>
    setForm(prev => ({ ...prev, [field]: value }))

  const remainingSlots = planBookCount !== null ? planBookCount - existingAllocated : null

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/login'); return }

      const { data: household } = await supabase
        .from('households')
        .select('id')
        .eq('user_id', user.id)
        .single()
      if (!household) return
      setHouseholdId(household.id)

      // Fetch plan book_count via subscription
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('subscription_plans(book_count)')
        .eq('household_id', household.id)
        .eq('status', 'active')
        .maybeSingle()
      const bookCount = (sub?.subscription_plans as any)?.book_count ?? null
      setPlanBookCount(bookCount)

      // Fetch sum of existing children's allocations
      const { data: children } = await supabase
        .from('child_profiles')
        .select('book_slot_allocation')
        .eq('household_id', household.id)
      const allocated = (children ?? []).reduce((sum: number, c: any) => sum + (c.book_slot_allocation ?? 0), 0)
      setExistingAllocated(allocated)

      // Default bookSlots to 0 if no remaining slots
      const remaining = bookCount !== null ? bookCount - allocated : null
      if (remaining !== null && remaining <= 0) {
        setForm(prev => ({ ...prev, bookSlots: 0 }))
      }
    })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setDbError('')

    const errors: Record<string, string> = {}
    if (!form.name.trim()) errors.name = 'Please add a name.'
    if (!form.dob) errors.dob = 'Please add a birthday.'
    if (!form.readingLevel) errors.readingLevel = 'Please choose a reading level.'
    if (!form.readingMode) errors.readingMode = 'Please choose how they read.'
    if (form.pin && !/^\d{4}$/.test(form.pin)) errors.pin = 'PIN must be exactly 4 digits.'

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      const firstKey = Object.keys(errors)[0]
      document.getElementById(`field-${firstKey}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }

    setFieldErrors({})
    setLoading(true)

    const { error: saveError } = await supabase.from('child_profiles').insert({
      household_id: householdId,
      name: form.name.trim(),
      date_of_birth: form.dob,
      reading_level: form.readingLevel,
      reading_mode: form.readingMode,
      book_slot_allocation: form.bookSlots,
      swap_permission: form.swapPermission,
      access_pin: form.pin || null,
    })

    setLoading(false)

    if (saveError) {
      setDbError(`Couldn't save profile: ${saveError.message}`)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    router.push('/dashboard')
  }

  const sectionLabel = (text: string) => (
    <p className="uppercase tracking-widest mb-3" style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#f9d174', fontSize: '1rem' }}>
      {text}
    </p>
  )

  return (
    <main className="min-h-screen pb-16 px-4 pt-8" style={{ backgroundImage: 'url(/background_3.png)', backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed', overflowX: 'hidden' }}>
      <div className="max-w-lg mx-auto">

        <div className="flex items-center mb-6">
          <button onClick={() => router.push('/dashboard')} style={{ color: '#eddbc3', fontSize: '1.5rem', lineHeight: 1, background: 'none', border: 'none', cursor: 'pointer', marginRight: '12px' }}>‹</button>
          <img src="/Bonkers_Word_Logo_White1.png" alt="Bonkers Book Club" style={{ width: '120px', height: 'auto', display: 'block', margin: '0 auto' }} />
          <div style={{ width: '28px' }} />
        </div>

        <h1 className="text-center font-black mb-8" style={{ fontFamily: 'var(--font-cormorant), serif', color: '#eddbc3', fontSize: '2.6rem', lineHeight: 1.1 }}>
          {form.name.trim() || 'Add a Child'}
        </h1>

        {dbError && (
          <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm mb-6">
            {dbError}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-8">

          {/* Name */}
          <section>
            {sectionLabel("Child's details")}
            <div className="flex flex-col gap-3">
              <div id="field-name">
                <input type="text" placeholder="Name *"
                  value={form.name} onChange={e => { set('name', e.target.value); setFieldErrors(prev => ({ ...prev, name: '' })) }}
                  className={inputClass} />
                {fieldErrors.name && <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#e57451', fontSize: '0.95rem', marginTop: '4px', paddingLeft: '4px' }}>{fieldErrors.name}</p>}
              </div>
              <div id="field-dob" className="flex flex-col" style={{ gap: '4px' }}>
                <input type="text" placeholder="Birthday *"
                  value={form.dob} onChange={e => { set('dob', e.target.value); setFieldErrors(prev => ({ ...prev, dob: '' })) }}
                  className={inputClass} />
                <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#eddbc3', fontSize: '0.85rem', paddingLeft: '4px' }}>dd/mm/yyyy</p>
                {fieldErrors.dob && <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#e57451', fontSize: '0.95rem', paddingLeft: '4px' }}>{fieldErrors.dob}</p>}
              </div>
            </div>
          </section>

          {/* Reading level */}
          <section>
            {sectionLabel('Reading level')}
            <div id="field-readingLevel">
              <select value={form.readingLevel} onChange={e => { set('readingLevel', e.target.value); setFieldErrors(prev => ({ ...prev, readingLevel: '' })) }} className={inputClass} style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '1rem', width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
                <option value="">Select reading level</option>
                {READING_LEVELS.map(level => (
                  <option key={level.id} value={level.id}>{level.label} ({level.age})</option>
                ))}
              </select>
              {fieldErrors.readingLevel && <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#e57451', fontSize: '0.95rem', marginTop: '4px', paddingLeft: '4px' }}>{fieldErrors.readingLevel}</p>}
            </div>
          </section>

          {/* Reading mode */}
          <section>
            {sectionLabel('How do they read?')}
            <div id="field-readingMode">
              <div className="flex gap-3">
                {READING_MODES.map(mode => (
                  <button key={mode.value} type="button"
                    onClick={() => { set('readingMode', mode.value); setFieldErrors(prev => ({ ...prev, readingMode: '' })) }}
                    className="flex-1 py-2 rounded-xl transition-all"
                    style={{
                      backgroundColor: '#efe7dd',
                      border: form.readingMode === mode.value ? '4px solid #e57451' : '4px solid transparent',
                      fontFamily: 'var(--font-cormorant), serif', color: '#1a0a00', fontSize: '1.25rem',
                    }}>
                    {mode.label}
                  </button>
                ))}
              </div>
              {fieldErrors.readingMode && <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#e57451', fontSize: '0.95rem', marginTop: '6px', paddingLeft: '4px' }}>{fieldErrors.readingMode}</p>}
            </div>
          </section>

          {/* Book slots */}
          <section>
            {sectionLabel('Books per swap')}
            <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#eddbc3', fontSize: '0.9rem', marginBottom: '12px' }}>
              How many books can this child receive each swap? (you can change this at any time)
            </p>
            <div className="flex items-center justify-center gap-6">
              <button type="button"
                onClick={() => { set('bookSlots', Math.max(0, form.bookSlots - 1)); setSlotsError('') }}
                className="flex items-center justify-center rounded-full"
                style={{ width: '44px', height: '44px', border: '2px solid #eddbc3', color: '#eddbc3', fontSize: '1.5rem', backgroundColor: 'transparent' }}>
                −
              </button>
              <span style={{ fontFamily: 'var(--font-cormorant), serif', color: '#eddbc3', fontSize: '3rem', fontWeight: 700, lineHeight: 1, minWidth: '40px', textAlign: 'center' }}>
                {form.bookSlots}
              </span>
              <button type="button"
                onClick={() => {
                  if (remainingSlots !== null && form.bookSlots >= remainingSlots) {
                    setSlotsError("You've used all your plan's book slots. To add more here, reduce another child's allocation first.")
                  } else {
                    set('bookSlots', form.bookSlots + 1)
                    setSlotsError('')
                  }
                }}
                className="flex items-center justify-center rounded-full"
                style={{ width: '44px', height: '44px', border: '2px solid #eddbc3', color: '#eddbc3', fontSize: '1.5rem', backgroundColor: 'transparent' }}>
                +
              </button>
            </div>
            {slotsError && (
              <p className="text-center mt-3" style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#e57451', fontSize: '0.95rem', lineHeight: '1.5' }}>
                {slotsError}
              </p>
            )}
            {remainingSlots !== null && (
              <p className="text-center mt-2" style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#eddbc3', fontSize: '0.75rem', opacity: 0.6 }}>
                {remainingSlots - form.bookSlots} of {planBookCount} plan slots remaining after this child
              </p>
            )}
          </section>

          {/* Swap permission */}
          <section>
            {sectionLabel('Swap permission')}
            <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#eddbc3', fontSize: '0.9rem', marginBottom: '12px' }}>
              How much control does this child have over their book swaps?
            </p>
            <div className="flex flex-col gap-3">
              {SWAP_PERMISSIONS.map(perm => (
                <button key={perm.value} type="button"
                  onClick={() => set('swapPermission', perm.value)}
                  className="text-left px-4 py-4 rounded-xl transition-all"
                  style={{
                    backgroundColor: '#efe7dd',
                    border: form.swapPermission === perm.value ? '4px solid #e57451' : '4px solid transparent',
                    position: 'relative',
                    minHeight: '100px',
                    overflow: 'hidden',
                  }}>
                  <p className="flex items-start gap-2" style={{ fontFamily: 'var(--font-cormorant), serif', color: '#1a0a00', fontSize: '1.6rem', fontWeight: 700, marginBottom: '4px' }}>
                    <img src={form.swapPermission === perm.value ? '/star_button_on.png' : '/star_button_off.png'} alt="" style={{ width: '18px', height: '18px', marginTop: '10px' }} />
                    {perm.label}
                  </p>
                  <ul className="mt-1 flex flex-col gap-1">
                    {perm.bullets.map((b, i) => (
                      <li key={i} className="flex items-center gap-2" style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#1a0a00', fontSize: '0.9rem', opacity: b.yes ? 1 : 0.5 }}>
                        <span style={{ whiteSpace: 'pre-line' }}>{b.text}</span>
                      </li>
                    ))}
                  </ul>
                  {perm.image && (
                    <img src={perm.image} alt="" style={{ position: 'absolute', bottom: 0, right: 0, height: '105px', width: 'auto' }} />
                  )}
                </button>
              ))}
            </div>
          </section>

          {/* Optional PIN */}
          <section>
            {sectionLabel('Profile PIN (optional)')}
            <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#eddbc3', fontSize: '0.9rem', marginBottom: '12px', lineHeight: '1.5' }}>
              Set a 4-digit PIN to stop mischievous siblings from sneaking into each other's profiles.
            </p>
            <div className="flex flex-col gap-3">
              <div id="field-pin">
              <input
                type="text"
                inputMode="numeric"
                placeholder="4-digit PIN"
                maxLength={4}
                value={form.pin}
                onChange={e => { set('pin', e.target.value.replace(/\D/g, '').slice(0, 4)); setFieldErrors(prev => ({ ...prev, pin: '' })) }}
                className={inputClass}
                style={{ letterSpacing: '0.3em', textAlign: 'center', fontSize: '1.2rem' }}
              />
              {fieldErrors.pin && <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#e57451', fontSize: '0.95rem', marginTop: '4px', paddingLeft: '4px' }}>{fieldErrors.pin}</p>}
              </div>
            </div>
          </section>

          {/* Submit */}
          <div className="relative flex items-center justify-center" style={{ width: '71%', maxWidth: '260px', margin: '0 auto 8px' }}>
            <img src="/whiskers_left.png" alt="" style={{ position: 'absolute', left: '-15px', height: '50px', width: 'auto', zIndex: 1, pointerEvents: 'none' }} />
            <div style={{ position: 'relative', width: '100%', paddingBottom: 'calc(100% / 2.97)' }}>
              <button type="submit" disabled={loading}
                className="flex items-center justify-center border-none bg-transparent cursor-pointer disabled:opacity-60"
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', backgroundImage: 'url(/button2.png)', backgroundSize: '100% 100%', backgroundRepeat: 'no-repeat' }}>
                <span className="flex items-center gap-2" style={{ fontFamily: 'var(--font-amatic)', fontWeight: 700, fontSize: '1.8rem', color: 'white', letterSpacing: '0.04em', marginBottom: '10px' }}>
                  {loading ? 'Saving...' : 'Create Profile'}
                  {!loading && <img src="/magicwand.png" alt="" style={{ height: '22px', width: 'auto' }} />}
                </span>
              </button>
            </div>
            <img src="/whiskers_right.png" alt="" style={{ position: 'absolute', right: '-15px', height: '50px', width: 'auto', zIndex: 1, pointerEvents: 'none' }} />
          </div>

          <button type="button" onClick={() => router.push('/dashboard')}
            className="flex items-center justify-center gap-1"
            style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#eddbc3', fontSize: '0.9rem', opacity: 0.5, textAlign: 'center', marginTop: '-48px' }}>
            ← Go back
          </button>

        </form>
      </div>
    </main>
  )
}
