'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

const READING_LEVELS = [
  { id: 'little', label: 'Little Reader', age: '3–5 yrs' },
  { id: 'growing', label: 'Growing Reader', age: '5–7 yrs' },
  { id: 'confident', label: 'Confident Reader', age: '8–10 yrs' },
]

const READING_MODES = [
  { value: 'read_to', label: 'Mostly Read To' },
  { value: 'independent', label: 'Independent Reader' },
  { value: 'both', label: 'Mix of Both' },
]

const SWAP_PERMISSIONS = [
  {
    value: 'wishlist_only',
    label: 'Parent Picks',
    desc: 'Your child can browse books and build a wishlist, but only you can create and submit swap requests.',
    bullets: [
      { text: 'Child can build wishlist', yes: true },
      { text: 'Child cannot prepare swaps', yes: false },
      { text: 'Child cannot submit swaps', yes: false },
    ],
  },
  {
    value: 'prepare_only',
    label: 'Team Effort',
    desc: "Child can browse books, build a wishlist, and prepare a swap request, but you'll review and approve the books and the swap. You will be notified to approve books and swap.",
    bullets: [
      { text: 'Child can build wishlist', yes: true },
      { text: 'Child can prepare swaps', yes: true },
      { text: 'Child cannot submit swaps', yes: false },
    ],
  },
  {
    value: 'independent_submit',
    label: 'Bonkers Independent',
    desc: 'Child can browse books, build a wishlist, and prepare AND submit a swap request themselves, without your approval. You will still be able to see everything they\'ve requested and their next swap, and will be notified.',
    bullets: [
      { text: 'Child can build wishlist', yes: true },
      { text: 'Child can prepare swaps', yes: true },
      { text: 'Child can submit swaps independently', yes: true },
    ],
  },
]

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

// Weekly book slots per plan
const PLAN_WEEKLY_SLOTS: Record<string, number> = {
  starter: 2,
  mid: 4,
  full: 6,
}

type Child = {
  firstName: string
  lastName: string
  dob: string
  avatarId: string
  readingLevel: string
  readingMode: string
  bookSlots: number
  swapPermission: string
}

const emptyChild = (): Child => ({
  firstName: '',
  lastName: '',
  dob: '',
  avatarId: '',
  readingLevel: '',
  readingMode: '',
  bookSlots: 0,
  swapPermission: 'wishlist_only',
})

const inputClass = "w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
const labelClass = "block text-sm font-semibold text-gray-700 mb-1"

