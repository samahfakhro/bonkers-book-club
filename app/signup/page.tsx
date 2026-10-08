﻿'use client'

import { useState, useEffect, useRef } from 'react'
import confetti from 'canvas-confetti'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Suspense } from 'react'
import SignupMap, { type Zone, type MapResult } from '@/components/SignupMap'
import AddressFields, { validateAddress } from '@/components/AddressFields'

const PLANS = [
  { id: 'mid', label: 'A Little Bonkers', price: 149, badge: null, books: 16, swapBooks: 4 },
  { id: 'full', label: 'Quite Bonkers', price: 199, badge: null, books: 24, swapBooks: 6 },
]

const COUNTRY_CODES = [
  { code: '+971', label: '🇦🇪 +971' },
  { code: '+93', label: '🇦🇫 +93' },
  { code: '+355', label: '🇦🇱 +355' },
  { code: '+213', label: '🇩🇿 +213' },
  { code: '+376', label: '🇦🇩 +376' },
  { code: '+244', label: '🇦🇴 +244' },
  { code: '+1268', label: '🇦🇬 +1268' },
  { code: '+54', label: '🇦🇷 +54' },
  { code: '+374', label: '🇦🇲 +374' },
  { code: '+61', label: '🇦🇺 +61' },
  { code: '+43', label: '🇦🇹 +43' },
  { code: '+994', label: '🇦🇿 +994' },
  { code: '+1242', label: '🇧🇸 +1242' },
  { code: '+973', label: '🇧🇭 +973' },
  { code: '+880', label: '🇧🇩 +880' },
  { code: '+1246', label: '🇧🇧 +1246' },
  { code: '+375', label: '🇧🇾 +375' },
  { code: '+32', label: '🇧🇪 +32' },
  { code: '+501', label: '🇧🇿 +501' },
  { code: '+229', label: '🇧🇯 +229' },
  { code: '+975', label: '🇧🇹 +975' },
  { code: '+591', label: '🇧🇴 +591' },
  { code: '+387', label: '🇧🇦 +387' },
  { code: '+267', label: '🇧🇼 +267' },
  { code: '+55', label: '🇧🇷 +55' },
  { code: '+673', label: '🇧🇳 +673' },
  { code: '+359', label: '🇧🇬 +359' },
  { code: '+226', label: '🇧🇫 +226' },
  { code: '+257', label: '🇧🇮 +257' },
  { code: '+855', label: '🇰🇭 +855' },
  { code: '+237', label: '🇨🇲 +237' },
  { code: '+1', label: '🇨🇦 +1' },
  { code: '+238', label: '🇨🇻 +238' },
  { code: '+236', label: '🇨🇫 +236' },
  { code: '+235', label: '🇹🇩 +235' },
  { code: '+56', label: '🇨🇱 +56' },
  { code: '+86', label: '🇨🇳 +86' },
  { code: '+57', label: '🇨🇴 +57' },
  { code: '+269', label: '🇰🇲 +269' },
  { code: '+242', label: '🇨🇬 +242' },
  { code: '+243', label: '🇨🇩 +243' },
  { code: '+506', label: '🇨🇷 +506' },
  { code: '+385', label: '🇭🇷 +385' },
  { code: '+53', label: '🇨🇺 +53' },
  { code: '+357', label: '🇨🇾 +357' },
  { code: '+420', label: '🇨🇿 +420' },
  { code: '+45', label: '🇩🇰 +45' },
  { code: '+253', label: '🇩🇯 +253' },
  { code: '+1767', label: '🇩🇲 +1767' },
  { code: '+1809', label: '🇩🇴 +1809' },
  { code: '+593', label: '🇪🇨 +593' },
  { code: '+20', label: '🇪🇬 +20' },
  { code: '+503', label: '🇸🇻 +503' },
  { code: '+240', label: '🇬🇶 +240' },
  { code: '+291', label: '🇪🇷 +291' },
  { code: '+372', label: '🇪🇪 +372' },
  { code: '+251', label: '🇪🇹 +251' },
  { code: '+679', label: '🇫🇯 +679' },
  { code: '+358', label: '🇫🇮 +358' },
  { code: '+33', label: '🇫🇷 +33' },
  { code: '+241', label: '🇬🇦 +241' },
  { code: '+220', label: '🇬🇲 +220' },
  { code: '+995', label: '🇬🇪 +995' },
  { code: '+49', label: '🇩🇪 +49' },
  { code: '+233', label: '🇬🇭 +233' },
  { code: '+30', label: '🇬🇷 +30' },
  { code: '+1473', label: '🇬🇩 +1473' },
  { code: '+502', label: '🇬🇹 +502' },
  { code: '+224', label: '🇬🇳 +224' },
  { code: '+245', label: '🇬🇼 +245' },
  { code: '+592', label: '🇬🇾 +592' },
  { code: '+509', label: '🇭🇹 +509' },
  { code: '+504', label: '🇭🇳 +504' },
  { code: '+852', label: '🇭🇰 +852' },
  { code: '+36', label: '🇭🇺 +36' },
  { code: '+354', label: '🇮🇸 +354' },
  { code: '+91', label: '🇮🇳 +91' },
  { code: '+62', label: '🇮🇩 +62' },
  { code: '+98', label: '🇮🇷 +98' },
  { code: '+964', label: '🇮🇶 +964' },
  { code: '+353', label: '🇮🇪 +353' },
  { code: '+972', label: '🇮🇱 +972' },
  { code: '+39', label: '🇮🇹 +39' },
  { code: '+1876', label: '🇯🇲 +1876' },
  { code: '+81', label: '🇯🇵 +81' },
  { code: '+962', label: '🇯🇴 +962' },
  { code: '+7', label: '🇰🇿 +7' },
  { code: '+254', label: '🇰🇪 +254' },
  { code: '+686', label: '🇰🇮 +686' },
  { code: '+965', label: '🇰🇼 +965' },
  { code: '+996', label: '🇰🇬 +996' },
  { code: '+856', label: '🇱🇦 +856' },
  { code: '+371', label: '🇱🇻 +371' },
  { code: '+961', label: '🇱🇧 +961' },
  { code: '+266', label: '🇱🇸 +266' },
  { code: '+231', label: '🇱🇷 +231' },
  { code: '+218', label: '🇱🇾 +218' },
  { code: '+423', label: '🇱🇮 +423' },
  { code: '+370', label: '🇱🇹 +370' },
  { code: '+352', label: '🇱🇺 +352' },
  { code: '+853', label: '🇲🇴 +853' },
  { code: '+261', label: '🇲🇬 +261' },
  { code: '+265', label: '🇲🇼 +265' },
  { code: '+60', label: '🇲🇾 +60' },
  { code: '+960', label: '🇲🇻 +960' },
  { code: '+223', label: '🇲🇱 +223' },
  { code: '+356', label: '🇲🇹 +356' },
  { code: '+222', label: '🇲🇷 +222' },
  { code: '+230', label: '🇲🇺 +230' },
  { code: '+52', label: '🇲🇽 +52' },
  { code: '+373', label: '🇲🇩 +373' },
  { code: '+377', label: '🇲🇨 +377' },
  { code: '+976', label: '🇲🇳 +976' },
  { code: '+382', label: '🇲🇪 +382' },
  { code: '+212', label: '🇲🇦 +212' },
  { code: '+258', label: '🇲🇿 +258' },
  { code: '+95', label: '🇲🇲 +95' },
  { code: '+264', label: '🇳🇦 +264' },
  { code: '+674', label: '🇳🇷 +674' },
  { code: '+977', label: '🇳🇵 +977' },
  { code: '+31', label: '🇳🇱 +31' },
  { code: '+64', label: '🇳🇿 +64' },
  { code: '+505', label: '🇳🇮 +505' },
  { code: '+227', label: '🇳🇪 +227' },
  { code: '+234', label: '🇳🇬 +234' },
  { code: '+850', label: '🇰🇵 +850' },
  { code: '+389', label: '🇲🇰 +389' },
  { code: '+47', label: '🇳🇴 +47' },
  { code: '+968', label: '🇴🇲 +968' },
  { code: '+92', label: '🇵🇰 +92' },
  { code: '+680', label: '🇵🇼 +680' },
  { code: '+970', label: '🇵🇸 +970' },
  { code: '+507', label: '🇵🇦 +507' },
  { code: '+675', label: '🇵🇬 +675' },
  { code: '+595', label: '🇵🇾 +595' },
  { code: '+51', label: '🇵🇪 +51' },
  { code: '+63', label: '🇵🇭 +63' },
  { code: '+48', label: '🇵🇱 +48' },
  { code: '+351', label: '🇵🇹 +351' },
  { code: '+974', label: '🇶🇦 +974' },
  { code: '+40', label: '🇷🇴 +40' },
  { code: '+7', label: '🇷🇺 +7' },
  { code: '+250', label: '🇷🇼 +250' },
  { code: '+1869', label: '🇰🇳 +1869' },
  { code: '+1758', label: '🇱🇨 +1758' },
  { code: '+1784', label: '🇻🇨 +1784' },
  { code: '+685', label: '🇼🇸 +685' },
  { code: '+378', label: '🇸🇲 +378' },
  { code: '+239', label: '🇸🇹 +239' },
  { code: '+966', label: '🇸🇦 +966' },
  { code: '+221', label: '🇸🇳 +221' },
  { code: '+381', label: '🇷🇸 +381' },
  { code: '+248', label: '🇸🇨 +248' },
  { code: '+232', label: '🇸🇱 +232' },
  { code: '+65', label: '🇸🇬 +65' },
  { code: '+421', label: '🇸🇰 +421' },
  { code: '+386', label: '🇸🇮 +386' },
  { code: '+677', label: '🇸🇧 +677' },
  { code: '+252', label: '🇸🇴 +252' },
  { code: '+27', label: '🇿🇦 +27' },
  { code: '+82', label: '🇰🇷 +82' },
  { code: '+211', label: '🇸🇸 +211' },
  { code: '+34', label: '🇪🇸 +34' },
  { code: '+94', label: '🇱🇰 +94' },
  { code: '+249', label: '🇸🇩 +249' },
  { code: '+597', label: '🇸🇷 +597' },
  { code: '+46', label: '🇸🇪 +46' },
  { code: '+41', label: '🇨🇭 +41' },
  { code: '+963', label: '🇸🇾 +963' },
  { code: '+886', label: '🇹🇼 +886' },
  { code: '+992', label: '🇹🇯 +992' },
  { code: '+255', label: '🇹🇿 +255' },
  { code: '+66', label: '🇹🇭 +66' },
  { code: '+670', label: '🇹🇱 +670' },
  { code: '+228', label: '🇹🇬 +228' },
  { code: '+676', label: '🇹🇴 +676' },
  { code: '+1868', label: '🇹🇹 +1868' },
  { code: '+216', label: '🇹🇳 +216' },
  { code: '+90', label: '🇹🇷 +90' },
  { code: '+993', label: '🇹🇲 +993' },
  { code: '+688', label: '🇹🇻 +688' },
  { code: '+256', label: '🇺🇬 +256' },
  { code: '+380', label: '🇺🇦 +380' },
  { code: '+44', label: '🇬🇧 +44' },
  { code: '+1', label: '🇺🇸 +1' },
  { code: '+598', label: '🇺🇾 +598' },
  { code: '+998', label: '🇺🇿 +998' },
  { code: '+678', label: '🇻🇺 +678' },
  { code: '+58', label: '🇻🇪 +58' },
  { code: '+84', label: '🇻🇳 +84' },
  { code: '+967', label: '🇾🇪 +967' },
  { code: '+260', label: '🇿🇲 +260' },
  { code: '+263', label: '🇿🇼 +263' },
]

