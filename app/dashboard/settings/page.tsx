'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Child = {
  id: string
  name: string
  last_name: string | null
  date_of_birth: string | null
  book_slot_allocation: number | null
  swap_permission: string
}

type Household = {
  id: string
  first_name: string
  last_name: string
  email: string
  mobile_phone: string
  whatsapp_number: string
  villa_flat: string | null
  building: string | null
  street: string | null
  sub_community: string | null
  area: string | null
  community_id: string | null
  community_name: string | null
  property_type: string | null
  delivery_preference: string | null
  delivery_notes: string | null
  safe_spot_description: string | null
  notify_whatsapp: boolean
  notify_email: boolean
  [key: string]: unknown
}

type Plan = {
  name: string
  book_count: number
  price_monthly: number
}

const inputClass = "w-full border border-[#ddd6cc] rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-300 bg-white text-[#1a2744] font-[var(--font-montserrat)]"

function SaveButton({ onClick, loading, saved }: { onClick: () => void; loading: boolean; saved: boolean }) {
  return (
    <div className="flex flex-col items-center" style={{ marginTop: '28px', paddingBottom: '28px' }}>
      <button type="button" onClick={onClick} disabled={loading}
        style={{ backgroundColor: saved ? '#2e5c3a' : '#1a2f51', border: 'none', borderRadius: '999px', cursor: loading ? 'not-allowed' : 'pointer', padding: '14px 40px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', opacity: loading ? 0.7 : 1, transition: 'background-color 0.2s, opacity 0.2s' }}>
        <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600, fontSize: '0.85rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#fff', whiteSpace: 'nowrap' }}>
          {loading ? 'Saving…' : saved ? 'Saved ✓' : 'Save Changes'}
        </span>
      </button>
    </div>
  )
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

