'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Child = {
  id: string
  first_name: string
  nickname: string
  avatar_url: string | null
  reading_level: string
  book_slot_allocation: number
  child_pin_enabled: boolean
}

type Household = {
  id: string
  first_name: string
  last_name: string
  email: string
  mobile_phone: string
  whatsapp_number: string
  villa_flat: string
  building_name: string | null
  street: string
  community_id: string | null
  community_name: string | null
  city: string
  property_type: string
  delivery_preference: string
  delivery_instructions: string | null
  notify_whatsapp: boolean
  notify_email: boolean
}

type Plan = {
  name: string
  book_count: number
  price_monthly: number
}

const inputClass = "w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-amber-400 bg-[#efe7dd]"

const DELIVERY_OPTIONS = [
  { value: 'leave_at_door', label: 'At the door', sub: 'Contactless' },
  { value: 'leave_safe_spot', label: 'Safe spot', sub: 'Contactless' },
  { value: 'ring_bell', label: 'Ring the bell', sub: 'Someone will be home' },
  { value: 'call_no_bell', label: 'Call me', sub: "Don't ring bell" },
  { value: 'leave_with_reception', label: 'Reception', sub: 'Security / concierge' },
]

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="uppercase tracking-widest mb-4" style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#f9d174', fontSize: '1rem' }}>
      {children}
    </p>
  )
}

function SaveButton({ onClick, loading, saved }: { onClick: () => void; loading: boolean; saved: boolean }) {
  return (
    <div style={{ position: 'relative', display: 'inline-block', minWidth: '100px', height: '64px', opacity: loading ? 0.6 : 1 }}>
      <button type="button" onClick={onClick} disabled={loading}
        className="border-none bg-transparent flex items-center justify-center"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', backgroundImage: 'url(/button2.png)', backgroundSize: '100% 100%', backgroundRepeat: 'no-repeat', cursor: loading ? 'not-allowed' : 'pointer' }}>
        <span style={{ fontFamily: 'var(--font-amatic)', fontSize: '1.4rem', fontWeight: 700, letterSpacing: '0.04em', color: '#fff', marginBottom: '4px' }}>
          {loading ? 'Saving…' : saved ? 'Saved ✓' : 'Save'}
        </span>
      </button>
    </div>
  )
}