function ChildrenForm() {
  const router = useRouter()
  const params = useSearchParams()
  const planId = params.get('plan') || 'mid'
  const totalSlots = PLAN_WEEKLY_SLOTS[planId] ?? 4

  const [children, setChildren] = useState<Child[]>([emptyChild()])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const usedSlots = children.reduce((sum, c) => sum + c.bookSlots, 0)
  const remainingSlots = totalSlots - usedSlots

  const updateChild = (index: number, field: keyof Child, value: string | number) => {
    setChildren(prev => prev.map((c, i) => i === index ? { ...c, [field]: value } : c))
  }

  const addChild = () => setChildren(prev => [...prev, emptyChild()])
  const removeChild = (index: number) => setChildren(prev => prev.filter((_, i) => i !== index))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    for (let i = 0; i < children.length; i++) {
      const c = children[i]
      if (!c.avatarId) { setError(`Please choose an avatar for Child ${i + 1}.`); window.scrollTo({ top: 0, behavior: 'smooth' }); return }
      if (!c.firstName.trim()) { setError(`Please add a first name for Child ${i + 1}.`); window.scrollTo({ top: 0, behavior: 'smooth' }); return }
      if (!c.lastName.trim()) { setError(`Please add a last name for Child ${i + 1}.`); window.scrollTo({ top: 0, behavior: 'smooth' }); return }
      if (!c.dob) { setError(`Please add a date of birth for Child ${i + 1}.`); window.scrollTo({ top: 0, behavior: 'smooth' }); return }
      if (!c.readingLevel) { setError(`Please choose a reading level for Child ${i + 1}.`); window.scrollTo({ top: 0, behavior: 'smooth' }); return }
      if (!c.readingMode) { setError(`Please choose a reading mode for Child ${i + 1}.`); window.scrollTo({ top: 0, behavior: 'smooth' }); return }
    }

    if (usedSlots > totalSlots) {
      setError(`You've allocated ${usedSlots} weekly book slots but your plan only includes ${totalSlots}. Please reduce the total.`)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    setLoading(true)
    // TODO: save child profiles to Supabase
    router.push('/dashboard')
  }

  return (
    <main className="min-h-screen" style={{ backgroundColor: '#faf7f0' }}>
      <div className="bg-white border-b border-gray-100 px-6 py-4">
        <img src="/logo_test.png" alt="Bonkers Book Club" className="h-14 w-auto" />
      </div>

      <div className="max-w-2xl mx-auto px-4 py-10">
        <h1 className="text-4xl font-black text-gray-900 mb-1">
          Now let&apos;s meet the little ones! <span className="text-amber-500">★</span>
        </h1>
        <p className="text-gray-500 text-sm mb-4">
          Tell us about your children so we can choose the perfect books.
        </p>

        {/* Weekly slot counter */}
        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold mb-8 ${
          remainingSlots < 0 ? 'bg-red-100 text-red-700' : 'bg-amber-50 text-amber-800 border border-amber-200'
        }`}>
          <span>📚</span>
          <span>
            {remainingSlots > 0 && `${remainingSlots} of ${totalSlots} weekly book slots still to allocate`}
            {remainingSlots === 0 && `All ${totalSlots} weekly book slots allocated`}
            {remainingSlots < 0 && `${Math.abs(remainingSlots)} too many slots — please reduce`}
          </span>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          {children.map((child, index) => (
            <div key={index} className="bg-white border border-gray-200 rounded-2xl p-6 flex flex-col gap-5">

              {/* Card header */}
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-black text-gray-900 tracking-widest uppercase">
                  Child {index + 1}{child.firstName ? ` — ${child.firstName}` : ''}
                </h2>
                {children.length > 1 && (
                  <button type="button" onClick={() => removeChild(index)}
                    className="text-xs text-red-400 hover:text-red-600 font-semibold">
                    Remove
                  </button>
                )}
              </div>

              {/* Avatar picker */}
              <div>
                <label className={labelClass}>Choose an avatar</label>
                <div className="flex gap-2 flex-wrap">
                  {AVATARS.map(av => (
                    <button key={av.id} type="button"
                      onClick={() => updateChild(index, 'avatarId', av.id)}
                      className={`w-12 h-12 rounded-full text-2xl flex items-center justify-center border-2 transition-all ${
                        child.avatarId === av.id ? 'border-amber-500 scale-110 shadow-md' : 'border-transparent hover:border-amber-300'
                      }`}
                      style={{ backgroundColor: av.bg }}>
                      {av.emoji}
                    </button>
                  ))}
                </div>
              </div>

              {/* First name + Last name */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>First name</label>
                  <input type="text" required placeholder="e.g. Layla"
                    value={child.firstName} onChange={e => updateChild(index, 'firstName', e.target.value)}
                    className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Last name</label>
                  <input type="text" required placeholder="e.g. Al Mansoori"
                    value={child.lastName} onChange={e => updateChild(index, 'lastName', e.target.value)}
                    className={inputClass} />
                </div>
              </div>

              {/* DOB */}
              <div>
                <label className={labelClass}>Date of birth</label>
                <input type="date" required
                  value={child.dob} onChange={e => updateChild(index, 'dob', e.target.value)}
                  className={inputClass} />
              </div>

              {/* Reading level */}
              <div>
                <label className={labelClass}>Reading level</label>
                <div className="flex flex-wrap gap-2">
                  {READING_LEVELS.map(level => (
                    <button key={level.id} type="button"
                      onClick={() => updateChild(index, 'readingLevel', level.id)}
                      className={`flex flex-col items-center px-4 py-2 rounded-xl border-2 text-xs transition-all ${
                        child.readingLevel === level.id
                          ? 'border-amber-500 bg-amber-50 text-amber-800'
                          : 'border-gray-200 text-gray-500 hover:border-amber-300'
                      }`}>
                      <span className="font-bold">{level.label}</span>
                      <span className="text-gray-400">{level.age}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Reading mode */}
              <div>
                <label className={labelClass}>How do they read?</label>
                <div className="flex gap-2">
                  {READING_MODES.map(mode => (
                    <button key={mode.value} type="button"
                      onClick={() => updateChild(index, 'readingMode', mode.value)}
                      className={`flex-1 py-2 px-2 rounded-xl border-2 text-xs font-semibold transition-all ${
                        child.readingMode === mode.value
                          ? 'border-amber-500 bg-amber-50 text-amber-800'
                          : 'border-gray-200 text-gray-500 hover:border-amber-300'
                      }`}>
                      {mode.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Book slot allocation */}
              <div>
                <label className={labelClass}>
                  Weekly book slots for {child.firstName || `Child ${index + 1}`}
                </label>
                <p className="text-xs text-gray-400 mb-3">
                  How many of your {totalSlots} weekly books should go to this child?
                </p>
                <div className="flex items-center gap-4">
                  <button type="button"
                    onClick={() => updateChild(index, 'bookSlots', Math.max(0, child.bookSlots - 1))}
                    className="w-10 h-10 rounded-full border-2 border-gray-200 text-gray-600 font-bold text-xl hover:border-amber-400 transition-all flex items-center justify-center">
                    −
                  </button>
                  <span className="text-3xl font-black text-gray-900 w-8 text-center">{child.bookSlots}</span>
                  <button type="button"
                    onClick={() => updateChild(index, 'bookSlots', child.bookSlots + 1)}
                    disabled={remainingSlots <= 0}
                    className="w-10 h-10 rounded-full border-2 border-gray-200 text-gray-600 font-bold text-xl hover:border-amber-400 transition-all flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed">
                    +
                  </button>
                </div>
              </div>

              {/* Swap permission — radio buttons */}
              <div>
                <label className={labelClass}>Swap permission</label>
                <p className="text-xs text-gray-400 mb-3">How much control can this child have over their book swaps?</p>

                {/* Explainer */}
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-4 flex flex-col gap-3">
                  <p className="text-xs font-black text-gray-700 uppercase tracking-widest">What do we mean by preparing and submitting a swap?</p>
                  <div className="flex flex-col gap-2 text-xs text-gray-600">
                    <p>📚 <strong>Preparing a swap</strong> means choosing the books you&apos;d like to return and the books you&apos;d like to receive next. At this stage the books have not been reserved yet, until the swap is submitted.</p>
                    <p>📦 <strong>Submitting a swap</strong> means confirming your choices and sending the request to Bonkers. The books will then be reserved for you. You can still make changes to your selections until your weekly swap cutoff time. After the cutoff, your swap choices are locked so we can prepare your next delivery.</p>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  {SWAP_PERMISSIONS.map(perm => (
                    <label key={perm.value}
                      className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                        child.swapPermission === perm.value
                          ? 'border-amber-500 bg-amber-50'
                          : 'border-gray-200 hover:border-amber-300'
                      }`}>
                      <input type="radio" name={`swapPermission-${index}`} value={perm.value}
                        checked={child.swapPermission === perm.value}
                        onChange={() => updateChild(index, 'swapPermission', perm.value)}
                        className="accent-amber-500 mt-1 shrink-0" />
                      <div className="flex flex-col gap-2">
                        <p className="text-sm font-black text-gray-800">{perm.label}</p>
                        <p className="text-xs text-gray-500">{perm.desc}</p>
                        <ul className="flex flex-col gap-1 mt-1">
                          {perm.bullets.map((b, bi) => (
                            <li key={bi} className="flex items-center gap-2 text-xs text-gray-600">
                              <span>{b.yes ? '✅' : '❌'}</span>
                              <span>{b.text}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

            </div>
          ))}

          <button type="button" onClick={addChild}
            className="w-full py-3 rounded-2xl border-2 border-dashed border-amber-300 text-amber-600 font-bold text-sm hover:bg-amber-50 transition-all">
            + Add another child
          </button>

          <button type="submit" disabled={loading}
            className="w-full py-4 rounded-2xl font-black text-base text-white transition-all disabled:opacity-50"
            style={{ backgroundColor: '#052059' }}>
            {loading ? 'Setting up your account...' : 'Complete Setup →'}
          </button>

          <p className="text-center text-gray-400 text-xs -mt-4">
            You can always add more children or update their details from your dashboard.
          </p>
        </form>
      </div>
    </main>
  )
}

export default function ChildrenPage() {
  return (
    <Suspense>
      <ChildrenForm />
    </Suspense>
  )
}