const HOW_OPTIONS = [
  { value: 'friend', label: 'Family/Friends', followUp: null },
  { value: 'instagram', label: 'Instagram/TikTok', followUp: null },
  { value: 'school', label: "My child's school", followUp: 'Which school?' },
  { value: 'influencer', label: 'Influencer/Blogger', followUp: null },
  { value: 'flyer', label: 'Flyer', followUp: null },
  { value: 'google', label: 'Internet Search', followUp: null },
  { value: 'ai', label: 'AI Search', followUp: null },
  { value: 'other', label: 'Other', followUp: 'Tell us more' },
]

const STEP_CONFIG = [
  { num: 1, label: 'Plan' },
  { num: 2, label: 'Details' },
  { num: 3, label: 'Delivery' },
  { num: 4, label: 'Preferences' },
  { num: 5, label: 'Payment' },
]

type CheckStep = 'map' | 'waitlist' | 'waitlist-done' | 'signup' | 'confirm-email'

function SignupForm() {
  const router = useRouter()
  const params = useSearchParams()
  const communityParam = params.get('community') || ''
  const typeParam = params.get('type') || ''

  const [step, setStep] = useState<CheckStep>('signup')
  const [currentStep, setCurrentStep] = useState<1|2|3|4|5>(1)
  const [zones, setZones] = useState<Zone[]>([])
  const [mapResult, setMapResult] = useState<MapResult | null>(null)
  const [pinConfirmed, setPinConfirmed] = useState(false)
  const [waitlistLoading, setWaitlistLoading] = useState(false)
  const [waitlistError, setWaitlistError] = useState('')
  const [checkingPin, setCheckingPin] = useState(false)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [stepErrors, setStepErrors] = useState<Record<string, string>>({})
  const [showPassword, setShowPassword] = useState(false)
  const [isTablet, setIsTablet] = useState(false)

  const [countrySearch, setCountrySearch] = useState('')
  const [countryDropdownOpen, setCountryDropdownOpen] = useState(false)
  const countryDropdownRef = useRef<HTMLDivElement>(null)

  const [form, setForm] = useState({
    firstName: '', lastName: '', phone: '', whatsapp: '',
    whatsappCountryCode: '+971', email: '', password: '',
    villaFlat: '', building: '', floor: '', street: '',
    subCommunity: '', area: '', community: communityParam,
    houseType: typeParam, city: 'Dubai', planId: 'mid',
    deliveryPreference: '', hearAboutUs: '', hearDetail: '',
    agreedToTerms: false, agreedToMarketing: false,
    deliveryNotes: '', safeSpotDescription: '',
  })

  const set = (field: string, value: unknown) => setForm(f => ({ ...f, [field]: value }))
  const selectedPlan = PLANS.find(p => p.id === form.planId)!
  const selectedHowOption = HOW_OPTIONS.find(o => o.value === form.hearAboutUs)

  useEffect(() => {
    const check = () => setIsTablet(window.innerWidth >= 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    supabase.from('zones').select('id, name, bonkers_day, polygon')
      .then(({ data }) => { if (data) setZones(data) })
  }, [])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (countryDropdownRef.current && !countryDropdownRef.current.contains(e.target as Node)) {
        setCountryDropdownOpen(false); setCountrySearch('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleMapProceed = (result: MapResult) => {
    setMapResult(result)
  }

  // A pin in two zones means the zone setup is wrong — don't let them continue on a guessed day
  const canConfirmPin = !!mapResult && mapResult.areaStatus !== 'conflict'

  // Server decides (caps + pauses); any failure sends them to the waitlist
  const canJoinAt = async (lat?: number, lng?: number) => {
    try {
      const res = await fetch('/api/membership/availability', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lng }),
      })
      return res.ok && (await res.json()).canJoin === true
    } catch {
      return false
    }
  }

  const confirmPin = async () => {
    setCheckingPin(true)
    const ok = await canJoinAt(mapResult?.lat, mapResult?.lng)
    setCheckingPin(false)
    if (!ok) return goToWaitlist()
    setPinConfirmed(true)
    setStepErrors(p => ({ ...p, mapPin: '' }))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const goToWaitlist = () => {
    setWaitlistError('')
    setStep('waitlist')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Details + pin were already collected — just save them
  const handleWaitlist = async () => {
    setWaitlistLoading(true)
    setWaitlistError('')
    const res = await fetch('/api/waitlist', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `${form.firstName} ${form.lastName}`.trim(), email: form.email, phone: form.phone,
        lat: mapResult?.lat, lng: mapResult?.lng,
        address: mapResult?.address.fullText, area: mapResult?.address.area,
        propertyType: form.houseType,
      }),
    }).catch(() => null)
    setWaitlistLoading(false)
    if (!res?.ok) return setWaitlistError('Something went wrong. Please try again.')
    setStep('waitlist-done')
  }

  const validateAndNext = () => {
    const errs: Record<string, string> = {}
    if (currentStep === 2) {
      if (!form.firstName.trim()) errs.firstName = 'Required'
      if (!form.lastName.trim()) errs.lastName = 'Required'
      if (!form.email.trim()) errs.email = 'Required'
      if (form.password.length < 8) errs.password = 'At least 8 characters'
      if (!/^05\d{8}$/.test(form.phone.replace(/\s/g, ''))) errs.phone = 'Valid UAE number (05XXXXXXXX)'
    }
    if (currentStep === 3 && !pinConfirmed) {
      errs.mapPin = 'Please confirm your location on the map before continuing.'
    }
    if (currentStep === 3 && pinConfirmed) Object.assign(errs, validateAddress(form))
    if (currentStep === 4 && !form.deliveryPreference) {
      errs.deliveryPreference = 'Please choose a delivery option'
    }
    setStepErrors(errs)
    if (Object.keys(errs).length > 0) return
    setCurrentStep(s => (s + 1) as 1|2|3|4|5)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const goBack = () => {
    setStepErrors({})
    if (currentStep === 3) { setPinConfirmed(false); setMapResult(null) }
    setCurrentStep(s => (s - 1) as 1|2|3|4|5)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleFinalSubmit = async () => {
    setError('')
    const errs: Record<string, string> = {}
    if (!form.agreedToTerms) errs.terms = 'Please agree to the Terms & Conditions to continue.'
    setStepErrors(errs)
    if (Object.keys(errs).length > 0) return

    setLoading(true)
    // A place may have gone since the pin was confirmed — check again before creating the account
    if (!(await canJoinAt(mapResult?.lat, mapResult?.lng))) {
      setLoading(false)
      return goToWaitlist()
    }
    const redirectTo = `${window.location.origin}/auth/callback?next=/dashboard`
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email: form.email, password: form.password,
      options: { emailRedirectTo: redirectTo },
    })
    if (signUpError || !authData.user) {
      setError(signUpError?.message ?? 'Something went wrong. Please try again.')
      setLoading(false)
      return
    }

    const whatsappFull = `${form.whatsappCountryCode}${form.whatsapp.replace(/^0/, '')}`
    const selectedPlanData = PLANS.find(p => p.id === form.planId)
    const res = await fetch('/api/create-household', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: authData.user.id, planLabel: selectedPlanData?.label ?? null,
        first_name: form.firstName, last_name: form.lastName,
        mobile_phone: form.phone, whatsapp_number: whatsappFull,
        community_id: form.community || null, property_type: form.houseType || null,
        building: form.building || null, villa_flat: form.villaFlat || null,
        street: form.street || null, sub_community: form.subCommunity || null,
        area: form.area || null, delivery_preference: form.deliveryPreference || null,
        delivery_notes: form.deliveryNotes || null, safe_spot_description: form.safeSpotDescription || null,
        signup_source_category: form.hearAboutUs || null, signup_source_sub_detail: form.hearDetail || null,
        agreed_to_marketing: form.agreedToMarketing, terms_accepted_at: new Date().toISOString(),
        account_status: 'active',
        latitude: mapResult?.lat ?? null, longitude: mapResult?.lng ?? null,
        signup_zone_id: mapResult?.zoneId ?? null, bonkers_day: mapResult?.bonkersDay ?? null,
        service_status: 'active',
      }),
    })
    const result = await res.json()
    if (res.status === 409 && result.waitlist) {
      setLoading(false)
      return goToWaitlist()
    }
    if (!res.ok) {
      setError(result.error ?? 'Something went wrong saving your details. Please try again.')
      setLoading(false)
      return
    }
    setLoading(false)
    if (authData.session) {
      router.push('/dashboard')
    } else {
      setStep('confirm-email')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const cardInputClass = "w-full border border-[#ddd6cc] rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-300 bg-white text-[#1a2744] font-[var(--font-montserrat)]"
  const labelStyle: React.CSSProperties = { fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 700, fontSize: '0.65rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#1a2f51', marginBottom: '4px', display: 'block' }

  const ContinueButton = ({ onClick, label = 'Continue', navy = false }: { onClick: () => void; label?: string; navy?: boolean }) => (
    <button type="button" onClick={onClick}
      style={{ backgroundImage: navy ? 'none' : 'url(/button2.png)', backgroundSize: '300% 300%', backgroundPosition: 'center', backgroundRepeat: 'no-repeat', backgroundColor: navy ? '#1a2f51' : 'transparent', border: 'none', borderRadius: '999px', padding: '18px 56px', fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 500, fontSize: '0.9rem', letterSpacing: '0.15em', textTransform: 'uppercase', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '10px', minWidth: '220px', justifyContent: 'center', color: 'white' }}>
      {label}
    </button>
  )

  const BackButton = ({ onClick }: { onClick: () => void }) => (
    <button type="button" onClick={onClick}
      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1a2f51', fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '12px' }}>
      ← Back
    </button>
  )

  const SectionHeading = ({ title, subtitle }: { stepNum?: number; title: string; subtitle: string }) => (
    <div style={{ marginBottom: '28px' }}>
      <h1 style={{ fontFamily: 'var(--font-cormorant), serif', color: '#1a2744', fontSize: isTablet ? '2.8rem' : '2rem', fontWeight: 800, lineHeight: 1.05, margin: '0 0 8px' }}>{title}</h1>
      {subtitle && <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#1a2f51', fontSize: '0.9rem', margin: 0 }}>{subtitle}</p>}
    </div>
  )

  return (
    <>
    <main style={{ minHeight: '100svh', position: 'relative', backgroundColor: '#fefaf2' }}>

      {/* Header */}
      <div style={{ padding: isTablet ? '20px 32px 10px' : '16px 20px 8px', position: 'relative', zIndex: 2, lineHeight: 1 }}>
        <p style={{ fontFamily: 'var(--font-amatic)', fontWeight: 700, fontSize: '3rem', color: '#1a2744', letterSpacing: '0.04em', margin: 0 }}>BONKERS</p>
        <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600, fontSize: '0.58rem', color: '#1a2744', letterSpacing: '0.18em', textTransform: 'uppercase', margin: '2px 0 0', lineHeight: 1.4 }}>THE CHILDREN'S LIBRARY</p>
      </div>

      {/* Step progress bar â€" only shown in signup flow */}
      {step === 'signup' && (
        <div style={{ padding: `0 ${isTablet ? '60px' : '16px'}`, maxWidth: isTablet ? '680px' : '440px', margin: `${isTablet ? '64px' : '24px'} auto ${isTablet ? '16px' : '10px'}`, marginLeft: isTablet ? 'auto' : '24px', position: 'relative', zIndex: 2 }}>
          {/* Circles + lines row */}
          <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
            {currentStep < 5 && (
              <img
                src="/book_walking.png"
                alt=""
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: currentStep === 1 ? (isTablet ? '9%' : '11%') : currentStep === 2 ? (isTablet ? '34%' : '36%') : currentStep === 3 ? (isTablet ? '57%' : '59%') : (isTablet ? '80%' : '82%'),
                  transform: 'translate(-15%, -90%)',
                  width: isTablet ? '100px' : '38px',
                  height: 'auto',
                  pointerEvents: 'none',
                  zIndex: 3,
                  transition: 'left 0.4s ease',
                }}
              />
            )}
            {STEP_CONFIG.map((s, i) => (
              <div key={s.num} style={{ display: 'flex', alignItems: 'center', flex: i < 4 ? 1 : 'none' }}>
                <div onClick={currentStep > s.num ? () => setCurrentStep(s.num) : undefined} style={{ width: isTablet ? '42px' : '32px', height: isTablet ? '42px' : '32px', borderRadius: '50%', border: '2px solid #1a2f51', backgroundColor: currentStep >= s.num ? '#1a2f51' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.2s', cursor: currentStep > s.num ? 'pointer' : 'default' }}>
                  {currentStep > s.num ? (
                    <svg width="11" height="9" viewBox="0 0 11 9" fill="none"><path d="M1 4.5L4 7.5L10 1" stroke="#fefaf2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  ) : (
                    <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: isTablet ? '0.85rem' : '0.7rem', fontWeight: 700, color: currentStep === s.num ? '#fefaf2' : '#1a2f51' }}>{s.num}</span>
                  )}
                </div>
                {i < 4 && (
                  <div style={{ flex: 1, height: '3px', backgroundColor: '#1a2f51', opacity: currentStep >= s.num ? 1 : 0.25, minWidth: '24px', transition: 'opacity 0.3s' }} />
                )}
              </div>
            ))}
          </div>
          {/* Labels row */}
          <div style={{ display: 'flex', marginTop: '5px', height: isTablet ? '28px' : '24px' }}>
            {STEP_CONFIG.map((s, i) => (
              <div key={s.num} style={{ display: 'flex', alignItems: 'flex-start', flex: i < 4 ? 1 : 'none' }}>
                <div style={{ width: isTablet ? '42px' : '32px', flexShrink: 0, position: 'relative', height: isTablet ? '28px' : '24px' }}>
                  <span style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: isTablet ? '64px' : '50px', fontFamily: 'var(--font-montserrat), sans-serif', fontSize: isTablet ? '0.6rem' : '0.5rem', fontWeight: currentStep === s.num ? 700 : 400, color: '#1a2f51', textAlign: 'center', whiteSpace: 'normal', letterSpacing: '0.02em', lineHeight: 1.2 }}>{s.label}</span>
                </div>
                {i < 4 && <div style={{ flex: 1 }} />}
              </div>
            ))}
          </div>
        </div>
      )}


      {/* â"€â"€ WAITLIST â"€â"€ */}
      {step === 'waitlist' && (
        <div style={{ maxWidth: '480px', margin: '0 auto', padding: '0 24px 60px', textAlign: 'center' }}>
          <h1 style={{ fontFamily: 'var(--font-cormorant), serif', color: '#1a2f51', fontSize: '2.2rem', fontWeight: 700, lineHeight: 1.1 }}>Memberships in your area are currently full</h1>
          <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#1a2f51', fontSize: '0.9rem', opacity: 0.85, lineHeight: 1.6, margin: '12px 0 24px' }}>We keep Bonkers memberships limited so every family gets a brilliant selection of books and a reliable Bonkers Day. Join the waitlist and we&apos;ll let you know as soon as we increase our capacity. We promise it won&apos;t be long!</p>
          <img src="/map_bonkers.png" alt="" style={{ width: '100%', height: 'auto', marginBottom: '24px' }} />
          {waitlistError && (
            <p style={{ color: '#e05c3a', fontSize: '0.82rem', marginBottom: '12px', fontFamily: 'var(--font-montserrat), sans-serif' }}>{waitlistError}</p>
          )}
          <button type="button" onClick={handleWaitlist} disabled={waitlistLoading}
            style={{ backgroundImage: 'url(/button2.png)', backgroundSize: '300% 300%', backgroundPosition: 'center', backgroundRepeat: 'no-repeat', backgroundColor: 'transparent', border: 'none', borderRadius: '999px', cursor: 'pointer', padding: '14px 32px' }}>
            <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600, fontSize: '0.85rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#fff', whiteSpace: 'nowrap' }}>
              {waitlistLoading ? 'Joining...' : 'Yes, let me know'}
            </span>
          </button>
          <br />
          <button onClick={() => { setMapResult(null); setPinConfirmed(false); setCurrentStep(3); setStep('signup') }} style={{ color: '#1a2f51', opacity: 0.6, fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.85rem', marginTop: '20px', background: 'none', border: 'none', cursor: 'pointer' }}>← Go back</button>
        </div>
      )}

      {/* â"€â"€ WAITLIST DONE â"€â"€ */}
      {step === 'waitlist-done' && (
        <div style={{ maxWidth: '480px', margin: '0 auto', padding: '0 24px 60px', textAlign: 'center' }}>
          <h1 style={{ fontFamily: 'var(--font-cormorant), serif', color: '#1a2f51', fontSize: '2.4rem', fontWeight: 700, lineHeight: 1.1 }}>You&apos;re on the list!</h1>
          <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#1a2f51', fontSize: '0.95rem', opacity: 0.85, lineHeight: 1.6, marginTop: '12px' }}>
            We&apos;ll let you know as soon as we increase our capacity. It shouldn&apos;t be too long!<br /><br />Dramatic sighing is permitted.
          </p>
          <img src="/bonky_waiting.png" alt="" style={{ width: '100%', maxWidth: '260px', height: 'auto', marginTop: '24px' }} />
        </div>
      )}

      {/* â"€â"€ CONFIRM EMAIL â"€â"€ */}
      {step === 'confirm-email' && (
        <div style={{ maxWidth: '480px', margin: '0 auto', padding: '0 24px 60px', textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>ðŸ"¬</div>
          <h1 style={{ fontFamily: 'var(--font-cormorant), serif', color: '#1a2f51', fontSize: '2.4rem', fontWeight: 700, lineHeight: 1.1, margin: '0 0 12px' }}>Check your email!</h1>
          <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#1a2f51', fontSize: '0.9rem', opacity: 0.75, lineHeight: 1.7 }}>
            We&apos;ve sent a confirmation link to <span style={{ color: '#f9d174', fontWeight: 600 }}>{form.email}</span>.
          </p>
          <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#1a2f51', fontSize: '0.85rem', opacity: 0.55, lineHeight: 1.6 }}>
            Click the link to activate your account and you&apos;ll land straight in your Bonkers dashboard. Check your spam folder if it doesn&apos;t arrive within a minute.
          </p>
        </div>
      )}

      {/* â"€â"€ 5-STEP SIGNUP CARD â"€â"€ */}
      {step === 'signup' && (
        <div style={{ padding: isTablet ? '32px 8px 60px' : '6px 0 60px', position: 'relative', zIndex: isTablet ? 2 : currentStep === 3 ? undefined : 2 }}>
          <div style={{ maxWidth: isTablet ? '900px' : '100%', margin: '0 auto', padding: isTablet ? '24px 52px 52px' : '8px 12px 40px', position: 'relative' }}>

            {error && (
              <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: '12px', padding: '12px 16px', fontSize: '0.875rem', marginBottom: '20px', fontFamily: 'var(--font-montserrat), sans-serif' }}>
                {error}
              </div>
            )}

            {/* â"€â"€ STEP 1: YOUR PLAN â"€â"€ */}
            {currentStep === 1 && (
              <div>
                <SectionHeading title="Choose your Bonkers membership" subtitle="" />

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: isTablet ? '16px' : '10px' }}>
                  {PLANS.map((plan) => {
                    const selected = form.planId === plan.id
                    return (
                      <div key={plan.id} onClick={() => set('planId', plan.id)}
                        style={{ width: '100%', backgroundColor: selected ? '#fffef9' : 'transparent', border: `${selected ? '4px' : '2px'} solid ${selected ? '#fee297' : '#e8e0d4'}`, borderRadius: '16px', padding: isTablet ? '20px 16px 24px' : '14px 8px 18px', cursor: 'pointer', textAlign: 'center', position: 'relative', transition: 'all 0.15s', display: 'flex', flexDirection: 'column', justifyContent: 'center', overflow: 'hidden', zoom: 0.9 }}>
                        {plan.badge && (
                          <span style={{ position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)', backgroundColor: '#f5c047', color: '#1a2744', fontSize: isTablet ? '0.62rem' : '0.55rem', fontWeight: 700, padding: '2px 10px', borderRadius: '999px', fontFamily: 'var(--font-montserrat), sans-serif', whiteSpace: 'nowrap', letterSpacing: '0.04em' }}>MOST POPULAR</span>
                        )}
                        <img src={selected ? '/star_yellow.png' : '/star_cream.png'} alt="" style={{ position: 'absolute', bottom: '8px', left: '8px', width: selected ? (isTablet ? '64px' : '32px') : (isTablet ? '46px' : '24px'), height: 'auto', objectFit: 'contain', pointerEvents: 'none' }} />
<p style={{ fontFamily: 'var(--font-cormorant), serif', color: '#1a2744', fontSize: isTablet ? '2rem' : '1.5rem', fontWeight: 700, margin: '0 0 10px', lineHeight: 1 }}>{plan.label}</p>
                        <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#1a2744', fontSize: isTablet ? '1rem' : '0.85rem', fontWeight: 500, margin: '8px 0 12px', lineHeight: 1 }}>{plan.swapBooks} books at a time</p>
                        <div style={{ borderTop: '1px solid #e8e0d4', paddingTop: '12px' }}>
                          <p style={{ fontFamily: 'var(--font-cormorant), serif', color: '#1a2744', fontSize: isTablet ? '2.4rem' : '1.9rem', fontWeight: 800, margin: 0, lineHeight: 1 }}>
                            <span style={{ fontSize: isTablet ? '1.6rem' : '1.3rem', fontWeight: 600 }}>AED </span>{plan.price}
                          </p>
                          <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#1a2744', fontSize: isTablet ? '0.85rem' : '0.75rem', margin: '2px 0 0' }}>/ month</p>
                        </div>
                        <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '5px', alignItems: 'center' }}>
                          {['Weekly deliveries', 'No late fees', 'Cancel anytime'].map(item => (
                            <div key={item} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <svg width="11" height="9" viewBox="0 0 11 9" fill="none"><path d="M1 4.5L4 7.5L10 1" stroke="#1a2f51" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                              <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: isTablet ? '0.85rem' : '0.72rem', color: '#1a2f51', fontWeight: 500 }}>{item}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div style={{ marginTop: '28px', textAlign: 'center' }}>
                  <ContinueButton onClick={validateAndNext} label="Next" navy />
                </div>

              </div>
            )}

            {/* â"€â"€ STEP 2: ABOUT YOU â"€â"€ */}
            {currentStep === 2 && (
              <div>
                <SectionHeading stepNum={2} title="Tell Us About Yourself" subtitle="" />

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={labelStyle}>First Name</label>
                      <input type="text" value={form.firstName} onChange={e => { set('firstName', e.target.value); setStepErrors(p => ({ ...p, firstName: '' })) }} className={cardInputClass} />
                      {stepErrors.firstName && <p style={{ color: '#e05c3a', fontSize: '0.72rem', margin: '4px 0 0', fontFamily: 'var(--font-montserrat), sans-serif' }}>{stepErrors.firstName}</p>}
                    </div>
                    <div>
                      <label style={labelStyle}>Last Name</label>
                      <input type="text" value={form.lastName} onChange={e => { set('lastName', e.target.value); setStepErrors(p => ({ ...p, lastName: '' })) }} className={cardInputClass} />
                      {stepErrors.lastName && <p style={{ color: '#e05c3a', fontSize: '0.72rem', margin: '4px 0 0', fontFamily: 'var(--font-montserrat), sans-serif' }}>{stepErrors.lastName}</p>}
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: isTablet ? '3fr 2fr' : '1fr', gap: '12px' }}>
                    <div>
                      <label style={labelStyle}>Email Address</label>
                      <input type="email" value={form.email} onChange={e => { set('email', e.target.value); setStepErrors(p => ({ ...p, email: '' })) }} className={cardInputClass} />
                      {stepErrors.email && <p style={{ color: '#e05c3a', fontSize: '0.72rem', margin: '4px 0 0', fontFamily: 'var(--font-montserrat), sans-serif' }}>{stepErrors.email}</p>}
                    </div>
                    <div>
                      <label style={labelStyle}>Password</label>
                      <div style={{ position: 'relative' }}>
                        <input type={showPassword ? 'text' : 'password'} value={form.password} onChange={e => { set('password', e.target.value); setStepErrors(p => ({ ...p, password: '' })) }} className={cardInputClass} style={{ paddingRight: '64px' }} />
                        <button type="button" onClick={() => setShowPassword(v => !v)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#1a2f51', display: 'flex', alignItems: 'center' }}>
                          {showPassword ? (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                          ) : (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                          )}
                        </button>
                      </div>
                      {stepErrors.password && <p style={{ color: '#e05c3a', fontSize: '0.72rem', margin: '4px 0 0', fontFamily: 'var(--font-montserrat), sans-serif' }}>{stepErrors.password}</p>}
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: isTablet ? '1fr 1fr' : '1fr', gap: '12px' }}>
                  <div>
                    <label style={labelStyle}>Mobile Number</label>
                    <input type="tel" placeholder="05XXXXXXXX" value={form.phone} onChange={e => { set('phone', e.target.value); set('whatsapp', e.target.value); setStepErrors(p => ({ ...p, phone: '' })) }} className={cardInputClass} />
                    {stepErrors.phone && <p style={{ color: '#e05c3a', fontSize: '0.72rem', margin: '4px 0 0', fontFamily: 'var(--font-montserrat), sans-serif' }}>{stepErrors.phone}</p>}
                  </div>
                  <div>
                    <label style={labelStyle}>WhatsApp Number <span style={{ textTransform: 'none', fontWeight: 400, opacity: 0.6 }}>(if different)</span></label>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'stretch' }}>
                      <div ref={countryDropdownRef} style={{ position: 'relative', width: '120px', flexShrink: 0 }}>
                        <button type="button" onClick={() => { setCountryDropdownOpen(o => !o); setCountrySearch('') }} className={cardInputClass}
                          style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', padding: '0 8px' }}>
                          <span style={{ fontSize: '0.82rem' }}>{COUNTRY_CODES.find(c => c.code === form.whatsappCountryCode)?.label ?? form.whatsappCountryCode}</span>
                          <svg width="10" height="6" viewBox="0 0 12 8" fill="none" style={{ flexShrink: 0, transform: countryDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}><path d="M1 1L6 7L11 1" stroke="#888" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </button>
                        {countryDropdownOpen && (
                          <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, backgroundColor: 'white', border: '1px solid #ddd6cc', borderRadius: '12px', zIndex: 50, overflow: 'hidden', boxShadow: '0 4px 16px rgba(0,0,0,0.12)' }}>
                            <input type="text" placeholder="Search..." value={countrySearch} onChange={e => setCountrySearch(e.target.value)} autoFocus
                              style={{ width: '100%', padding: '10px 12px', border: 'none', borderBottom: '1px solid #e5e7eb', outline: 'none', fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.8rem', color: '#1a1a1a', boxSizing: 'border-box' }} />
                            <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                              {COUNTRY_CODES.filter(c => c.label.toLowerCase().includes(countrySearch.toLowerCase()) || c.code.includes(countrySearch)).map(c => (
                                <button key={c.label} type="button" onClick={() => { set('whatsappCountryCode', c.code); setCountryDropdownOpen(false); setCountrySearch('') }}
                                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px', fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.82rem', color: '#1a1a1a', background: form.whatsappCountryCode === c.code ? '#fdf3e8' : 'transparent', border: 'none', cursor: 'pointer' }}>
                                  {c.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      <input type="tel" placeholder="e.g. 501234567" value={form.whatsapp} onChange={e => set('whatsapp', e.target.value)} className={cardInputClass} style={{ flex: 1 }} />
                    </div>
                  </div>
                  </div>
                </div>

                <div style={{ marginTop: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <ContinueButton onClick={validateAndNext} label="Next" navy />
                  <BackButton onClick={goBack} />
                </div>
              </div>
            )}

            {/* â"€â"€ STEP 3: DELIVERY DETAILS â"€â"€ */}
            {currentStep === 3 && (
              <div>
                {/* Above image on mobile */}
                <div style={{ position: isTablet ? undefined : 'relative', zIndex: isTablet ? undefined : 4 }}>
                  <SectionHeading stepNum={3} title="Your Delivery Details" subtitle="" />

                  {/* Map pin */}
                  {/* Phase 1: map + confirm */}
                  <div style={{ marginBottom: pinConfirmed ? '24px' : '0' }}>
                    <label style={labelStyle}>Pin your home on the map</label>
                    <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.8rem', color: '#1a2f51', opacity: 0.65, margin: '0 0 10px' }}>
                      Drag the pin to your exact door, tap the map, or search to move it.
                    </p>
                    <SignupMap zones={zones} onProceed={handleMapProceed} />

                    {!pinConfirmed && (
                      <div style={{ marginTop: '12px' }}>
                        {stepErrors.mapPin && (
                          <p style={{ color: '#e05c3a', fontSize: '0.82rem', marginBottom: '10px', fontFamily: 'var(--font-montserrat), sans-serif', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                            {stepErrors.mapPin}
                          </p>
                        )}
                        <button
                          type="button"
                          disabled={!canConfirmPin || checkingPin}
                          onClick={confirmPin}
                          style={{ width: '100%', padding: '14px', borderRadius: '12px', border: 'none', backgroundColor: canConfirmPin ? '#1a2744' : '#ddd6cc', color: canConfirmPin ? '#fefaf2' : '#aaa', fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 700, fontSize: '0.88rem', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: canConfirmPin ? 'pointer' : 'not-allowed', transition: 'background-color 0.2s' }}
                        >
                          {checkingPin ? 'Checking…' : mapResult ? 'Confirm location' : 'Waiting for pin…'}
                        </button>
                      </div>
                    )}

                    {pinConfirmed && (
                      <button
                        type="button"
                        onClick={() => setPinConfirmed(false)}
                        style={{ marginTop: '8px', background: 'none', border: 'none', fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.78rem', color: '#54bdc0', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
                      >
                        ← Move pin
                      </button>
                    )}
                  </div>

                  {/* Phase 2: address fields — shown only after pin confirmed */}
                  {pinConfirmed && (
                    <>
                      <AddressFields
                        value={{ houseType: form.houseType, villaFlat: form.villaFlat, building: form.building, street: form.street, subCommunity: form.subCommunity, area: form.area }}
                        onChange={(field, value) => { set(field, value); setStepErrors(p => ({ ...p, [field]: '' })) }}
                        errors={stepErrors} inputClass={cardInputClass} labelStyle={labelStyle}
                      />
                    </>
                  )}
                </div>

                {/* Delivery notes — only after pin confirmed */}
                {pinConfirmed && (
                  <div style={{ marginTop: '24px' }}>
                    <label style={labelStyle}>Delivery Notes <span style={{ textTransform: 'none', fontWeight: 400, opacity: 0.6 }}>(optional)</span></label>
                    <input type="text" placeholder="e.g. gate code, beware tiny ferocious dog..." value={form.deliveryNotes} onChange={e => set('deliveryNotes', e.target.value)} className={cardInputClass} />
                  </div>
                )}

                {/* Next/Back — only after pin confirmed */}
                {pinConfirmed && (
                  <div style={{ position: isTablet ? undefined : 'relative', zIndex: isTablet ? undefined : 4 }}>
                    <div style={{ marginTop: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <ContinueButton onClick={validateAndNext} label="Next" navy />
                      <BackButton onClick={goBack} />
                    </div>
                  </div>
                )}

                {/* Back only — before pin confirmed */}
                {!pinConfirmed && (
                  <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'center' }}>
                    <BackButton onClick={goBack} />
                  </div>
                )}
              </div>
            )}

            {/* â"€â"€ STEP 4: HOW TO DELIVER â"€â"€ */}
            {currentStep === 4 && (
              <div>
                <SectionHeading stepNum={4} title={'How should we deliver?'} subtitle={'Tell us your preference.'} />

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  {[
                    { value: 'leave_at_door', label: 'At the door', sub: 'Contactless' },
                    { value: 'leave_safe_spot', label: 'Safe spot', sub: 'Contactless' },
                    { value: 'ring_bell', label: 'Ring the bell', sub: "Someone's home" },
                    { value: 'call_no_bell', label: 'Call me', sub: "Don't ring bell" },
                    { value: 'leave_with_reception', label: 'Reception', sub: 'Concierge' },
                  ].map(opt => (
                    <button key={opt.value} type="button" onClick={() => { set('deliveryPreference', opt.value); setStepErrors(p => ({ ...p, deliveryPreference: '' })) }}
                      style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '10px', textAlign: 'left', padding: '14px 16px', borderRadius: '14px', border: (form.deliveryPreference === opt.value ? '4px solid #fee297' : '2px solid #e8e0d4'), backgroundColor: form.deliveryPreference === opt.value ? '#fffef9' : 'transparent', cursor: 'pointer', transition: 'all 0.15s' }}>
                      <img src={form.deliveryPreference === opt.value ? '/star_yellow.png' : '/star_cream.png'} alt="" style={{ width: form.deliveryPreference === opt.value ? '32px' : '28px', height: form.deliveryPreference === opt.value ? '32px' : '28px', objectFit: 'contain', flexShrink: 0 }} />
                      <div>
                        <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#1a2744', fontSize: '0.85rem', fontWeight: 600, display: 'block' }}>{opt.label}</span>
                        <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#1a2f51', fontSize: '0.72rem', display: 'block', marginTop: '1px' }}>{opt.sub}</span>
                      </div>
                    </button>
                  ))}
                </div>

                {stepErrors.deliveryPreference && <p style={{ color: '#e05c3a', fontSize: '0.78rem', marginTop: '8px', fontFamily: 'var(--font-montserrat), sans-serif' }}>{stepErrors.deliveryPreference}</p>}

                {form.deliveryPreference === 'leave_safe_spot' && (
                  <div style={{ marginTop: '14px' }}>
                    <label style={labelStyle}>Describe the safe spot</label>
                    <input type="text" placeholder="e.g. behind the gate, under the mat..." value={form.safeSpotDescription} onChange={e => set('safeSpotDescription', e.target.value)} className={cardInputClass} />
                  </div>
                )}

                <div style={{ marginTop: '24px' }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.agreedToMarketing} onChange={e => set('agreedToMarketing', e.target.checked)} style={{ marginTop: '3px', accentColor: '#e05c3a', width: '16px', height: '16px', flexShrink: 0 }} />
                    <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.82rem', color: '#1a2f51', lineHeight: 1.5 }}>
                      Send me Bonkers news, book recommendations and other brilliant nonsense. <span style={{ opacity: 0.55 }}>(optional)</span>
                    </span>
                  </label>
                </div>

                <div style={{ marginTop: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <ContinueButton onClick={validateAndNext} label="Next" navy />
                  <BackButton onClick={goBack} />
                </div>
              </div>
            )}


            {/* â"€â"€ STEP 5: PAYMENT â"€â"€ */}
            {currentStep === 5 && (
              <div style={{ position: 'relative', zIndex: 1 }}>
                <SectionHeading stepNum={5} title="Almost done!" subtitle="Complete your membership." />

                {/* How did you hear */}
                <div style={{ marginBottom: '24px' }}>
                  <label style={{ ...labelStyle, marginBottom: '10px', fontSize: isTablet ? '0.65rem' : '13px' }}>How did you hear about Bonkers?</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                    {HOW_OPTIONS.map(opt => {
                      const selected = form.hearAboutUs === opt.value
                      return (
                        <button key={opt.value} type="button"
                          onClick={() => { set('hearAboutUs', opt.value); set('hearDetail', '') }}
                          style={{ display: 'inline-flex', flexDirection: 'row', alignItems: 'center', padding: isTablet ? '12px 16px' : '6px 10px', borderRadius: '14px', border: selected ? '4px solid #1a2f51' : '2px solid #e8e0d4', backgroundColor: selected ? '#1a2f51' : 'transparent', cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'var(--font-montserrat), sans-serif', fontSize: isTablet ? '20px' : '11px', fontWeight: selected ? 600 : 400, color: selected ? '#fefaf2' : '#1a2744', whiteSpace: 'nowrap' }}>
                          {opt.label}
                        </button>
                      )
                    })}
                  </div>
                  {selectedHowOption?.followUp && (
                    <div style={{ marginTop: '10px' }}>
                      <input type="text" placeholder={selectedHowOption.followUp} value={form.hearDetail} onChange={e => set('hearDetail', e.target.value)} className={cardInputClass} />
                    </div>
                  )}
                </div>

                <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.78rem', color: '#1a2f51', margin: '0 0 16px' }}>Your membership renews monthly. Cancel anytime.</p>

                {/* Terms */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.agreedToTerms} onChange={e => { set('agreedToTerms', e.target.checked); setStepErrors(p => ({ ...p, terms: '' })) }} style={{ marginTop: '2px', accentColor: '#e05c3a', width: '16px', height: '16px', flexShrink: 0 }} />
                    <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.82rem', color: '#1a2f51', lineHeight: 1.5 }}>
                      I agree to the Bonkers{' '}
                      <span style={{ color: '#3b82f6', textDecoration: 'underline', cursor: 'pointer' }}>Membership Rules</span>,{' '}
                      <span style={{ color: '#3b82f6', textDecoration: 'underline', cursor: 'pointer' }}>Terms &amp; Conditions</span>{' '}and{' '}
                      <span style={{ color: '#3b82f6', textDecoration: 'underline', cursor: 'pointer' }}>Privacy Policy</span>.
                    </span>
                  </label>
                  {stepErrors.terms && <p style={{ color: '#e05c3a', fontSize: '0.78rem', margin: '-4px 0 0 28px', fontFamily: 'var(--font-montserrat), sans-serif' }}>{stepErrors.terms}</p>}
                </div>

                {/* Submit */}
                <div style={{ marginTop: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <button type="button" onClick={handleFinalSubmit} disabled={loading}
                    style={{ backgroundColor: loading ? '#ccc' : '#1a2f51', color: 'white', border: 'none', borderRadius: '999px', padding: '18px 56px', fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 700, fontSize: '0.9rem', letterSpacing: '0.15em', textTransform: 'uppercase', cursor: loading ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: '10px', minWidth: '220px', justifyContent: 'center', transition: 'background-color 0.2s' }}>
                    {loading ? 'Setting up...' : <>Join Bonkers <img src="/magicwand.png" alt="" style={{ height: '18px', width: 'auto' }} /></>}
                  </button>
                  <BackButton onClick={goBack} />
                </div>
                </div>
            )}

          </div>
        </div>
      )}

    </main>
  </>
  )
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  )
}