export default function SettingsPage() {
  const router = useRouter()
  const [household, setHousehold] = useState<Household | null>(null)
  const [children, setChildren] = useState<Child[]>([])
  const [plan, setPlan] = useState<Plan | null>(null)
  const [communities, setCommunities] = useState<{ id: string; name: string; accepted_property_types: string[] }[]>([])
  const [loading, setLoading] = useState(true)

  // Section-level save state
  const [savingSection, setSavingSection] = useState<string | null>(null)
  const [savedSection, setSavedSection] = useState<string | null>(null)

  // Editable fields
  const [account, setAccount] = useState({ firstName: '', lastName: '', email: '', mobile: '', whatsapp: '', whatsappCountryCode: '+971', samePhone: false })
  const [delivery, setDelivery] = useState({ villaFlat: '', building: '', street: '', communityId: '', city: 'Dubai', propertyType: '', deliveryPreference: '', safeSpot: '', deliveryNotes: '' })
  const [notifications, setNotifications] = useState({ whatsapp: true, email: true })
  const [notifError, setNotifError] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordSaved, setPasswordSaved] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const [parentPin, setParentPin] = useState('')
  const [parentPinConfirm, setParentPinConfirm] = useState('')
  const [parentPinError, setParentPinError] = useState('')
  const [parentPinSaved, setParentPinSaved] = useState(false)
  const [childPins, setChildPins] = useState<Record<string, string>>({})
  const [childPinSaved, setChildPinSaved] = useState<Record<string, boolean>>({})

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: hh } = await supabase
        .from('households')
        .select('*, communities(name)')
        .eq('user_id', user.id)
        .single()

      if (!hh) { setLoading(false); return }

      const communityName = (hh.communities as any)?.name || ''
      const h: Household = { ...hh, community_name: communityName }
      setHousehold(h)
      const whatsappRaw = hh.whatsapp_number || ''
      const whatsappCountryCode = whatsappRaw.startsWith('+') ? whatsappRaw.slice(0, 4) : '+971'
      const whatsappNum = whatsappRaw.startsWith('+') ? whatsappRaw.slice(4) : whatsappRaw
      setAccount({ firstName: hh.first_name || '', lastName: hh.last_name || '', email: user.email || '', mobile: hh.mobile_phone || '', whatsapp: whatsappNum, whatsappCountryCode, samePhone: false })
      setDelivery({ villaFlat: hh.villa_flat || '', building: hh.building_name || '', street: hh.street || '', communityId: hh.community_id || '', city: 'Dubai', propertyType: hh.property_type || '', deliveryPreference: hh.delivery_preference || '', safeSpot: hh.safe_spot_description || '', deliveryNotes: hh.delivery_instructions || '' })
      setNotifications({ whatsapp: hh.notify_whatsapp ?? true, email: hh.notify_email ?? true })

      const { data: sub } = await supabase
        .from('subscriptions')
        .select('subscription_plans(name, book_count, price_monthly)')
        .eq('household_id', hh.id)
        .eq('status', 'active')
        .single()
      if (sub) setPlan((sub.subscription_plans as any))

      const { data: kids } = await supabase
        .from('child_profiles')
        .select('id, first_name, nickname, avatar_url, reading_level, book_slot_allocation, child_pin_enabled')
        .eq('household_id', hh.id)
        .order('created_at')
      if (kids) setChildren(kids)

      setLoading(false)
    }
    load()
  }, [router])

  useEffect(() => {
    supabase.from('communities').select('id, name, accepted_property_types').eq('is_active', true).order('name')
      .then(({ data }) => { if (data) setCommunities(data) })
  }, [])

  async function saveSection(section: string, updates: object, table = 'households', id = household?.id) {
    if (!id) return
    setSavingSection(section)
    await supabase.from(table).update(updates).eq('id', id)
    setSavingSection(null)
    setSavedSection(section)
    setTimeout(() => setSavedSection(null), 2000)
  }

  async function saveAccount() {
    if (!household) return
    await saveSection('account', { first_name: account.firstName, last_name: account.lastName, mobile_phone: account.mobile, whatsapp_number: account.whatsappCountryCode + account.whatsapp })
    if (account.email !== (await supabase.auth.getUser()).data.user?.email) {
      await supabase.auth.updateUser({ email: account.email })
    }
  }

  async function savePassword() {
    setPasswordError('')
    if (newPassword.length < 8) { setPasswordError('Password must be at least 8 characters.'); return }
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) { setPasswordError(error.message); return }
    setNewPassword('')
    setConfirmPassword('')
    setPasswordSaved(true)
    setTimeout(() => setPasswordSaved(false), 2000)
  }

  const selectedCommunity = communities.find(c => c.id === delivery.communityId)
  const deliveryIneligible = selectedCommunity && delivery.propertyType
    ? !selectedCommunity.accepted_property_types.includes(delivery.propertyType)
    : false

  async function saveDelivery() {
    if (deliveryIneligible) return
    await saveSection('delivery', {
      villa_flat: delivery.villaFlat,
      building_name: delivery.building || null,
      street: delivery.street,
      community_id: delivery.communityId || null,
      property_type: delivery.propertyType,
      delivery_preference: delivery.deliveryPreference,
      safe_spot_description: delivery.safeSpot || null,
      delivery_instructions: delivery.deliveryNotes || null,
    })
  }

  async function saveNotifications() {
    if (!notifications.whatsapp && !notifications.email) {
      setNotifError('You must keep at least one notification method active.')
      return
    }
    setNotifError('')
    await saveSection('notifications', { notify_whatsapp: notifications.whatsapp, notify_email: notifications.email })
  }

  function toggleNotif(type: 'whatsapp' | 'email') {
    const next = { ...notifications, [type]: !notifications[type] }
    if (!next.whatsapp && !next.email) {
      setNotifError('You must keep at least one notification method active.')
      return
    }
    setNotifError('')
    setNotifications(next)
  }


  async function saveParentPin() {
    setParentPinError('')
    if (parentPin.length !== 4) { setParentPinError('PIN must be 4 digits.'); return }
    await saveSection('parent_pin', { parent_pin_hash: parentPin })
    setParentPin('')
    setParentPinConfirm('')
    setParentPinSaved(true)
    setTimeout(() => setParentPinSaved(false), 2000)
  }

  async function saveChildPin(childId: string) {
    const pin = childPins[childId] || ''
    if (pin.length !== 4) return
    await supabase.from('child_profiles').update({ child_pin_hash: pin, child_pin_enabled: true }).eq('id', childId)
    setChildPinSaved(prev => ({ ...prev, [childId]: true }))
    setTimeout(() => setChildPinSaved(prev => ({ ...prev, [childId]: false })), 2000)
    setChildPins(prev => ({ ...prev, [childId]: '' }))
  }

  async function deleteChild(childId: string) {
    if (!confirm('Are you sure you want to remove this child profile? This cannot be undone.')) return
    await supabase.from('child_profiles').delete().eq('id', childId)
    setChildren(prev => prev.filter(c => c.id !== childId))
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p style={{ color: '#eddbc3', fontFamily: 'var(--font-montserrat), sans-serif' }}>Loading…</p>
    </div>
  )

  return (
    <main className="min-h-screen pb-24">
      <div className="max-w-2xl mx-auto px-4 pt-10">

        {/* Logo */}
        <div className="flex justify-center mb-6">
          <img src="/Bonkers_Word_Logo_White1.png" alt="Bonkers Book Club" style={{ width: '160px', height: 'auto' }} />
        </div>

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <button onClick={() => router.push('/dashboard')} style={{ color: '#eddbc3', fontSize: '1.5rem', lineHeight: 1 }}>‹</button>
          <h1 style={{ fontFamily: 'var(--font-cormorant), serif', color: '#eddbc3', fontSize: '2rem', fontWeight: 700 }}>Settings</h1>
        </div>

        <div className="flex flex-col gap-8">

          {/* 1. YOUR DETAILS */}
          <section className="flex flex-col gap-4">
            <SectionHeading>Your Details</SectionHeading>
            <div className="grid grid-cols-2 gap-3">
              <input type="text" placeholder="First name *" value={account.firstName}
                onChange={e => setAccount(a => ({ ...a, firstName: e.target.value }))}
                className={inputClass} />
              <input type="text" placeholder="Last name *" value={account.lastName}
                onChange={e => setAccount(a => ({ ...a, lastName: e.target.value }))}
                className={inputClass} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <input type="tel" placeholder="UAE Mobile *" value={account.mobile}
                  onChange={e => {
                    const val = e.target.value.replace(/[^\d]/g, '').slice(0, 10)
                    setAccount(a => ({ ...a, mobile: val, whatsapp: a.samePhone ? val.replace(/^0/, '') : a.whatsapp }))
                  }}
                  className={inputClass} />
                <p className="text-xs mt-1" style={{ color: '#eddbc3' }}>Format: 05XXXXXXXX</p>
              </div>
              <div>
                <div className="flex">
                  <input type="text" value={account.whatsappCountryCode}
                    onChange={e => setAccount(a => ({ ...a, whatsappCountryCode: e.target.value }))}
                    className="w-14 shrink-0 border border-r-0 border-gray-300 rounded-l-lg px-1 py-3 bg-[#efe7dd] text-center focus:outline-none focus:ring-2 focus:ring-amber-400" />
                  <input type="tel" placeholder="WhatsApp *" value={account.whatsapp}
                    onChange={e => setAccount(a => ({ ...a, whatsapp: e.target.value }))}
                    className="flex-1 min-w-0 border border-gray-300 rounded-r-lg px-2 py-3 bg-[#efe7dd] focus:outline-none focus:ring-2 focus:ring-amber-400" />
                </div>
                <label className="flex items-center gap-2 mt-2 text-xs cursor-pointer" style={{ color: '#eddbc3' }}>
                  <input type="checkbox" checked={account.samePhone}
                    onChange={e => setAccount(a => ({
                      ...a,
                      samePhone: e.target.checked,
                      whatsapp: e.target.checked ? a.mobile.replace(/^0/, '') : a.whatsapp,
                      whatsappCountryCode: e.target.checked ? '+971' : a.whatsappCountryCode,
                    }))}
                    className="accent-amber-500" />
                  Same as mobile
                </label>
              </div>
            </div>
            <div className="flex justify-end">
              <SaveButton onClick={saveAccount} loading={savingSection === 'account'} saved={savedSection === 'account'} />
            </div>
          </section>

          {/* 2. LOGIN DETAILS */}
          <section className="flex flex-col gap-4">
            <SectionHeading>Your Login Details</SectionHeading>
            <input type="email" placeholder="Email address *" value={account.email}
              onChange={e => setAccount(a => ({ ...a, email: e.target.value }))}
              className="w-full rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-amber-400"
              style={{ background: 'transparent', border: '2px solid #f9d174', color: '#eddbc3' }} />
            <div className="relative">
              <input type={showNewPassword ? 'text' : 'password'} placeholder="New password"
                value={newPassword} onChange={e => setNewPassword(e.target.value)}
                className="w-full rounded-lg px-4 py-3 pr-16 focus:outline-none focus:ring-2 focus:ring-amber-400"
                style={{ background: 'transparent', border: '2px solid #f9d174', color: '#eddbc3' }} />
              <button type="button" onClick={() => setShowNewPassword(p => !p)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-sm"
                style={{ color: '#eddbc3', fontFamily: 'var(--font-montserrat), sans-serif' }}>
                {showNewPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            {passwordError && <p style={{ color: '#e57451', fontSize: '0.9rem', fontFamily: 'var(--font-montserrat), sans-serif' }}>{passwordError}</p>}
            <div className="flex justify-end">
              <SaveButton onClick={savePassword} loading={false} saved={passwordSaved} />
            </div>
          </section>

          {/* 3. FAMILY & CHILDREN */}
          <section>
            <SectionHeading>Children</SectionHeading>
            <div className="flex flex-col gap-3">
              {children.map(child => (
                <div key={child.id} className="rounded-2xl p-4 flex items-center justify-between" style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '2px solid rgba(237,219,195,0.3)' }}>
                  <div className="flex items-center gap-3">
                    <div className="rounded-full flex items-center justify-center" style={{ width: '40px', height: '40px', backgroundColor: 'rgba(237,219,195,0.2)', border: '2px solid #eddbc3', flexShrink: 0 }}>
                      {child.avatar_url
                        ? <img src={child.avatar_url} alt="" style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }} />
                        : <span style={{ fontFamily: 'var(--font-cormorant), serif', color: '#eddbc3', fontSize: '1.2rem', fontWeight: 700 }}>{child.first_name[0]}</span>
                      }
                    </div>
                    <div>
                      <p style={{ fontFamily: 'var(--font-cormorant), serif', color: '#eddbc3', fontSize: '1.2rem', fontWeight: 700 }}>{child.first_name}</p>
                      <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#eddbc3', fontSize: '0.75rem', opacity: 0.6 }}>@{child.nickname} · {child.book_slot_allocation} book{child.book_slot_allocation !== 1 ? 's' : ''}/swap</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => router.push(`/dashboard/children/${child.id}/edit`)}
                      className="rounded-lg px-3 py-1.5 text-xs font-bold"
                      style={{ backgroundColor: 'rgba(237,219,195,0.15)', color: '#eddbc3', fontFamily: 'var(--font-montserrat), sans-serif', border: '1px solid rgba(237,219,195,0.3)' }}>
                      Edit
                    </button>
                    <button onClick={() => deleteChild(child.id)}
                      className="rounded-lg px-3 py-1.5 text-xs font-bold"
                      style={{ backgroundColor: 'rgba(229,116,81,0.15)', color: '#e57451', fontFamily: 'var(--font-montserrat), sans-serif', border: '1px solid rgba(229,116,81,0.3)' }}>
                      Remove
                    </button>
                  </div>
                </div>
              ))}
              <button onClick={() => router.push('/dashboard/children/new')}
                className="rounded-2xl px-5 py-3 font-bold flex items-center justify-center gap-2 transition-all"
                style={{ border: '2px dashed rgba(237,219,195,0.4)', color: '#eddbc3', fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.9rem' }}>
                + Add a child
              </button>
            </div>
          </section>

          {/* 3. DELIVERY */}
          <section>
            <SectionHeading>Delivery Address</SectionHeading>
            <div className="flex flex-col gap-3">
              <div className="flex gap-3">
                {[{ value: 'villa', label: 'Villa' }, { value: 'flat', label: 'Apartment' }].map(opt => (
                  <button key={opt.value} type="button" onClick={() => setDelivery(d => ({ ...d, propertyType: opt.value }))}
                    style={{ fontFamily: 'var(--font-amatic)', fontSize: '1.5rem', letterSpacing: '0.04em', color: '#eddbc3', backgroundImage: delivery.propertyType === opt.value ? 'url(/orange_box.png)' : 'url(/blue_box.png)', backgroundSize: '100% 100%', backgroundRepeat: 'no-repeat' }}
                    className="flex-1 py-3 pb-5 font-bold transition-all border-none bg-transparent">
                    {opt.label}
                  </button>
                ))}
              </div>
              <input placeholder="Villa or Apartment number *" value={delivery.villaFlat} onChange={e => setDelivery(d => ({ ...d, villaFlat: e.target.value }))} className={inputClass} />
              {delivery.propertyType === 'flat' && (
                <input placeholder="Building name" value={delivery.building} onChange={e => setDelivery(d => ({ ...d, building: e.target.value }))} className={inputClass} />
              )}
              <input placeholder="Street *" value={delivery.street} onChange={e => setDelivery(d => ({ ...d, street: e.target.value }))} className={inputClass} />
              <div className="flex gap-3">
                <select value={delivery.communityId} onChange={e => setDelivery(d => ({ ...d, communityId: e.target.value }))} className={inputClass}
                  style={{ flex: 1, appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1L6 7L11 1' stroke='%23888' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round' fill='none'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', paddingRight: '2rem' }}>
                  <option value="">Select community</option>
                  {communities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <input readOnly value="Dubai" className={inputClass + ' cursor-not-allowed'} style={{ minWidth: '86px', width: 'auto', flexShrink: 0, textAlign: 'center' }} />
              </div>
              <input placeholder="Delivery instructions (optional)" value={delivery.deliveryNotes} onChange={e => setDelivery(d => ({ ...d, deliveryNotes: e.target.value }))} className={inputClass} />
              {deliveryIneligible && (
                <p className="rounded-xl px-4 py-3 text-sm" style={{ backgroundColor: 'rgba(229,116,81,0.15)', color: '#e57451', border: '1px solid rgba(229,116,81,0.4)', fontFamily: 'var(--font-montserrat), sans-serif' }}>
                  Sorry, we don't currently deliver to {delivery.propertyType === 'flat' ? 'apartments' : 'villas'} in {selectedCommunity?.name}. <a href="https://wa.me/971000000000" style={{ textDecoration: 'underline' }}>Get in touch</a> if you think this is a mistake.
                </p>
              )}
              <div className="flex justify-end mt-1">
                <SaveButton onClick={saveDelivery} loading={savingSection === 'delivery'} saved={savedSection === 'delivery'} />
              </div>
            </div>
          </section>

          {/* 4. DELIVERY PREFERENCE */}
          <section>
            <SectionHeading>How should we deliver your books?</SectionHeading>
            <div className="grid grid-cols-2 gap-3">
              {DELIVERY_OPTIONS.map(opt => (
                <button key={opt.value} type="button" onClick={() => setDelivery(d => ({ ...d, deliveryPreference: opt.value }))}
                  className="flex flex-col items-center justify-center text-center px-2 py-3 rounded-xl transition-all border-[3px]"
                  style={{ borderColor: delivery.deliveryPreference === opt.value ? '#e57451' : 'rgba(237,219,195,0.3)', backgroundColor: 'rgba(255,255,255,0.04)' }}>
                  <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#eddbc3', fontSize: '1rem', fontWeight: 600 }}>{opt.label}</span>
                  <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#eddbc3', fontSize: '0.85rem', opacity: 0.6, marginTop: '2px' }}>{opt.sub}</span>
                </button>
              ))}
            </div>
            {delivery.deliveryPreference === 'leave_safe_spot' && (
              <input placeholder="Describe the safe spot" value={delivery.safeSpot} onChange={e => setDelivery(d => ({ ...d, safeSpot: e.target.value }))} className={inputClass} style={{ marginTop: '12px' }} />
            )}
            <div className="flex justify-end mt-3">
              <SaveButton onClick={saveDelivery} loading={savingSection === 'delivery'} saved={savedSection === 'delivery'} />
            </div>
          </section>

          {/* 5. NOTIFICATIONS */}
          <section>
            <SectionHeading>Notifications</SectionHeading>
            <div className="flex flex-col gap-3">
              {[
                { key: 'whatsapp' as const, label: 'WhatsApp' },
                { key: 'email' as const, label: 'Email' },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between rounded-2xl px-4 py-3" style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '2px solid rgba(237,219,195,0.3)' }}>
                  <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#eddbc3', fontSize: '1rem' }}>{label}</span>
                  <button type="button" onClick={() => toggleNotif(key)}
                    className="rounded-full transition-all"
                    style={{ width: '48px', height: '26px', backgroundColor: notifications[key] ? '#e57451' : 'rgba(237,219,195,0.2)', position: 'relative', border: 'none', cursor: 'pointer' }}>
                    <img src="/star_cream.png" alt="" style={{ position: 'absolute', top: '0px', left: notifications[key] ? '22px' : '1px', width: '24px', height: '24px', transition: 'left 0.2s' }} />
                  </button>
                </div>
              ))}
              {notifError && <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#e57451', fontSize: '0.9rem' }}>{notifError}</p>}
              <div className="flex justify-end">
                <SaveButton onClick={saveNotifications} loading={savingSection === 'notifications'} saved={savedSection === 'notifications'} />
              </div>
            </div>
          </section>

          {/* 6. SUBSCRIPTION */}
          <section>
            <SectionHeading>Subscription</SectionHeading>
            <div className="rounded-2xl p-5" style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '2px solid rgba(237,219,195,0.3)' }}>
              {plan ? (
                <div className="flex items-center justify-between">
                  <div>
                    <p style={{ fontFamily: 'var(--font-cormorant), serif', color: '#eddbc3', fontSize: '1.5rem', fontWeight: 700 }}>{plan.name}</p>
                    <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#eddbc3', fontSize: '0.8rem', opacity: 0.7 }}>{plan.book_count} books / month · AED {plan.price_monthly}/mo</p>
                  </div>
                  <span className="rounded-full px-3 py-1 text-xs font-bold" style={{ backgroundColor: 'rgba(76,175,80,0.2)', color: '#4caf50', fontFamily: 'var(--font-montserrat), sans-serif' }}>Active</span>
                </div>
              ) : (
                <p style={{ color: '#eddbc3', opacity: 0.6, fontFamily: 'var(--font-montserrat), sans-serif' }}>No active plan found.</p>
              )}
            </div>
            <div className="flex gap-3 mt-3">
              <button className="flex-1 rounded-xl py-3 font-bold text-sm" style={{ backgroundColor: 'rgba(237,219,195,0.1)', border: '1px solid rgba(237,219,195,0.3)', color: '#eddbc3', fontFamily: 'var(--font-montserrat), sans-serif' }}>
                Change plan
              </button>
              <button className="flex-1 rounded-xl py-3 font-bold text-sm" style={{ backgroundColor: 'rgba(229,116,81,0.1)', border: '1px solid rgba(229,116,81,0.3)', color: '#e57451', fontFamily: 'var(--font-montserrat), sans-serif' }}>
                Pause or cancel
              </button>
            </div>
          </section>

          {/* 7. PARENT PIN */}
          <section>
            <SectionHeading>Parent PIN</SectionHeading>
            <p className="text-sm mb-3" style={{ color: '#eddbc3', opacity: 0.7, fontFamily: 'var(--font-montserrat), sans-serif' }}>
              Required to exit a child's profile and to approve swaps from the dashboard.
            </p>
            <div className="flex flex-col gap-3">
              <input type="text" inputMode="numeric" maxLength={4} placeholder="New 4-digit PIN"
                value={parentPin} onChange={e => setParentPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                className={inputClass} />
              {parentPinError && <p style={{ color: '#e57451', fontSize: '0.9rem', fontFamily: 'var(--font-montserrat), sans-serif' }}>{parentPinError}</p>}
              <div className="flex justify-end">
                <SaveButton onClick={saveParentPin} loading={savingSection === 'parent_pin'} saved={parentPinSaved} />
              </div>
            </div>
          </section>

          {/* 8. CHILD PINs */}
          {children.length > 0 && (
            <section>
              <SectionHeading>Child PINs</SectionHeading>
              <div className="flex flex-col gap-3">
                {children.map(child => (
                  <div key={child.id} className="rounded-2xl p-4" style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '2px solid rgba(237,219,195,0.3)' }}>
                    <p className="mb-2" style={{ fontFamily: 'var(--font-cormorant), serif', color: '#eddbc3', fontSize: '1.2rem', fontWeight: 700 }}>{child.first_name}</p>
                    <p className="mb-3 text-xs" style={{ color: '#eddbc3', opacity: 0.6, fontFamily: 'var(--font-montserrat), sans-serif' }}>Enter a new 4-digit PIN to reset it.</p>
                    <div className="flex gap-2">
                      <input type="text" inputMode="numeric" maxLength={4} placeholder="New 4-digit PIN"
                        value={childPins[child.id] || ''} onChange={e => setChildPins(prev => ({ ...prev, [child.id]: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                        className={inputClass + ' flex-1'} />
                      <SaveButton onClick={() => saveChildPin(child.id)} loading={false} saved={childPinSaved[child.id] || false} />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Sign out */}
          <button onClick={async () => { await supabase.auth.signOut(); router.push('/') }}
            className="flex items-center gap-1 bg-transparent border-none cursor-pointer mx-auto"
            style={{ fontFamily: 'var(--font-amatic), sans-serif', color: '#eddbc3', fontSize: '1.6rem' }}>
            <img src="/star_button_on.png" alt="" style={{ height: '16px', width: '16px' }} />
            Sign out
            <img src="/arrow_cream.png" alt="" style={{ height: '16px', width: 'auto' }} />
          </button>

        </div>
      </div>
    </main>
  )
}
