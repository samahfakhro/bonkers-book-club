'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
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
      { text: 'You approve each time', yes: true },
    ],
  },
  {
    value: 'independent_submit',
    label: 'Fly Solo',
    image: '/bonky_cape.png',
    bullets: [
      { text: '{name} confirms without\nyour approval', yes: true },
    ],
  },
]


const inputClass = "w-full border border-[#ddd6cc] rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-300 bg-white text-[#1a2744] font-[var(--font-montserrat)]"
const labelStyle: React.CSSProperties = { fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600, fontSize: '0.7rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#1a2f51', display: 'block', marginBottom: '6px' }

export default function NewChildPage() {
  const router = useRouter()
  const pathname = usePathname()
  const [householdId, setHouseholdId] = useState<string | null>(null)
  const [planBookCount, setPlanBookCount] = useState<number | null>(null)
  const [existingAllocated, setExistingAllocated] = useState(0)
  const [loading, setLoading] = useState(false)
  const [dbError, setDbError] = useState('')
  const [slotsError, setSlotsError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [hasParentPin, setHasParentPin] = useState(false)

  const [form, setForm] = useState({
    name: '',
    lastName: '',
    dob: '',
    dobDay: '',
    dobMonth: '',
    dobYear: '',
    readingLevel: '',
    readingMode: '',
    bookSlots: null as number | null,
    swapPermission: '',
    reviewDisplay: '',
    pin: '',
    parentPin: '',
  })
  const dobMonthRef = useRef<HTMLInputElement>(null)
  const dobYearRef = useRef<HTMLInputElement>(null)

  const set = (field: string, value: string | number) =>
    setForm(prev => ({ ...prev, [field]: value }))

  const remainingSlots = planBookCount !== null ? planBookCount - existingAllocated : null

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/login'); return }

      const { data: household } = await supabase
        .from('households')
        .select('id, parent_pin_hash')
        .eq('user_id', user.id)
        .single()
      if (!household) return
      setHouseholdId(household.id)
      setHasParentPin(!!household.parent_pin_hash)

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

      // If no remaining slots, cap at 0
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

    if (form.pin && !/^\d{4}$/.test(form.pin)) errors.pin = 'PIN must be exactly 4 digits.'
    if (!hasParentPin && !/^\d{4}$/.test(form.parentPin)) errors.parentPin = 'Please set a 4-digit parent PIN.'

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      const firstKey = Object.keys(errors)[0]
      document.getElementById(`field-${firstKey}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }

    setFieldErrors({})
    setLoading(true)

    if (!hasParentPin && form.parentPin) {
      await supabase.from('households').update({ parent_pin_hash: form.parentPin }).eq('id', householdId)
    }

    const { error: saveError } = await supabase.from('child_profiles').insert({
      household_id: householdId,
      name: form.name.trim(),
      last_name: form.lastName.trim() || null,
      date_of_birth: (() => { const [d, m, y] = form.dob.split('/'); return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}` })(),
      reading_mode: form.readingMode,
      book_slot_allocation: form.bookSlots ?? null,
      swap_permission: form.swapPermission,
      review_display: form.reviewDisplay,
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
    <p style={{ fontFamily: 'var(--font-cormorant), serif', color: '#1a2f51', fontSize: '1.5rem', marginBottom: '8px', marginTop: '20px' }}>
      {text}
    </p>
  )

  return (
    <>
    <style>{`.dob-input::placeholder { color: rgba(26,47,81,0.35); }`}</style>
    <main className="min-h-screen pb-32" style={{ position: 'relative', backgroundColor: '#fefaf2', overflowX: 'hidden' }}>
      <div style={{ padding: '16px 20px 8px', lineHeight: 1 }}>
        <p style={{ fontFamily: 'var(--font-amatic)', fontWeight: 700, fontSize: '3rem', color: '#1a2744', letterSpacing: '0.04em', margin: 0 }}>BONKERS</p>
        <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600, fontSize: '0.58rem', color: '#1a2744', letterSpacing: '0.18em', textTransform: 'uppercase', margin: '2px 0 0', lineHeight: 1.4 }}>THE CHILDREN'S LIBRARY</p>
      </div>
      <div className="max-w-lg mx-auto px-4" style={{ paddingTop: '40px', paddingBottom: '100px' }}>

        <h1 className="text-center font-black mb-8" style={{ fontFamily: 'var(--font-cormorant), serif', color: '#1a2f51', fontSize: '2rem', fontWeight: 800, lineHeight: 1.05 }}>
          {form.name.trim() || 'Add a Reader'}
        </h1>

        {dbError && (
          <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm mb-6">
            {dbError}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-8">

          {/* Name */}
          <section className="flex flex-col gap-3">
            <div id="field-name">
              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>First name</label>
                  <input type="text" placeholder="First name"
                    value={form.name} onChange={e => { set('name', e.target.value); setFieldErrors(prev => ({ ...prev, name: '' })) }}
                    className={inputClass} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Last name</label>
                  <input type="text" placeholder="Last name"
                    value={form.lastName} onChange={e => set('lastName', e.target.value)}
                    className={inputClass} />
                </div>
              </div>
              {fieldErrors.name && <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#e57451', fontSize: '0.95rem', marginTop: '4px', paddingLeft: '4px' }}>{fieldErrors.name}</p>}
            </div>
            <div id="field-dob" className="flex flex-col gap-1">
              <label style={labelStyle}>Date of Birth</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input type="text" inputMode="numeric" maxLength={2} placeholder="DD"
                  value={form.dobDay}
                  onChange={e => {
                    const v = e.target.value.replace(/\D/g, '')
                    setForm(prev => ({ ...prev, dobDay: v, dob: `${v}/${prev.dobMonth}/${prev.dobYear}` }))
                    setFieldErrors(prev => ({ ...prev, dob: '' }))
                    if (v.length === 2) dobMonthRef.current?.focus()
                  }}
                  className={`${inputClass} dob-input`} style={{ width: '72px', textAlign: 'center', paddingLeft: '4px', paddingRight: '4px' }} />
                <span style={{ color: '#1a2f51', fontSize: '1.2rem' }}>/</span>
                <input ref={dobMonthRef} type="text" inputMode="numeric" maxLength={2} placeholder="MM"
                  value={form.dobMonth}
                  onChange={e => {
                    const v = e.target.value.replace(/\D/g, '')
                    setForm(prev => ({ ...prev, dobMonth: v, dob: `${prev.dobDay}/${v}/${prev.dobYear}` }))
                    setFieldErrors(prev => ({ ...prev, dob: '' }))
                    if (v.length === 2) dobYearRef.current?.focus()
                  }}
                  className={`${inputClass} dob-input`} style={{ width: '72px', textAlign: 'center', paddingLeft: '4px', paddingRight: '4px' }} />
                <span style={{ color: '#1a2f51', fontSize: '1.2rem' }}>/</span>
                <input ref={dobYearRef} type="text" inputMode="numeric" maxLength={4} placeholder="YYYY"
                  value={form.dobYear}
                  onChange={e => {
                    const v = e.target.value.replace(/\D/g, '')
                    setForm(prev => ({ ...prev, dobYear: v, dob: `${prev.dobDay}/${prev.dobMonth}/${v}` }))
                    setFieldErrors(prev => ({ ...prev, dob: '' }))
                  }}
                  className={`${inputClass} dob-input`} style={{ width: '100px', textAlign: 'center', paddingLeft: '4px', paddingRight: '4px' }} />
              </div>
              {fieldErrors.dob && <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#e57451', fontSize: '0.95rem', paddingLeft: '4px' }}>{fieldErrors.dob}</p>}
            </div>
          </section>


          {/* Swap permission */}
          <section>
            <p style={{ fontFamily: 'var(--font-cormorant), serif', fontWeight: 700, color: '#1a2f51', fontSize: '1.4rem', margin: '0 0 12px', lineHeight: 1 }}>Independence Level</p>
            <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#1a2f51', fontSize: '0.9rem', marginBottom: '12px' }}>
              How much control would you like {form.name.trim() || 'this reader'} to have over book choices, deliveries & collections?
            </p>
            <div className="flex flex-col gap-3">
              {SWAP_PERMISSIONS.map((perm, pi) => (
                <button key={perm.value} type="button"
                  onClick={() => set('swapPermission', perm.value)}
                  className="text-left px-4 py-4 rounded-2xl transition-all"
                  style={{
                    backgroundColor: form.swapPermission === perm.value ? '#fffef9' : 'transparent',
                    border: form.swapPermission === perm.value ? '4px solid #fee297' : '2px solid #e8e0d4',
                    position: 'relative',
                    minHeight: '100px',
                    overflow: 'hidden',
                  }}>
                  <p className="flex items-start gap-2" style={{ fontFamily: 'var(--font-cormorant), serif', color: '#1a2f51', fontSize: '1.6rem', fontWeight: 700, marginBottom: '4px', paddingRight: '90px' }}>
{perm.label}
                  </p>
                  <ul className="mt-1 flex flex-col gap-1" style={{ paddingRight: pi === 0 ? '115px' : '90px' }}>
                    {perm.bullets.map((b, i) => (
                      <li key={i} style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#1a2f51', fontSize: '0.9rem', opacity: b.yes ? 1 : 0.5 }}>
                        <span style={{ whiteSpace: 'pre-line' }}>{b.text.replace('{name}', form.name.trim() || 'Child')}</span>
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

          {/* Parent PIN — only shown if not yet set */}
          {!hasParentPin && (
            <section id="field-parentPin">
              <p style={{ fontFamily: 'var(--font-cormorant), serif', fontWeight: 700, color: '#1a2f51', fontSize: '1.4rem', margin: '0 0 12px', lineHeight: 1 }}>Parent PIN</p>
              <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#1a2f51', fontSize: '0.85rem', marginBottom: '12px' }}>
                Your PIN keeps the parent dashboard locked when kids are using Bonkers — so little hands can&apos;t reach billing or account settings.
              </p>
              <input type="text" inputMode="numeric" maxLength={4} placeholder="••••"
                value={form.parentPin}
                onChange={e => { set('parentPin', e.target.value.replace(/\D/g, '').slice(0, 4)); setFieldErrors(prev => ({ ...prev, parentPin: '' })) }}
                className={inputClass} style={{ letterSpacing: '0.3em', textAlign: 'center', fontSize: '1.1rem' }} />
              {fieldErrors.parentPin && <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#e57451', fontSize: '0.9rem', marginTop: '6px' }}>{fieldErrors.parentPin}</p>}
            </section>
          )}

          {/* Book slots */}
          <section>
            <p style={{ fontFamily: 'var(--font-cormorant), serif', fontWeight: 700, color: '#1a2f51', fontSize: '1.4rem', margin: '0 0 12px', lineHeight: 1 }}>Book Allocation <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 400, fontSize: '0.75rem', opacity: 0.7 }}>(optional)</span></p>
            <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#1a2f51', fontSize: '0.9rem', marginBottom: '12px', lineHeight: '1.5' }}>
              Set how many books {form.name.trim() || 'this reader'} can choose each Bonkers Day. Useful if you have multiple children choosing independently. Leave blank if you don't need a limit per child.
            </p>
            <div className="flex items-center justify-center gap-6">
              <button type="button"
                onClick={() => {
                  if (form.bookSlots === null || form.bookSlots <= 1) {
                    set('bookSlots', null as any)
                  } else {
                    set('bookSlots', form.bookSlots - 1)
                  }
                  setSlotsError('')
                }}
                className="flex items-center justify-center rounded-full"
                style={{ width: '44px', height: '44px', border: '2px solid #1a2f51', color: '#1a2f51', fontSize: '1.5rem', backgroundColor: 'transparent', cursor: 'pointer' }}>
                −
              </button>
              <span style={{ fontFamily: 'var(--font-cormorant), serif', color: '#1a2f51', fontSize: '3rem', fontWeight: 700, lineHeight: 1, minWidth: '40px', textAlign: 'center' }}>
                {form.bookSlots === null ? '—' : form.bookSlots}
              </span>
              <button type="button"
                onClick={() => {
                  const current = form.bookSlots ?? 0
                  if (remainingSlots !== null && current >= remainingSlots) {
                    setSlotsError("You've used all your plan's book slots. To add more here, reduce another child's allocation first.")
                  } else {
                    set('bookSlots', current + 1)
                    setSlotsError('')
                  }
                }}
                className="flex items-center justify-center rounded-full"
                style={{ width: '44px', height: '44px', border: '2px solid #1a2f51', color: '#1a2f51', fontSize: '1.5rem', backgroundColor: 'transparent', cursor: 'pointer' }}>
                +
              </button>
            </div>
            {slotsError && (
              <p className="text-center mt-3" style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#e57451', fontSize: '0.95rem', lineHeight: '1.5' }}>
                {slotsError}
              </p>
            )}
            {remainingSlots !== null && form.bookSlots !== null && (
              <p className="text-center mt-2" style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#1a2f51', fontSize: '0.75rem', opacity: 0.6 }}>
                {remainingSlots - form.bookSlots} of {planBookCount} plan slots remaining after this reader
              </p>
            )}
          </section>

          {/* Optional PIN */}
          <section>
            <p style={{ fontFamily: 'var(--font-cormorant), serif', fontWeight: 700, color: '#1a2f51', fontSize: '1.4rem', margin: '0 0 12px', lineHeight: 1 }}>Child Profile PIN <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 400, fontSize: '0.75rem', opacity: 0.7 }}>(optional)</span></p>
            <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#1a2f51', fontSize: '0.9rem', marginBottom: '12px', lineHeight: '1.5' }}>
              Keep mischievous siblings out of this profile.
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

          {/* Review display name */}
          <section>
            <p style={{ fontFamily: 'var(--font-cormorant), serif', fontWeight: 700, color: '#1a2f51', fontSize: '1.4rem', margin: '0 0 12px', lineHeight: 1 }}>Name Shown On Reviews</p>
            <div className="flex flex-col gap-2">
              {(() => {
                const age = form.dobYear && form.dobDay && form.dobMonth ? Math.floor((Date.now() - new Date(`${form.dobYear}-${form.dobMonth.padStart(2,'0')}-${form.dobDay.padStart(2,'0')}`).getTime()) / (1000*60*60*24*365.25)) : null
                return [
                  { value: 'first_name', label: `${form.name.trim()}${age !== null ? `, Age ${age}` : ''}` },
                  { value: 'anonymous', label: `Bonkers reader${age !== null ? `, Age ${age}` : ''}` },
                ].map(opt => (
                  <button key={opt.value} type="button" onClick={() => set('reviewDisplay', opt.value)}
                    className="flex items-center gap-3 text-left"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}>
                    <img src={form.reviewDisplay === opt.value ? '/star_yellow.png' : '/star_cream.png'} alt="" style={{ width: form.reviewDisplay === opt.value ? '40px' : '34px', height: form.reviewDisplay === opt.value ? '40px' : '34px', flexShrink: 0 }} />
                    <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#1a2f51', fontSize: '0.95rem', fontWeight: 400, margin: 0 }}>{opt.label}</p>
                  </button>
                ))
              })()}
            </div>
          </section>

          {/* Submit */}
          <div className="flex items-center justify-center" style={{ margin: '0 auto 8px' }}>
            <button type="submit" disabled={loading}
              style={{ backgroundColor: '#1a2f51', border: 'none', borderRadius: '999px', cursor: loading ? 'not-allowed' : 'pointer', padding: '18px 56px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: '220px', opacity: loading ? 0.7 : 1, fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 500, fontSize: '0.9rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'white' }}>
              {loading ? 'Saving...' : 'Create Profile'}
            </button>
          </div>


        </form>
      </div>
      {/* ── BOTTOM NAV ── */}
      <div className="fixed bottom-0 left-0 right-0" style={{ backgroundColor: '#1a2f51', borderTop: '1px solid rgba(255,255,255,0.08)', zIndex: 40 }}>
        <div className="max-w-xl mx-auto flex items-center justify-around px-2 py-2">
          {[
            { label: 'Home', path: '/dashboard', exact: true, icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>, onClick: () => router.push('/dashboard') },
            { label: 'Library', path: '/dashboard/library', exact: false, icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>, onClick: () => router.push('/dashboard/library') },
            { label: 'Account', path: '/dashboard/account', exact: false, icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>, onClick: () => router.push('/dashboard/account') },
            { label: 'Settings', path: '/dashboard/settings', exact: false, icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>, onClick: () => router.push('/dashboard/settings') },
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
    </>
  )
}