export default function SettingsPage() {
  const router = useRouter()
  const pathname = usePathname()
  const [household, setHousehold] = useState<Household | null>(null)
  const [children, setChildren] = useState<Child[]>([])
  const [plan, setPlan] = useState<Plan | null>(null)
  const [communities, setCommunities] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [isTablet, setIsTablet] = useState(false)
  useEffect(() => {
    const check = () => setIsTablet(window.innerWidth >= 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const [expandedSection, setExpandedSection] = useState<string | null>(null)
  const toggleSection = (key: string) => setExpandedSection(prev => prev === key ? null : key)

  const [savingSection, setSavingSection] = useState<string | null>(null)
  const [savedSection, setSavedSection] = useState<string | null>(null)

  const [account, setAccount] = useState({ firstName: '', lastName: '', email: '', mobile: '', whatsapp: '', whatsappCountryCode: '+971', samePhone: false, avatarId: '' })
  const [delivery, setDelivery] = useState({ villaFlat: '', building: '', street: '', subCommunity: '', area: '', communityId: '', city: 'Dubai', propertyType: '', deliveryPreference: '', safeSpot: '', deliveryNotes: '' })
  const [notifications, setNotifications] = useState({ whatsapp: true, email: true, marketing: false })
  const [notifError, setNotifError] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordSaved, setPasswordSaved] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)

  const [showAvatarModal, setShowAvatarModal] = useState(false)
  const [parentPin, setParentPin] = useState('')
  const [parentPinError, setParentPinError] = useState('')
  const [parentPinSaved, setParentPinSaved] = useState(false)
  const [expandedChild, setExpandedChild] = useState<string | null>(null)
  const [childEdits, setChildEdits] = useState<Record<string, { name: string, lastName: string, dobDay: string, dobMonth: string, dobYear: string, bookSlots: number | null, swapPermission: string, reviewDisplay: string, pin: string }>>({})
  const [childSaving, setChildSaving] = useState<Record<string, boolean>>({})
  const [childSaved, setChildSaved] = useState<Record<string, boolean>>({})
  const [childNotifyEnabled, setChildNotifyEnabled] = useState(true)
  const dobMonthRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const dobYearRefs = useRef<Record<string, HTMLInputElement | null>>({})

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: hh } = await supabase.from('households').select('*, communities(name)').eq('user_id', user.id).single()
      if (!hh) { setLoading(false); return }
      const communityName = (hh.communities as any)?.name || ''
      setHousehold({ ...hh, community_name: communityName })
      const whatsappRaw = hh.whatsapp_number || ''
      const whatsappCountryCode = whatsappRaw.startsWith('+') ? whatsappRaw.slice(0, 4) : '+971'
      const whatsappNum = whatsappRaw.startsWith('+') ? whatsappRaw.slice(4) : whatsappRaw
      setAccount({ firstName: hh.first_name || '', lastName: hh.last_name || '', email: user.email || '', mobile: hh.mobile_phone || '', whatsapp: whatsappNum, whatsappCountryCode, samePhone: false, avatarId: hh.avatar_id || '' })
      setDelivery({ villaFlat: hh.villa_flat || '', building: hh.building || '', street: hh.street || '', subCommunity: hh.sub_community || '', area: hh.area || '', communityId: hh.community_id || '', city: 'Dubai', propertyType: hh.property_type || '', deliveryPreference: hh.delivery_preference || '', safeSpot: hh.safe_spot_description || '', deliveryNotes: hh.delivery_notes || '' })
      setNotifications({ whatsapp: hh.notify_whatsapp ?? true, email: hh.notify_email ?? true, marketing: hh.agreed_to_marketing ?? false })
      setChildNotifyEnabled((hh as any).child_notify_enabled ?? true)
      const { data: sub } = await supabase.from('subscriptions').select('subscription_plans(name, book_count, price_monthly)').eq('household_id', hh.id).eq('status', 'active').maybeSingle()
      if (sub) setPlan((sub.subscription_plans as any))
      const { data: kids } = await supabase.from('child_profiles').select('id, name, last_name, date_of_birth, book_slot_allocation, swap_permission, review_display').eq('household_id', hh.id).order('created_at')
      if (kids) {
        setChildren(kids)
        const edits: Record<string, { name: string, lastName: string, dobDay: string, dobMonth: string, dobYear: string, bookSlots: number | null, swapPermission: string, reviewDisplay: string, pin: string }> = {}
        kids.forEach((k: any) => {
          const dob = k.date_of_birth ? k.date_of_birth.split('-') : ['', '', '']
          edits[k.id] = { name: k.name || '', lastName: k.last_name || '', dobDay: dob[2] || '', dobMonth: dob[1] || '', dobYear: dob[0] || '', bookSlots: k.book_slot_allocation ?? null, swapPermission: k.swap_permission || 'prepare_only', reviewDisplay: k.review_display || 'first_name', pin: '' }
        })
        setChildEdits(edits)
      }
      setLoading(false)
    }
    load()
  }, [router])

  useEffect(() => {
    supabase.from('communities').select('id, name').order('name')
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
    await saveSection('account', { first_name: account.firstName, last_name: account.lastName, mobile_phone: account.mobile, whatsapp_number: account.whatsappCountryCode + account.whatsapp, avatar_id: account.avatarId || null })
    if (account.email !== (await supabase.auth.getUser()).data.user?.email) await supabase.auth.updateUser({ email: account.email })
  }

  async function savePassword() {
    setPasswordError('')
    if (newPassword.length < 8) { setPasswordError('Password must be at least 8 characters.'); return }
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) { setPasswordError(error.message); return }
    setNewPassword('')
    setPasswordSaved(true)
    setTimeout(() => setPasswordSaved(false), 2000)
  }

  async function saveDelivery() {
    await saveSection('delivery', { villa_flat: delivery.villaFlat || null, building: delivery.building || null, street: delivery.street, sub_community: delivery.subCommunity || null, area: delivery.area || null, community_id: delivery.communityId || null, property_type: delivery.propertyType, delivery_preference: delivery.deliveryPreference, safe_spot_description: delivery.safeSpot || null, delivery_notes: delivery.deliveryNotes || null })
  }

  async function saveNotifications() {
    if (!notifications.whatsapp && !notifications.email) { setNotifError('You must keep at least one notification method active.'); return }
    setNotifError('')
    await saveSection('notifications', { notify_whatsapp: notifications.whatsapp, notify_email: notifications.email, agreed_to_marketing: notifications.marketing })
  }

  function toggleNotif(type: 'whatsapp' | 'email' | 'marketing') {
    const next = { ...notifications, [type]: !notifications[type] }
    if (type !== 'marketing' && !next.whatsapp && !next.email) { setNotifError('You must keep at least one notification method active.'); return }
    setNotifError('')
    setNotifications(next)
  }

  async function toggleChildNotify() {
    const newVal = !childNotifyEnabled
    setChildNotifyEnabled(newVal)
    if (household) await supabase.from('households').update({ child_notify_enabled: newVal }).eq('id', household.id)
  }

  async function saveParentPin() {
    setParentPinError('')
    if (parentPin.length !== 4) { setParentPinError('PIN must be 4 digits.'); return }
    await saveSection('parent_pin', { parent_pin_hash: parentPin })
    setParentPin('')
    setParentPinSaved(true)
    setTimeout(() => setParentPinSaved(false), 2000)
  }

  async function saveChildSettings(childId: string) {
    const edit = childEdits[childId]
    if (!edit) return
    setChildSaving(prev => ({ ...prev, [childId]: true }))
    const updates: any = { name: edit.name.trim(), last_name: edit.lastName.trim() || null, book_slot_allocation: edit.bookSlots ?? null, swap_permission: edit.swapPermission, review_display: edit.reviewDisplay }
    if (edit.dobDay && edit.dobMonth && edit.dobYear) {
      updates.date_of_birth = `${edit.dobYear}-${edit.dobMonth.padStart(2, '0')}-${edit.dobDay.padStart(2, '0')}`
    }
    if (edit.pin.length === 4) { updates.child_pin_hash = edit.pin; updates.child_pin_enabled = true }
    const { data: updated, error: saveErr } = await supabase.from('child_profiles').update(updates).eq('id', childId).select('id')
    setChildSaving(prev => ({ ...prev, [childId]: false }))
    if (saveErr) { alert(`Could not save: ${saveErr.message}`); return }
    if (!updated || updated.length === 0) { alert('Save was blocked — missing RLS policy on child_profiles. Run in Supabase SQL editor:\nCREATE POLICY "users_update_own_children" ON child_profiles FOR UPDATE TO authenticated USING (household_id IN (SELECT id FROM households WHERE user_id = auth.uid())) WITH CHECK (household_id IN (SELECT id FROM households WHERE user_id = auth.uid()));'); return }
    setChildren(prev => prev.map(c => c.id === childId ? { ...c, name: edit.name.trim(), last_name: edit.lastName.trim() || null } : c))
    setChildSaved(prev => ({ ...prev, [childId]: true }))
    setTimeout(() => setChildSaved(prev => ({ ...prev, [childId]: false })), 2000)
    setChildEdits(prev => ({ ...prev, [childId]: { ...prev[childId], pin: '' } }))
  }

  async function deleteChild(childId: string) {
    if (!confirm('Are you sure you want to remove this child profile? This cannot be undone.')) return
    await supabase.from('child_profiles').delete().eq('id', childId)
    setChildren(prev => prev.filter(c => c.id !== childId))
  }

  const sectionHeading: React.CSSProperties = { fontFamily: 'var(--font-cormorant), serif', fontWeight: 600, color: '#1a2f51', fontSize: '1.2rem', margin: 0, lineHeight: 1.3 }
  const sectionBorder: React.CSSProperties = { borderBottom: '1px solid rgba(26,39,68,0.2)' }
  const labelStyle: React.CSSProperties = { fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600, fontSize: '0.7rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#1a2f51' }
  const chevron = (key: string) => (
    <span style={{ color: '#1a2f51', fontSize: '1.4rem', flexShrink: 0, transition: 'transform 0.2s', transform: expandedSection === key ? 'rotate(45deg)' : 'none', display: 'inline-block', lineHeight: 1 }}>+</span>
  )

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#fefaf2' }}>
      <p style={{ color: '#1a2f51', fontFamily: 'var(--font-montserrat), sans-serif' }}>Loading…</p>
    </div>
  )

  return (
    <main className="min-h-screen" style={{ position: 'relative', backgroundColor: '#fefaf2' }}>
      <div style={{ position: 'absolute', top: '20px', left: '20px', lineHeight: 1 }}>
        <p style={{ fontFamily: 'var(--font-amatic)', fontWeight: 700, fontSize: '3rem', color: '#1a2f51', letterSpacing: '0.04em', margin: 0 }}>BONKERS</p>
        <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600, fontSize: '0.5rem', color: '#1a2f51', letterSpacing: '0.18em', textTransform: 'uppercase', margin: '2px 0 0' }}>THE CHILDREN'S LIBRARY</p>
      </div>

      <div className="settings-content" style={{ paddingTop: '120px', paddingBottom: '100px' }}>

        <div className="flex flex-col items-center text-center w-full pb-6">
          <h1 style={{ fontFamily: 'var(--font-cormorant), serif', color: '#1a2f51', fontSize: 'clamp(3rem, 10vw, 5rem)', fontWeight: 700, lineHeight: 1.1, margin: '8px 0 0', textAlign: 'center' }}>
            Settings
          </h1>
        </div>

        <div className="flex flex-col gap-0">

          {/* ── YOUR DETAILS ── */}
          <section style={sectionBorder}>
            <button type="button" onClick={() => toggleSection('details')} className="flex items-center justify-between w-full"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '16px 0' }}>
              <p style={sectionHeading}>Your Details</p>
              {chevron('details')}
            </button>
            {expandedSection === 'details' && <div className="flex flex-col gap-4" style={{ paddingBottom: '20px', paddingTop: '16px' }}>
              {/* Avatar */}
              <div className="flex items-center gap-4" style={{ marginBottom: '16px' }}>
                <button type="button" onClick={() => setShowAvatarModal(true)}
                  style={{ width: '64px', height: '64px', borderRadius: '50%', fontSize: '1.7rem', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: AVATARS.find(a => a.id === account.avatarId)?.bg || 'rgba(26,47,81,0.1)', border: '2px solid rgba(26,47,81,0.25)', cursor: 'pointer', flexShrink: 0, fontFamily: 'var(--font-cormorant), serif', fontWeight: 700, color: '#1a2f51' }}>
                  {AVATARS.find(a => a.id === account.avatarId)?.emoji || (account.firstName ? account.firstName[0].toUpperCase() : '?')}
                </button>
                <button type="button" onClick={() => setShowAvatarModal(true)}
                  style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.78rem', color: '#1a2f51', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', opacity: 0.7 }}>
                  {account.avatarId ? 'Change avatar' : 'Choose an avatar'}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label style={labelStyle}>First Name</label>
                  <input type="text" value={account.firstName} onChange={e => setAccount(a => ({ ...a, firstName: e.target.value }))} className={inputClass} />
                </div>
                <div className="flex flex-col gap-1">
                  <label style={labelStyle}>Last Name</label>
                  <input type="text" value={account.lastName} onChange={e => setAccount(a => ({ ...a, lastName: e.target.value }))} className={inputClass} />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label style={labelStyle}>Email Address</label>
                <input type="email" value={account.email} onChange={e => setAccount(a => ({ ...a, email: e.target.value }))} className={inputClass} />
              </div>
              <div className="flex flex-col gap-1">
                <label style={labelStyle}>New Password</label>
                <div className="relative">
                  <input type={showNewPassword ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)} className={`${inputClass} pr-16`} />
                  <button type="button" onClick={() => setShowNewPassword(p => !p)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#1a1a1a', opacity: 0.4 }}>
                    {showNewPassword
                      ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    }
                  </button>
                </div>
                {passwordError && <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#e57451', fontSize: '0.95rem', marginTop: '4px', paddingLeft: '4px' }}>{passwordError}</p>}
              </div>
              <div className="flex flex-col gap-1">
                <label style={labelStyle}>Mobile Number</label>
                <input type="tel" placeholder="05XXXXXXXX" value={account.mobile}
                  onChange={e => { const val = e.target.value.replace(/[^\d]/g, '').slice(0, 10); setAccount(a => ({ ...a, mobile: val, whatsapp: a.samePhone ? val.replace(/^0/, '') : a.whatsapp })) }}
                  className={inputClass} />
              </div>
              <div className="flex flex-col gap-1">
                <label style={labelStyle}>WhatsApp Number <span style={{ textTransform: 'none', fontWeight: 400, opacity: 0.7 }}>(if different)</span></label>
                <div className="flex gap-2">
                  <input type="text" value={account.whatsappCountryCode} onChange={e => setAccount(a => ({ ...a, whatsappCountryCode: e.target.value }))}
                    className="w-16 shrink-0 border border-gray-300 rounded-lg px-2 py-3 bg-[#fcf7eb] text-[#1a0a00] text-center focus:outline-none focus:ring-2 focus:ring-amber-400" />
                  <input type="tel" placeholder="e.g. 501234567" value={account.whatsapp} onChange={e => setAccount(a => ({ ...a, whatsapp: e.target.value }))} className={inputClass} style={{ flex: 1 }} />
                </div>
              </div>
              <SaveButton onClick={() => { saveAccount(); if (newPassword) savePassword() }} loading={savingSection === 'account'} saved={savedSection === 'account'} />
            </div>}
          </section>

          {/* ── DELIVERY ADDRESS ── */}
          <section style={sectionBorder}>
            <button type="button" onClick={() => toggleSection('delivery')} className="flex items-center justify-between w-full"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '16px 0' }}>
              <p style={sectionHeading}>Delivery Info</p>
              {chevron('delivery')}
            </button>
            {expandedSection === 'delivery' && <div style={{ paddingBottom: '20px', paddingTop: '16px' }}>
              {/* Villa / Flat toggle */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                {[{ value: 'villa', label: 'Villa' }, { value: 'apartment', label: 'Flat' }].map(opt => (
                  <button key={opt.value} type="button" onClick={() => setDelivery(d => ({ ...d, propertyType: opt.value }))}
                    style={{ flex: 1, padding: '10px 0', borderRadius: '10px', border: `2px solid ${delivery.propertyType === opt.value ? '#1a2744' : '#ddd6cc'}`, backgroundColor: delivery.propertyType === opt.value ? '#1a2744' : '#fefaf2', color: delivery.propertyType === opt.value ? '#fefaf2' : '#1a2744', fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}>
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Address fields — 2-column grid */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', alignItems: 'end' }}>
                  <div>
                    <label style={labelStyle}>Villa / Flat Number</label>
                    <input type="text" value={delivery.villaFlat} onChange={e => setDelivery(d => ({ ...d, villaFlat: e.target.value }))} className={inputClass} />
                  </div>
                  <div>
                    <label style={labelStyle}>Building Name <span style={{ textTransform: 'none', fontWeight: 400, opacity: 0.6 }}>(flats only)</span></label>
                    <input type="text" value={delivery.building} onChange={e => setDelivery(d => ({ ...d, building: e.target.value }))} className={inputClass} disabled={delivery.propertyType !== 'apartment'} style={{ opacity: delivery.propertyType !== 'apartment' ? 0.4 : 1 }} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', alignItems: 'end' }}>
                  <div>
                    <label style={labelStyle}>Street</label>
                    <input type="text" value={delivery.street} onChange={e => setDelivery(d => ({ ...d, street: e.target.value }))} className={inputClass} />
                  </div>
                  <div>
                    <label style={labelStyle}>Sub-community <span style={{ textTransform: 'none', fontWeight: 400, opacity: 0.6 }}>(optional)</span></label>
                    <input type="text" value={delivery.subCommunity} onChange={e => setDelivery(d => ({ ...d, subCommunity: e.target.value }))} className={inputClass} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', alignItems: 'end' }}>
                  <div>
                    <label style={labelStyle}>Community</label>
                    <select value={delivery.communityId} onChange={e => setDelivery(d => ({ ...d, communityId: e.target.value }))} className={inputClass}
                      style={{ appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1L6 7L11 1' stroke='%23888' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round' fill='none'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', paddingRight: '2rem' }}>
                      <option value="">Select community</option>
                      {communities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Emirate</label>
                    <input type="text" value="Dubai" readOnly disabled className={inputClass} style={{ cursor: 'not-allowed', opacity: 0.6 }} />
                  </div>
                </div>
              </div>

              {/* Delivery notes */}
              <div style={{ marginTop: '14px' }}>
                <label style={labelStyle}>Delivery Notes <span style={{ textTransform: 'none', fontWeight: 400, opacity: 0.6 }}>(optional)</span></label>
                <input type="text" placeholder="e.g. gate code, beware tiny ferocious dog…" value={delivery.deliveryNotes} onChange={e => setDelivery(d => ({ ...d, deliveryNotes: e.target.value }))} className={inputClass} />
              </div>

              {/* How to deliver */}
              <div style={{ marginTop: '20px', marginBottom: '4px' }}>
                <label style={{ ...labelStyle, marginBottom: '10px', display: 'block' }}>How should we deliver?</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  {[
                    { value: 'leave_at_door', label: 'At the door', sub: 'Contactless' },
                    { value: 'leave_safe_spot', label: 'Safe spot', sub: 'Contactless' },
                    { value: 'ring_bell', label: 'Ring the bell', sub: "Someone's home" },
                    { value: 'call_no_bell', label: 'Call me', sub: "Don't ring bell" },
                    { value: 'leave_with_reception', label: 'Reception', sub: 'Concierge' },
                  ].map(opt => (
                    <button key={opt.value} type="button" onClick={() => setDelivery(d => ({ ...d, deliveryPreference: opt.value }))}
                      style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '10px', textAlign: 'left', padding: '14px 16px', borderRadius: '14px', border: delivery.deliveryPreference === opt.value ? '4px solid #fee297' : '2px solid #e8e0d4', backgroundColor: delivery.deliveryPreference === opt.value ? '#fffef9' : 'transparent', cursor: 'pointer', transition: 'all 0.15s' }}>
                      <img src={delivery.deliveryPreference === opt.value ? '/star_yellow.png' : '/star_cream.png'} alt="" style={{ width: delivery.deliveryPreference === opt.value ? '32px' : '28px', height: delivery.deliveryPreference === opt.value ? '32px' : '28px', objectFit: 'contain', flexShrink: 0 }} />
                      <div>
                        <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#1a2744', fontSize: '0.85rem', fontWeight: 600, display: 'block' }}>{opt.label}</span>
                        <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#1a2f51', fontSize: '0.72rem', display: 'block', marginTop: '1px' }}>{opt.sub}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {delivery.deliveryPreference === 'leave_safe_spot' && (
                <div style={{ marginTop: '14px' }}>
                  <label style={labelStyle}>Describe the safe spot</label>
                  <input type="text" placeholder="e.g. behind the gate, under the mat…" value={delivery.safeSpot} onChange={e => setDelivery(d => ({ ...d, safeSpot: e.target.value }))} className={inputClass} />
                </div>
              )}

              <SaveButton onClick={saveDelivery} loading={savingSection === 'delivery'} saved={savedSection === 'delivery'} />
            </div>}
          </section>

          {/* ── YOUR PLAN ── */}
          <section style={sectionBorder}>
            <button type="button" onClick={() => toggleSection('plan')} className="flex items-center justify-between w-full"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '16px 0' }}>
              <p style={sectionHeading}>Your Plan</p>
              {chevron('plan')}
            </button>
            {expandedSection === 'plan' && <div style={{ paddingBottom: '20px', paddingTop: '16px' }}>
              <div style={{ borderRadius: '16px', padding: '20px', backgroundColor: '#fffef9', border: '2px solid #e8e0d4' }}>
                {plan ? (
                  <div className="flex items-center justify-between">
                    <div>
                      <p style={{ fontFamily: 'var(--font-cormorant), serif', color: '#1a2f51', fontSize: '1.5rem', fontWeight: 700, margin: '0 0 2px' }}>{plan.name}</p>
                      <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#1a2f51', fontSize: '0.78rem', opacity: 0.7, margin: 0 }}>{plan.book_count} books / month · AED {plan.price_monthly}/mo</p>
                    </div>
                    <span style={{ backgroundColor: 'rgba(46,92,58,0.1)', color: '#2e5c3a', fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '4px 12px', borderRadius: '999px' }}>Active</span>
                  </div>
                ) : (
                  <p style={{ color: '#1a2f51', opacity: 0.6, fontFamily: 'var(--font-montserrat), sans-serif', margin: 0 }}>No active plan found.</p>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
                <button style={{ width: '100%', backgroundColor: '#1a2f51', border: 'none', borderRadius: '999px', cursor: 'pointer', padding: '14px 24px', fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600, fontSize: '0.8rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#fff' }}>Change Plan</button>
                <button style={{ width: '100%', backgroundColor: 'transparent', border: '1.5px solid rgba(26,47,81,0.3)', borderRadius: '999px', cursor: 'pointer', padding: '13px 24px', fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600, fontSize: '0.8rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#1a2f51', opacity: 0.7 }}>Pause or Cancel</button>
              </div>
            </div>}
          </section>

          {/* ── CHILDREN ── */}
          <section style={sectionBorder}>
            <button type="button" onClick={() => toggleSection('readers')} className="flex items-center justify-between w-full"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '16px 0' }}>
              <p style={sectionHeading}>Your Readers</p>
              {chevron('readers')}
            </button>
            {expandedSection === 'readers' && <div style={{ paddingBottom: '20px', paddingTop: '16px' }}>
              <div className="flex flex-col gap-3">
                {children.map(child => {
                  const edit = childEdits[child.id]
                  const expanded = expandedChild === child.id
                  return (
                    <div key={child.id} className="rounded-2xl" style={{ backgroundColor: 'rgba(26,47,81,0.04)', border: '2px solid rgba(26,47,81,0.15)', overflow: 'hidden' }}>
                      <div className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-3">
                          <div className="rounded-full flex items-center justify-center" style={{ width: '56px', height: '56px', backgroundColor: 'rgba(26,47,81,0.12)', border: '2px solid rgba(26,47,81,0.25)', flexShrink: 0 }}>
                            <span style={{ fontFamily: 'var(--font-cormorant), serif', color: '#1a2f51', fontSize: '1.8rem', fontWeight: 700 }}>{child.name?.[0]}</span>
                          </div>
                          <div>
                            <p style={{ fontFamily: 'var(--font-cormorant), serif', color: '#1a2f51', fontSize: '1.2rem', fontWeight: 700 }}>{child.name}</p>
                            <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#1a2f51', fontSize: '0.75rem', opacity: 0.6 }}>
                              {edit?.swapPermission === 'independent_submit' ? 'Fly Solo' : 'Fly with the Flock'}
                              {edit?.bookSlots != null ? ` · ${edit.bookSlots} book${edit.bookSlots !== 1 ? 's' : ''}/swap` : ''}
                            </p>
                          </div>
                        </div>
                        <button onClick={() => setExpandedChild(expanded ? null : child.id)}
                          className="rounded-lg px-3 py-1.5 text-xs font-bold"
                          style={{ backgroundColor: 'rgba(26,47,81,0.1)', color: '#1a2f51', fontFamily: 'var(--font-montserrat), sans-serif', border: '1px solid rgba(26,47,81,0.2)' }}>
                          {expanded ? 'Done' : 'Edit'}
                        </button>
                      </div>
                      {expanded && edit && (
                        <div className="flex flex-col gap-8 px-4 pb-6" style={{ borderTop: '1px solid rgba(26,47,81,0.1)', backgroundColor: '#fefaf2' }}>
                          {/* Name */}
                          <section className="pt-5">
                            <p style={{ fontFamily: 'var(--font-cormorant), serif', fontWeight: 700, color: '#1a2f51', fontSize: '1.4rem', margin: '0 0 12px', lineHeight: 1 }}>Name</p>
                            <div style={{ display: 'flex', gap: '10px' }}>
                              <div style={{ flex: 1 }}>
                                <label style={{ ...labelStyle, display: 'block', marginBottom: '4px' }}>First name</label>
                                <input type="text" placeholder="First name" value={edit.name}
                                  onChange={e => setChildEdits(prev => ({ ...prev, [child.id]: { ...prev[child.id], name: e.target.value } }))}
                                  className={inputClass} />
                              </div>
                              <div style={{ flex: 1 }}>
                                <label style={{ ...labelStyle, display: 'block', marginBottom: '4px' }}>Last name</label>
                                <input type="text" placeholder="Last name" value={edit.lastName}
                                  onChange={e => setChildEdits(prev => ({ ...prev, [child.id]: { ...prev[child.id], lastName: e.target.value } }))}
                                  className={inputClass} />
                              </div>
                            </div>
                          </section>
                          {/* Date of Birth */}
                          <section>
                            <p style={{ fontFamily: 'var(--font-cormorant), serif', fontWeight: 700, color: '#1a2f51', fontSize: '1.4rem', margin: '0 0 12px', lineHeight: 1 }}>Date Of Birth</p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <input type="text" inputMode="numeric" maxLength={2} placeholder="DD" value={edit.dobDay}
                                onChange={e => { const v = e.target.value.replace(/\D/g, ''); setChildEdits(prev => ({ ...prev, [child.id]: { ...prev[child.id], dobDay: v } })); if (v.length === 2) dobMonthRefs.current[child.id]?.focus() }}
                                className={inputClass} style={{ width: '72px', textAlign: 'center', paddingLeft: '4px', paddingRight: '4px' }} />
                              <span style={{ color: '#1a2f51', fontSize: '1.2rem' }}>/</span>
                              <input ref={el => { dobMonthRefs.current[child.id] = el }} type="text" inputMode="numeric" maxLength={2} placeholder="MM" value={edit.dobMonth}
                                onChange={e => { const v = e.target.value.replace(/\D/g, ''); setChildEdits(prev => ({ ...prev, [child.id]: { ...prev[child.id], dobMonth: v } })); if (v.length === 2) dobYearRefs.current[child.id]?.focus() }}
                                className={inputClass} style={{ width: '72px', textAlign: 'center', paddingLeft: '4px', paddingRight: '4px' }} />
                              <span style={{ color: '#1a2f51', fontSize: '1.2rem' }}>/</span>
                              <input ref={el => { dobYearRefs.current[child.id] = el }} type="text" inputMode="numeric" maxLength={4} placeholder="YYYY" value={edit.dobYear}
                                onChange={e => setChildEdits(prev => ({ ...prev, [child.id]: { ...prev[child.id], dobYear: e.target.value.replace(/\D/g, '') } }))}
                                className={inputClass} style={{ width: '100px', textAlign: 'center', paddingLeft: '4px', paddingRight: '4px' }} />
                            </div>
                          </section>
                          {/* Independence Level */}
                          <section>
                            <p style={{ fontFamily: 'var(--font-cormorant), serif', fontWeight: 700, color: '#1a2f51', fontSize: '1.4rem', margin: '0 0 12px', lineHeight: 1 }}>Independence Level</p>
                            <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#1a2f51', fontSize: '0.9rem', marginBottom: '12px', lineHeight: '1.5' }}>How much control would you like {child.name} to have over book choices, deliveries & collections?</p>
                            <div className="flex flex-col gap-3">
                              {[
                                { value: 'prepare_only', label: 'Fly with the Flock', image: '/bonky_family.png', bullet: 'You approve each time', padRight: '115px' },
                                { value: 'independent_submit', label: 'Fly Solo', image: '/bonky_cape.png', bullet: `${child.name} confirms without\nyour approval`, padRight: '90px' },
                              ].map(perm => (
                                <button key={perm.value} type="button"
                                  onClick={() => setChildEdits(prev => ({ ...prev, [child.id]: { ...prev[child.id], swapPermission: perm.value } }))}
                                  className="text-left px-4 py-4 rounded-2xl transition-all"
                                  style={{ backgroundColor: edit.swapPermission === perm.value ? '#fffef9' : 'transparent', border: edit.swapPermission === perm.value ? '4px solid #fee297' : '2px solid #e8e0d4', position: 'relative', minHeight: '100px', overflow: 'hidden' }}>
                                  <p style={{ fontFamily: 'var(--font-cormorant), serif', color: '#1a2f51', fontSize: '1.6rem', fontWeight: 700, marginBottom: '4px', paddingRight: '90px' }}>
                                    {perm.label}
                                  </p>
                                  <ul className="mt-1 flex flex-col gap-1" style={{ paddingRight: perm.padRight }}>
                                    <li style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#1a2f51', fontSize: '0.9rem' }}><span style={{ whiteSpace: 'pre-line' }}>{perm.bullet}</span></li>
                                  </ul>
                                  <img src={perm.image} alt="" style={{ position: 'absolute', bottom: 0, right: 0, height: '105px', width: 'auto' }} />
                                </button>
                              ))}
                            </div>
                          </section>
                          {/* Book Allocation */}
                          <section>
                            <p style={{ fontFamily: 'var(--font-cormorant), serif', fontWeight: 700, color: '#1a2f51', fontSize: '1.4rem', margin: '0 0 12px', lineHeight: 1 }}>Book Allocation <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 400, fontSize: '0.75rem', opacity: 0.7 }}>(optional)</span></p>
                            <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#1a2f51', fontSize: '0.9rem', marginBottom: '12px', lineHeight: '1.5' }}>Set how many of your plan's books {child.name} can choose each Bonkers Day. Leave blank if you don't need a limit per child.</p>
                            <div className="flex items-center justify-center gap-6">
                              <button type="button" onClick={() => setChildEdits(prev => ({ ...prev, [child.id]: { ...prev[child.id], bookSlots: (prev[child.id].bookSlots ?? 1) <= 1 ? null : (prev[child.id].bookSlots ?? 1) - 1 } }))}
                                className="flex items-center justify-center rounded-full"
                                style={{ width: '44px', height: '44px', border: '2px solid #1a2f51', color: '#1a2f51', fontSize: '1.5rem', backgroundColor: 'transparent', cursor: 'pointer' }}>−</button>
                              <span style={{ fontFamily: 'var(--font-cormorant), serif', color: '#1a2f51', fontSize: '3rem', fontWeight: 700, lineHeight: 1, minWidth: '40px', textAlign: 'center' }}>{edit.bookSlots === null ? '—' : edit.bookSlots}</span>
                              <button type="button" onClick={() => setChildEdits(prev => ({ ...prev, [child.id]: { ...prev[child.id], bookSlots: (prev[child.id].bookSlots ?? 0) + 1 } }))}
                                className="flex items-center justify-center rounded-full"
                                style={{ width: '44px', height: '44px', border: '2px solid #1a2f51', color: '#1a2f51', fontSize: '1.5rem', backgroundColor: 'transparent', cursor: 'pointer' }}>+</button>
                            </div>
                          </section>
                          {/* Profile PIN */}
                          <section>
                            <p style={{ fontFamily: 'var(--font-cormorant), serif', fontWeight: 700, color: '#1a2f51', fontSize: '1.4rem', margin: '0 0 12px', lineHeight: 1 }}>Profile PIN <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 400, fontSize: '0.75rem', opacity: 0.7 }}>(optional)</span></p>
                            <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#1a2f51', fontSize: '0.9rem', marginBottom: '12px', lineHeight: '1.5' }}>Keep mischievous siblings out of this profile.</p>
                            <input type="text" inputMode="numeric" maxLength={4} placeholder="Enter new 4-digit PIN to change"
                              value={edit.pin}
                              onChange={e => setChildEdits(prev => ({ ...prev, [child.id]: { ...prev[child.id], pin: e.target.value.replace(/\D/g, '').slice(0, 4) } }))}
                              className={inputClass} style={{ letterSpacing: '0.3em', textAlign: 'center', fontSize: '1.1rem' }} />
                          </section>
                          {/* Name Shown On Reviews */}
                          <section>
                            <p style={{ fontFamily: 'var(--font-cormorant), serif', fontWeight: 700, color: '#1a2f51', fontSize: '1.4rem', margin: '0 0 12px', lineHeight: 1 }}>Name Shown On Reviews</p>
                            <div className="flex flex-col gap-2">
                              {(() => {
                                const age = child.date_of_birth ? Math.floor((Date.now() - new Date(child.date_of_birth).getTime()) / (1000*60*60*24*365.25)) : null
                                return [
                                  { value: 'first_name', label: `${child.name}${age !== null ? `, Age ${age}` : ''}` },
                                  { value: 'anonymous', label: `Bonkers reader${age !== null ? `, Age ${age}` : ''}` },
                                ].map(opt => (
                                  <button key={opt.value} type="button"
                                    onClick={() => setChildEdits(prev => ({ ...prev, [child.id]: { ...prev[child.id], reviewDisplay: opt.value } }))}
                                    className="flex items-center gap-3 text-left"
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}>
                                    <img src={edit.reviewDisplay === opt.value ? '/star_yellow.png' : '/star_cream.png'} alt="" style={{ width: edit.reviewDisplay === opt.value ? '40px' : '34px', height: edit.reviewDisplay === opt.value ? '40px' : '34px', flexShrink: 0 }} />
                                    <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#1a2f51', fontSize: '0.95rem', fontWeight: 400, margin: 0 }}>{opt.label}</p>
                                  </button>
                                ))
                              })()}
                            </div>
                          </section>
                          {/* Actions */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <button type="button" onClick={() => saveChildSettings(child.id)} disabled={childSaving[child.id]}
                              style={{ width: '100%', backgroundColor: childSaved[child.id] ? '#2e5c3a' : '#1a2f51', border: 'none', borderRadius: '999px', cursor: childSaving[child.id] ? 'not-allowed' : 'pointer', padding: '14px 24px', fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600, fontSize: '0.8rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#fff', opacity: childSaving[child.id] ? 0.7 : 1, transition: 'background-color 0.2s' }}>
                              {childSaving[child.id] ? 'Saving…' : childSaved[child.id] ? 'Saved ✓' : 'Save Changes'}
                            </button>
                            <button type="button" onClick={() => deleteChild(child.id)}
                              style={{ width: '100%', backgroundColor: 'transparent', border: '1.5px solid rgba(192,57,43,0.4)', borderRadius: '999px', cursor: 'pointer', padding: '13px 24px', fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600, fontSize: '0.8rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#c0392b', opacity: 0.8 }}>
                              Remove Reader
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>}
          </section>

          {/* ── NOTIFICATIONS ── */}
          <section style={sectionBorder}>
            <button type="button" onClick={() => toggleSection('notifications')} className="flex items-center justify-between w-full"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '16px 0' }}>
              <p style={sectionHeading}>Notifications</p>
              {chevron('notifications')}
            </button>
            {expandedSection === 'notifications' && <div style={{ paddingBottom: '20px', paddingTop: '16px' }}>
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-3">
                  {[{ key: 'whatsapp' as const, label: 'WhatsApp' }, { key: 'email' as const, label: 'Email' }].map(({ key, label }) => (
                    <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#1a2f51', fontSize: '0.85rem', fontWeight: 600 }}>{label}</span>
                      <button type="button" onClick={() => toggleNotif(key)}
                        style={{ width: isTablet ? '80px' : '52px', height: isTablet ? '34px' : '28px', borderRadius: '999px', backgroundColor: notifications[key] ? '#1a2f51' : 'rgba(26,47,81,0.15)', border: 'none', cursor: 'pointer', position: 'relative', transition: 'background-color 0.2s', flexShrink: 0 }}>
                        <span style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', left: notifications[key] ? '5px' : 'auto', right: notifications[key] ? 'auto' : '5px', fontFamily: 'var(--font-montserrat), sans-serif', fontSize: isTablet ? '0.55rem' : '0.42rem', fontWeight: 700, letterSpacing: '0.04em', color: notifications[key] ? '#fefaf2' : 'rgba(26,47,81,0.5)', lineHeight: 1 }}>
                          {notifications[key] ? 'ON' : 'OFF'}
                        </span>
                        <span style={{ position: 'absolute', top: '3px', left: notifications[key] ? (isTablet ? '49px' : '27px') : '3px', width: isTablet ? '28px' : '22px', height: isTablet ? '28px' : '22px', borderRadius: '50%', backgroundColor: '#fff', transition: 'left 0.2s', display: 'block', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                      </button>
                    </div>
                  ))}
                </div>
                {/* Children can ring the bell */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ flex: 1, paddingRight: '16px' }}>
                    <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#1a2f51', fontSize: '0.85rem', fontWeight: 600, display: 'block' }}>Children can ring the bell</span>
                    <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#1a2f51', fontSize: '0.75rem', opacity: 0.7, display: 'block', marginTop: '2px' }}>Allow your readers to request notifications for unavailable books</span>
                  </div>
                  <button type="button" onClick={toggleChildNotify}
                    style={{ width: isTablet ? '80px' : '52px', height: isTablet ? '34px' : '28px', borderRadius: '999px', backgroundColor: childNotifyEnabled ? '#1a2f51' : 'rgba(26,47,81,0.15)', border: 'none', cursor: 'pointer', position: 'relative', transition: 'background-color 0.2s', flexShrink: 0 }}>
                    <span style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', left: childNotifyEnabled ? '5px' : 'auto', right: childNotifyEnabled ? 'auto' : '5px', fontFamily: 'var(--font-montserrat), sans-serif', fontSize: isTablet ? '0.55rem' : '0.42rem', fontWeight: 700, letterSpacing: '0.04em', color: childNotifyEnabled ? '#fefaf2' : 'rgba(26,47,81,0.5)', lineHeight: 1 }}>
                      {childNotifyEnabled ? 'ON' : 'OFF'}
                    </span>
                    <span style={{ position: 'absolute', top: '3px', left: childNotifyEnabled ? (isTablet ? '49px' : '27px') : '3px', width: isTablet ? '28px' : '22px', height: isTablet ? '28px' : '22px', borderRadius: '50%', backgroundColor: '#fff', transition: 'left 0.2s', display: 'block', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                  </button>
                </div>
                {/* Marketing */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ flex: 1, paddingRight: '16px' }}>
                    <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#1a2f51', fontSize: '0.85rem', fontWeight: 600, display: 'block' }}>Bonkers news &amp; recommendations</span>
                    <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#1a2f51', fontSize: '0.75rem', opacity: 0.7, display: 'block', marginTop: '2px' }}>Book picks, updates and other brilliant nonsense</span>
                  </div>
                  <button type="button" onClick={() => toggleNotif('marketing')}
                    style={{ width: isTablet ? '80px' : '52px', height: isTablet ? '34px' : '28px', borderRadius: '999px', backgroundColor: notifications.marketing ? '#1a2f51' : 'rgba(26,47,81,0.15)', border: 'none', cursor: 'pointer', position: 'relative', transition: 'background-color 0.2s', flexShrink: 0 }}>
                    <span style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', left: notifications.marketing ? '5px' : 'auto', right: notifications.marketing ? 'auto' : '5px', fontFamily: 'var(--font-montserrat), sans-serif', fontSize: isTablet ? '0.55rem' : '0.42rem', fontWeight: 700, letterSpacing: '0.04em', color: notifications.marketing ? '#fefaf2' : 'rgba(26,47,81,0.5)', lineHeight: 1 }}>
                      {notifications.marketing ? 'ON' : 'OFF'}
                    </span>
                    <span style={{ position: 'absolute', top: '3px', left: notifications.marketing ? (isTablet ? '49px' : '27px') : '3px', width: isTablet ? '28px' : '22px', height: isTablet ? '28px' : '22px', borderRadius: '50%', backgroundColor: '#fff', transition: 'left 0.2s', display: 'block', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                  </button>
                </div>
                {notifError && <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#c0392b', fontSize: '0.9rem' }}>{notifError}</p>}
                <SaveButton onClick={saveNotifications} loading={savingSection === 'notifications'} saved={savedSection === 'notifications'} />
              </div>
            </div>}
          </section>

          {/* ── PARENT PIN ── */}
          <section style={sectionBorder}>
            <button type="button" onClick={() => toggleSection('pin')} className="flex items-center justify-between w-full"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '16px 0' }}>
              <p style={sectionHeading}>Parent PIN</p>
              {chevron('pin')}
            </button>
            {expandedSection === 'pin' && <div style={{ paddingBottom: '20px', paddingTop: '16px' }}>
              <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#1a2f51', fontSize: '0.78rem', marginBottom: '16px', textAlign: 'left' }}>
                Your PIN locks the parent dashboard from being accessed via the child profile so little hands can&apos;t reach billing.
              </p>
              <div className="flex flex-col gap-1">
                <label style={labelStyle}>Enter new PIN</label>
                <input type="text" inputMode="numeric" maxLength={4} value={parentPin}
                  onChange={e => setParentPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  className={inputClass} style={{ letterSpacing: '0.3em', textAlign: 'center', fontSize: '1.1rem' }} />
              </div>
              {parentPinError && <p style={{ color: '#c0392b', fontSize: '0.9rem', fontFamily: 'var(--font-montserrat), sans-serif', marginTop: '8px' }}>{parentPinError}</p>}
              <div style={{ marginTop: '32px' }}>
                <SaveButton onClick={saveParentPin} loading={savingSection === 'parent_pin'} saved={parentPinSaved} />
              </div>
            </div>}
          </section>

          {/* Log out */}
          <button onClick={async () => { await supabase.auth.signOut(); router.push('/') }}
            style={{ display: 'block', margin: '32px auto 0', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.85rem', color: '#1a2f51', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            <span style={{ borderBottom: '2px solid #f9ce71', paddingBottom: '1px' }}>Log out</span>
          </button>

        </div>
      </div>

      {/* ── AVATAR MODAL ── */}
      {showAvatarModal && (
        <div onClick={() => setShowAvatarModal(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 60, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ backgroundColor: '#fefaf2', border: '2px solid rgba(26,47,81,0.15)', borderRadius: '24px 24px 0 0', padding: '32px 24px 48px', width: '100%', maxWidth: '768px' }}>
            <p style={{ fontFamily: 'var(--font-cormorant), serif', fontWeight: 700, color: '#1a2f51', fontSize: '2rem', marginBottom: '24px', textAlign: 'center' }}>Choose your avatar</p>
            <div className="grid grid-cols-4 gap-4">
              {AVATARS.map(av => (
                <button key={av.id} type="button"
                  onClick={() => { setAccount(a => ({ ...a, avatarId: av.id })); setShowAvatarModal(false) }}
                  style={{ width: '100%', aspectRatio: '1', borderRadius: '50%', fontSize: '2.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: av.bg, border: account.avatarId === av.id ? '4px solid #1a2f51' : '4px solid transparent', cursor: 'pointer', transform: account.avatarId === av.id ? 'scale(1.1)' : 'scale(1)', transition: 'all 0.15s' }}>
                  {av.emoji}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── BOTTOM NAV ── */}
      <div className="fixed bottom-0 left-0 right-0" style={{ backgroundColor: '#1a2f51', zIndex: 40 }}>
        <div className="max-w-xl mx-auto flex items-center justify-around px-2" style={{ paddingTop: '8px', paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}>
          {[
            { label: 'Home', path: '/dashboard', exact: true, icon: () => <svg className="nav-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>, onClick: () => router.push('/dashboard') },
            { label: 'Library', path: '/dashboard/library', exact: false, icon: () => <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>, onClick: () => router.push('/dashboard/library') },
            { label: 'Settings', path: '/dashboard/settings', exact: false, icon: () => <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>, onClick: () => router.push('/dashboard/settings') },
            { label: 'Support', path: '/dashboard/support', exact: false, icon: () => <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>, onClick: () => router.push('/dashboard/support') },
          ].map((item, i) => {
            const active = item.exact ? pathname === item.path : pathname.startsWith(item.path)
            return (
              <button key={i} onClick={item.onClick} className="flex flex-col items-center gap-1 flex-1"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: active ? '#f9d174' : '#fefaf2', opacity: 1, padding: '6px 0' }}>
                {item.icon()}
                <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.58rem', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700 }}>{item.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </main>
  )
}
