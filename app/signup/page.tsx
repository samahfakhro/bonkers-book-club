﻿﻿﻿﻿﻿'use client'

import { useState, useEffect, useRef } from 'react'
import confetti from 'canvas-confetti'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Suspense } from 'react'

const PLANS = [
  { id: 'starter', label: 'A Little Bonkers', price: 149, badge: null, books: 8, swapBooks: 2, perBook: '18', weeklyNote: 'Up to 2 books each week' },
  { id: 'mid', label: 'Quite Bonkers', price: 199, badge: 'MOST POPULAR', books: 16, swapBooks: 4, perBook: '12', weeklyNote: 'Up to 4 books each week' },
  { id: 'full', label: 'Absolutely Bonkers', price: 249, badge: null, books: 24, swapBooks: 6, perBook: '10', weeklyNote: 'Up to 6 books each week' },
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
  { value: 'friend', label: 'A friend or family member', followUp: null },
  { value: 'instagram', label: 'Instagram', followUp: null },
  { value: 'school', label: "My child's school", followUp: 'Which school?' },
  { value: 'influencer', label: 'An influencer or blogger', followUp: 'Who was it?' },
  { value: 'flyer', label: 'Flyer or poster', followUp: null },
  { value: 'google', label: 'Google search', followUp: null },
  { value: 'other', label: 'Other', followUp: 'Tell us more' },
]

type CheckStep = 'check' | 'waitlist' | 'waitlist-done' | 'signup' | 'confirm-email'

type Community = {
  id: string
  name: string
  accepted_property_types: string[]
}

function SignupForm() {
  const router = useRouter()
  const params = useSearchParams()
  const communityParam = params.get('community') || ''
  const typeParam = params.get('type') || ''

  const [step, setStep] = useState<CheckStep>(
    communityParam && typeParam ? 'signup' : 'check'
  )
  const [communities, setCommunities] = useState<Community[]>([])
  const [checkForm, setCheckForm] = useState({
    communityId: communityParam,
    communityName: '',
    propertyType: typeParam,
  })
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const signupRef = useRef<HTMLDivElement>(null)

  const [checkError, setCheckError] = useState('')
  const [waitlistForm, setWaitlistForm] = useState({ name: '', email: '' })
  const [waitlistLoading, setWaitlistLoading] = useState(false)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [showPassword, setShowPassword] = useState(false)
  const [isTablet, setIsTablet] = useState(false)
  useEffect(() => {
    const check = () => setIsTablet(window.innerWidth >= 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  const [countrySearch, setCountrySearch] = useState('')
  const [countryDropdownOpen, setCountryDropdownOpen] = useState(false)
  const countryDropdownRef = useRef<HTMLDivElement>(null)

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    whatsapp: '',
    whatsappCountryCode: '+971',
    email: '',
    password: '',
    villaFlat: '',
    building: '',
    floor: '',
    street: '',
    subCommunity: '',
    area: '',
    community: communityParam,
    houseType: typeParam,
    city: 'Dubai',
    planId: 'mid',
    deliveryPreference: '',
    hearAboutUs: '',
    hearDetail: '',
    agreedToTerms: false,
    agreedToMarketing: false,
    deliveryNotes: '',
    safeSpotDescription: '',
  })

  const set = (field: string, value: unknown) => setForm(f => ({ ...f, [field]: value }))

  const selectedPlan = PLANS.find(p => p.id === form.planId)!
  const selectedHowOption = HOW_OPTIONS.find(o => o.value === form.hearAboutUs)

  useEffect(() => {
    supabase.from('communities').select('id, name, accepted_property_types').eq('is_active', true).order('name')
      .then(({ data }) => {
        if (data) {
          setCommunities(data)
          if (communityParam) {
            const found = data.find(c => c.id === communityParam)
            if (found) setCheckForm(f => ({ ...f, communityName: found.name }))
          }
        }
      })
  }, [])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
      if (countryDropdownRef.current && !countryDropdownRef.current.contains(e.target as Node)) {
        setCountryDropdownOpen(false)
        setCountrySearch('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleCheck = () => {
    if (!checkForm.communityId) { setCheckError('Please select your community.'); return }
    if (!checkForm.propertyType) { setCheckError('Please select your home type.'); return }
    setCheckError('')
    const community = communities.find(c => c.id === checkForm.communityId)
    if (!community) return
    const acceptedTypes = community.accepted_property_types || []
    if (acceptedTypes.includes(checkForm.propertyType)) {
      setForm(f => ({ ...f, community: checkForm.communityId, houseType: checkForm.propertyType }))
      setStep('signup')
      const colors = ['#f06595', '#cc5de8', '#74c0fc', '#f9ce71', '#e599f7', '#66d9e8', '#ffd43b', '#f783ac']
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.5 }, colors })
    } else {
      setWaitlistForm({ name: '', email: '' })
      setStep('waitlist')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const handleWaitlist = async (e: React.FormEvent) => {
    e.preventDefault()
    setWaitlistLoading(true)
    await supabase.from('waitlist_signup').insert({
      email: waitlistForm.email,
      name: waitlistForm.name,
      community_name: checkForm.communityName,
      property_type: checkForm.propertyType,
      interest_level: 3,
      phone: null,
      address: null,
      children_count: null,
      children_ages: null,
    })
    setWaitlistLoading(false)
    setStep('waitlist-done')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const errors: Record<string, string> = {}
    const phoneDigits = form.phone.replace(/\s/g, '')
    if (!/^05\d{8}$/.test(phoneDigits)) errors.phone = 'Please enter a valid UAE mobile number (05XXXXXXXX).'
    if (form.password.length < 8) errors.password = 'Password must be at least 8 characters.'
    if (!form.agreedToTerms) errors.terms = 'Please agree to the Terms & Conditions to continue.'

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      const firstKey = Object.keys(errors)[0]
      document.getElementById(`field-${firstKey}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    setFieldErrors({})
    setLoading(true)

    const redirectTo = `${window.location.origin}/auth/callback?next=/dashboard`

    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { emailRedirectTo: redirectTo },
    })

    if (signUpError || !authData.user) {
      setError(signUpError?.message ?? 'Something went wrong. Please try again.')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      setLoading(false)
      return
    }

    const whatsappFull = `${form.whatsappCountryCode}${form.whatsapp.replace(/^0/, '')}`
    const selectedPlanData = PLANS.find(p => p.id === form.planId)

    const res = await fetch('/api/create-household', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: authData.user.id,
        planLabel: selectedPlanData?.label ?? null,
        first_name: form.firstName,
        last_name: form.lastName,
        mobile_phone: form.phone,
        whatsapp_number: whatsappFull,
        community_id: form.community || null,
        property_type: form.houseType || null,
        building: form.building || null,
        floor: form.floor || null,
        street: form.street || null,
        sub_community: form.subCommunity || null,
        area: form.area || null,
        delivery_preference: form.deliveryPreference || null,
        delivery_notes: form.deliveryNotes || null,
        safe_spot_description: form.safeSpotDescription || null,
        signup_source_category: form.hearAboutUs || null,
        signup_source_sub_detail: form.hearDetail || null,
        agreed_to_marketing: form.agreedToMarketing,
        terms_accepted_at: new Date().toISOString(),
        account_status: 'active',
      }),
    })

    const result = await res.json()

    if (!res.ok) {
      setError(result.error ?? 'Something went wrong saving your details. Please try again.')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      setLoading(false)
      return
    }

    setLoading(false)

    // If email confirmation is disabled, session is available immediately
    if (authData.session) {
      router.push('/dashboard')
    } else {
      // Email confirmation required — show check-your-email screen
      setStep('confirm-email')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const inputClass = "w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-amber-400 bg-[#fcf7eb] text-[#1a0a00]"

  return (
    <main className="min-h-screen" style={{ position: 'relative', backgroundColor: '#080402', backgroundImage: 'url(/Background_3.png)', backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' }}>
      <div style={{ position: 'absolute', top: '20px', left: '20px', lineHeight: 1 }}>
        <p style={{ fontFamily: 'var(--font-amatic)', fontWeight: 700, fontSize: '3rem', color: '#eddbc3', letterSpacing: '0.04em', margin: 0 }}>BONKERS</p>
        <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600, fontSize: '0.5rem', color: '#eddbc3', letterSpacing: '0.18em', textTransform: 'uppercase', margin: '2px 0 0' }}>
          THE CHILDREN'S LIBRARY
        </p>
      </div>
      <div className="mx-auto" style={{ paddingTop: '120px', paddingBottom: '40px', paddingLeft: isTablet ? '44px' : '16px', paddingRight: isTablet ? '44px' : '16px' }}>

        {/* â"€â"€ CHECK STEP â"€â"€ */}
        {(step === 'check' || step === 'signup') && (
          <div className="flex flex-col items-center text-center w-full pb-6" style={{ maxWidth: isTablet ? '100%' : '480px', margin: '0 auto' }}>
            {step === 'signup' ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ position: 'relative', width: '360px', marginTop: '-40px' }}>
                  <img src="/bonky_sign.png" alt="" style={{ width: '100%', height: 'auto', display: 'block' }} />
                  <div style={{ position: 'absolute', top: '46%', left: '51%', transform: 'translateX(-50%)', width: '54%', height: '22%', overflow: 'hidden', textAlign: 'center' }}>
                    <p style={{ position: 'absolute', top: '8px', left: 0, right: 0, fontFamily: 'var(--font-amatic)', fontWeight: 700, fontSize: '1.25rem', color: '#080402', margin: 0, lineHeight: 1.2, letterSpacing: '0.02em' }}>We deliver to</p>
                    <p style={{ position: 'absolute', top: '36px', left: 0, right: 0, fontFamily: 'var(--font-amatic)', fontWeight: 700, fontSize: '1.15rem', color: '#080402', margin: 0, lineHeight: 1.1, letterSpacing: '0.02em', wordBreak: 'break-word' }}>{checkForm.communityName}</p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '24px' }}>
                  <img src="/whiskers_left.png" alt="" style={{ height: '28px', width: 'auto', pointerEvents: 'none' }} />
                  <p style={{ fontFamily: 'var(--font-amatic)', fontWeight: 700, color: '#eddbc3', fontSize: '1.8rem', letterSpacing: '0.04em', margin: 0, lineHeight: 1 }}>Just a few details</p>
                  <img src="/whiskers_right.png" alt="" style={{ height: '28px', width: 'auto', pointerEvents: 'none' }} />
                </div>
                <h2 style={{ fontFamily: 'var(--font-cormorant), serif', color: '#eddbc3', fontSize: 'clamp(2.4rem, 8vw, 3.5rem)', fontWeight: 700, lineHeight: 1.1, margin: '8px 0 0', textAlign: 'center' }}>
                  Let&apos;s get you started.
                </h2>
                <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#eddbc3', fontSize: '0.78rem', opacity: 0.7, margin: '10px 0 0', textAlign: 'center' }}>
                  Create your account and choose a plan below.
                </p>
              </div>
            ) : (
              <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '4px' }}>
              <img src="/whiskers_left.png" alt="" style={{ height: '32px', width: 'auto', pointerEvents: 'none' }} />
              <p style={{ fontFamily: 'var(--font-amatic)', fontWeight: 700, color: '#eddbc3', fontSize: '1.8rem', letterSpacing: '0.04em', margin: 0, lineHeight: 1 }}>
                First things first!
              </p>
              <img src="/whiskers_right.png" alt="" style={{ height: '32px', width: 'auto', pointerEvents: 'none' }} />
            </div>
            <h2 className="font-black mb-2" style={{ fontFamily: 'var(--font-cormorant), serif', color: '#eddbc3', fontSize: '2.4rem', lineHeight: '1.1', marginTop: isTablet ? '48px' : '12px' }}>
              Do we deliver to your neighbourhood?
            </h2>


            {/* Community dropdown */}
            <div ref={dropdownRef} style={{ position: 'relative', width: isTablet ? '55%' : '85%', marginBottom: '8px', marginTop: isTablet ? '100px' : '56px' }}>
              <img src="/bonky_peeking.png" alt="" style={{ position: 'absolute', top: isTablet ? '-72px' : '-40px', left: '50%', transform: 'translateX(-50%)', height: isTablet ? '88px' : '50px', width: 'auto', zIndex: 10, pointerEvents: 'none' }} />
              <button type="button" onClick={() => setDropdownOpen(o => !o)}
                style={{ width: '100%', backgroundColor: '#fcf7eb', border: 'none', borderRadius: '12px', fontFamily: 'var(--font-nunito), sans-serif', fontSize: '1.1rem', cursor: 'pointer', textAlign: 'center', padding: isTablet ? '14px 2rem 14px 1rem' : '14px 2.5rem 14px 1rem', color: checkForm.communityId ? '#1a1a1a' : '#3d3d3d', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {checkForm.communityName || 'Select your community...'}
                <svg style={{ position: 'absolute', right: '1rem', top: '50%', transform: dropdownOpen ? 'translateY(-50%) rotate(180deg)' : 'translateY(-50%)', transition: 'transform 0.2s', pointerEvents: 'none' }} width="12" height="8" viewBox="0 0 12 8" fill="none"><path d="M1 1L6 7L11 1" stroke="#555" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              {dropdownOpen && (
                <div style={{ position: 'absolute', top: '100%', left: '0', right: '0', backgroundColor: '#fcf7eb', borderRadius: '12px', zIndex: 50, marginTop: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                  <div onClick={() => { setCheckForm(f => ({ ...f, communityId: '', communityName: '', propertyType: '' })); setDropdownOpen(false) }}
                    style={{ padding: '12px 20px', fontFamily: 'var(--font-nunito), sans-serif', fontSize: '1.1rem', cursor: 'pointer', borderBottom: '1px solid rgba(0,0,0,0.08)', color: '#3d3d3d' }}
                    className="hover:bg-[#fcf7eb] transition-colors">
                    Select your community...
                  </div>
                  {communities.map(c => (
                    <div key={c.id}
                      onClick={() => { setCheckForm(f => ({ ...f, communityId: c.id, communityName: c.name })); setDropdownOpen(false) }}
                      style={{ padding: '12px 20px', fontFamily: 'var(--font-nunito), sans-serif', fontSize: '1.1rem', cursor: 'pointer', borderBottom: '1px solid rgba(0,0,0,0.08)', color: '#1a1a1a' }}
                      className="hover:bg-[#fcf7eb] transition-colors">
                      {c.name}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* Property type */}
            <label style={{ fontFamily: 'var(--font-cormorant), serif', color: '#eddbc3', fontSize: '1.5rem', marginBottom: '8px', marginTop: isTablet ? '60px' : '20px' }}>
              And your home type?
            </label>
            <div style={{ display: 'flex', flexDirection: 'row', gap: '10px', width: isTablet ? '40%' : '80%', marginBottom: '32px', marginTop: isTablet ? '24px' : '10px' }}>
              {[{ value: 'villa', label: 'Villa', img: '/villa.png' }, { value: 'apartment', label: 'Apartment', img: '/apartment.png' }].map(opt => (
                <button key={opt.value} type="button"
                  onClick={() => setCheckForm(f => ({ ...f, propertyType: opt.value }))}
                  style={{ background: 'transparent', border: `1.5px solid ${checkForm.propertyType === opt.value ? '#f9ce71' : 'rgba(237,219,195,0.3)'}`, borderRadius: '12px', cursor: 'pointer', padding: '10px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', flex: 1, transition: 'border-color 0.15s' }}>
                  <div style={{ height: isTablet ? '100px' : '60px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <img src={opt.img} alt={opt.label} style={{ width: isTablet ? '90px' : '52px', height: isTablet ? '90px' : '52px', objectFit: 'contain' }} />
                  </div>
                  <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#eddbc3', fontSize: '0.78rem', fontWeight: 700, margin: 0, lineHeight: 1.2 }}>{opt.label}</p>
                </button>
              ))}
            </div>

            {/* Check button */}
            {(() => {
              const disabled = !checkForm.communityId || !checkForm.propertyType
              return (
                <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginTop: isTablet ? '60px' : '20px', opacity: disabled ? 0.4 : 1, transition: 'opacity 0.2s' }}>
                  <img src="/whiskers_left.png" alt="" style={{ position: 'absolute', left: '-36px', height: '48px', width: 'auto', zIndex: 1, pointerEvents: 'none', filter: 'brightness(0) saturate(100%) invert(87%) sepia(33%) saturate(762%) hue-rotate(339deg) brightness(103%) contrast(98%)' }} />
                  <button type="button" onClick={handleCheck} disabled={disabled}
                    style={{ backgroundImage: 'url(/button2.png)', backgroundSize: '300% 300%', backgroundPosition: 'center', backgroundRepeat: 'no-repeat', backgroundColor: 'transparent', border: 'none', borderRadius: '999px', cursor: disabled ? 'not-allowed' : 'pointer', padding: '14px 32px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600, fontSize: '0.85rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      Check Area
                      <img src="/magicwand.png" alt="" style={{ height: '18px', width: 'auto' }} />
                    </span>
                  </button>
                  <img src="/whiskers_right.png" alt="" style={{ position: 'absolute', right: '-36px', height: '48px', width: 'auto', zIndex: 1, pointerEvents: 'none', filter: 'brightness(0) saturate(100%) invert(87%) sepia(33%) saturate(762%) hue-rotate(339deg) brightness(103%) contrast(98%)' }} />
                </div>
              )
            })()}
            <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.9rem', color: '#eddbc3', marginTop: '20px', opacity: 0.8 }}>
              Can&apos;t find your community?<br />
              <button type="button" onClick={() => setStep('waitlist')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#eddbc3', textDecoration: 'none', fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.9rem', padding: 0 }}>
                <span style={{ borderBottom: '2px solid #f9ce71', paddingBottom: '1px' }}>Join our waitlist</span>
              </button>
            </p>
              </>
            )}
          </div>
        )}

        {/* â"€â"€ WAITLIST STEP â"€â"€ */}
        {step === 'waitlist' && (
          <div className="flex flex-col items-center text-center w-full pb-6" style={{ maxWidth: isTablet ? '100%' : '480px', margin: '0 auto' }}>
            <h1 className="font-black mb-2" style={{ fontFamily: 'var(--font-cormorant), serif', color: '#eddbc3', fontSize: '2.2rem', lineHeight: '1.1', marginTop: '-16px' }}>
              Bonkers hasn&apos;t reached your area...<span style={{ color: '#ebb34d' }}>yet!</span>
            </h1>
            <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#eddbc3', fontSize: '0.95rem', opacity: 0.85, marginTop: '12px', marginBottom: '28px', lineHeight: 1.6 }}>
              Our map grows a little bigger every month. Leave your details and we&apos;ll let you know the moment Bonkers arrives in your neighbourhood.
            </p>

            <img src="/map_bonkers.png" alt="" className="w-full h-auto" style={{ marginBottom: '28px' }} />

            <form onSubmit={handleWaitlist} className="flex flex-col gap-4 w-full" style={{ maxWidth: '360px', textAlign: 'left' }}>
              <div className="flex flex-col gap-1">
                <label style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600, fontSize: '0.7rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#eddbc3' }}>Your Name</label>
                <input type="text" placeholder=""
                  value={waitlistForm.name}
                  onChange={e => setWaitlistForm(f => ({ ...f, name: e.target.value }))}
                  className={inputClass} />
              </div>
              <div className="flex flex-col gap-1">
                <label style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600, fontSize: '0.7rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#eddbc3' }}>Email Address</label>
                <input type="email" required placeholder=""
                  value={waitlistForm.email}
                  onChange={e => setWaitlistForm(f => ({ ...f, email: e.target.value }))}
                  className={inputClass} />
              </div>

              <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginTop: '8px', opacity: waitlistLoading ? 0.7 : 1, transition: 'opacity 0.2s' }}>
                <img src="/whiskers_left.png" alt="" style={{ position: 'absolute', left: '-36px', height: '48px', width: 'auto', zIndex: 1, pointerEvents: 'none', filter: 'brightness(0) saturate(100%) invert(87%) sepia(33%) saturate(762%) hue-rotate(339deg) brightness(103%) contrast(98%)' }} />
                <button type="submit" disabled={waitlistLoading}
                  style={{ backgroundImage: 'url(/button2.png)', backgroundSize: '300% 300%', backgroundPosition: 'center', backgroundRepeat: 'no-repeat', backgroundColor: 'transparent', border: 'none', borderRadius: '999px', cursor: waitlistLoading ? 'not-allowed' : 'pointer', padding: '14px 32px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600, fontSize: '0.85rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#fff', whiteSpace: 'nowrap' }}>
                    {waitlistLoading ? 'Joining...' : 'Join the Waitlist'}
                  </span>
                </button>
                <img src="/whiskers_right.png" alt="" style={{ position: 'absolute', right: '-36px', height: '48px', width: 'auto', zIndex: 1, pointerEvents: 'none', filter: 'brightness(0) saturate(100%) invert(87%) sepia(33%) saturate(762%) hue-rotate(339deg) brightness(103%) contrast(98%)' }} />
              </div>
            </form>

            <button onClick={() => { setStep('check'); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
              style={{ color: '#eddbc3', opacity: 0.6, fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.85rem', marginTop: '24px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
              
←
 Go back
            </button>
          </div>
        )}

        {/* â"€â"€ WAITLIST DONE â"€â"€ */}
        {step === 'waitlist-done' && (
          <div className="flex flex-col items-center text-center w-full pb-6" style={{ maxWidth: isTablet ? '100%' : '480px', margin: '0 auto' }}>
            <h1 className="font-black mb-4" style={{ fontFamily: 'var(--font-cormorant), serif', color: '#eddbc3', fontSize: '2.4rem', lineHeight: '1.1', marginTop: '-16px' }}>
              You&apos;re on the list!
            </h1>
            <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#eddbc3', fontSize: '0.95rem', opacity: 0.85, lineHeight: 1.6 }}>
              We&apos;ll let you know the moment Bonkers lands in your area. Please wait patiently.<br /><br />Or impatiently. Dramatic sighing is permitted.
            </p>
            <img src="/bonky_waiting.png" alt="" style={{ width: '100%', maxWidth: '260px', height: 'auto', marginTop: '24px', pointerEvents: 'none' }} />
          </div>
        )}

        {/* ── CONFIRM EMAIL ── */}
        {step === 'confirm-email' && (
          <div className="flex flex-col items-center text-center w-full pb-6" style={{ maxWidth: isTablet ? '100%' : '480px', margin: '0 auto' }}>
            <div style={{ fontSize: 'clamp(2.4rem, 8vw, 3.5rem)', marginBottom: '16px' }}>📬</div>
            <h1 style={{ fontFamily: 'var(--font-cormorant), serif', color: '#eddbc3', fontSize: '2.4rem', fontWeight: 700, lineHeight: 1.1, margin: '0 0 12px' }}>
              Check your email!
            </h1>
            <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#eddbc3', fontSize: '0.9rem', opacity: 0.75, lineHeight: 1.7, margin: '0 0 8px' }}>
              We've sent a confirmation link to <span style={{ color: '#f9d174', fontWeight: 600 }}>{form.email}</span>.
            </p>
            <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#eddbc3', fontSize: '0.85rem', opacity: 0.55, lineHeight: 1.6, margin: 0 }}>
              Click the link in the email to activate your account and you'll land straight in your Bonkers dashboard. Check your spam folder if it doesn't arrive within a minute.
            </p>
          </div>
        )}

        {/* ── SIGNUP FORM ── */}
        {step === 'signup' && (
          <div ref={signupRef}>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm mb-6">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-8">

              {/* ACCOUNT DETAILS */}
              <section className="flex flex-col gap-4" style={{ marginTop: '16px' }}>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600, fontSize: '0.7rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#eddbc3' }}>First Name</label>
                    <input type="text" placeholder=""
                      value={form.firstName} onChange={e => set('firstName', e.target.value)}
                      className={inputClass} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600, fontSize: '0.7rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#eddbc3' }}>Last Name</label>
                    <input type="text" placeholder=""
                      value={form.lastName} onChange={e => set('lastName', e.target.value)}
                      className={inputClass} />
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <label style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600, fontSize: '0.7rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#eddbc3' }}>Email Address</label>
                  <input type="email" placeholder=""
                    value={form.email} onChange={e => set('email', e.target.value)}
                    className={inputClass} />
                </div>
                <div id="field-password" className="flex flex-col gap-1">
                  <label style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600, fontSize: '0.7rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#eddbc3' }}>Password</label>
                  <div className="relative">
                    <input type={showPassword ? 'text' : 'password'} placeholder=""
                      value={form.password} onChange={e => { set('password', e.target.value); setFieldErrors(prev => ({ ...prev, password: '' })) }}
                      className={`${inputClass} pr-16`} />
                    <button type="button" onClick={() => setShowPassword(v => !v)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm">
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  {fieldErrors.password && <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#e57451', fontSize: '0.95rem', marginTop: '4px', paddingLeft: '4px' }}>{fieldErrors.password}</p>}
                </div>
<div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', marginTop: '50px', marginBottom: '50px' }}>
                  <img src="/underline_divider.png" alt="" style={{ width: '100%', height: 'auto', transform: 'scaleY(2)', transformOrigin: 'center' }} />
                  <img src="/star_button_on.png" alt="" style={{ position: 'absolute', width: '20px', height: '20px', transform: 'translateY(-4px)' }} />
                </div>
              </section>

              {/* CHOOSE YOUR PLAN */}
              <section style={{ marginTop: '-32px' }}>
                <div style={{ textAlign: 'center', marginBottom: '48px' }}>
                  <div className="flex items-center justify-center gap-2">
                    <img src="/whiskers_left.png" alt="" style={{ height: '28px', width: 'auto', pointerEvents: 'none' }} />
                    <p style={{ fontFamily: 'var(--font-amatic)', fontWeight: 700, color: '#eddbc3', fontSize: '1.5rem', letterSpacing: '0.04em', margin: '0 0 6px', lineHeight: 1 }}>How Bonkers Are You?</p>
                    <img src="/whiskers_right.png" alt="" style={{ height: '28px', width: 'auto', pointerEvents: 'none' }} />
                  </div>
                  <h2 style={{ fontFamily: 'var(--font-cormorant), serif', color: '#eddbc3', fontSize: 'clamp(2.4rem, 8vw, 3.5rem)', fontWeight: 700, lineHeight: 1.1, margin: '6px 0 0' }}>Choose your plan.</h2>
                </div>
                <div style={{ display: 'flex', flexDirection: 'row', gap: '12px', alignItems: 'stretch' }}>
                  {PLANS.map((plan, i) => {
                    const bookImg = ['/books_2a.png', '/books_4a.png', '/books_6a.png'][i]
                    const selected = form.planId === plan.id
                    return (
                      <div key={plan.id} onClick={() => set('planId', plan.id)}
                        style={{ position: 'relative', flex: 1, backgroundColor: 'transparent', borderColor: selected ? '#f9d174' : 'rgba(237,219,195,0.25)', borderWidth: '2px', borderStyle: 'solid', borderRadius: '16px', padding: '16px 8px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', textAlign: 'center' }}>
                        {plan.badge && (
                          <span style={{ position: 'absolute', top: '-14px', left: '4px', right: '4px', textAlign: 'center', backgroundColor: '#f5c047', color: '#374151', fontSize: '1.15rem', fontWeight: 700, padding: '1px 6px', borderRadius: '12px', fontFamily: 'var(--font-amatic)', lineHeight: 1.2, whiteSpace: 'nowrap' }}>
                            Most Popular
                          </span>
                        )}
                        <span style={{ fontFamily: 'var(--font-cormorant), serif', fontWeight: 700, color: '#eddbc3', fontSize: '1.25rem', lineHeight: 1.2 }}>{plan.label}</span>
                        <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', marginTop: '20px', fontSize: '0.9rem', color: '#eddbc3', lineHeight: 1.3 }}>{plan.swapBooks} books<br />at a time</span>
                        <div style={{ height: '100px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', marginBottom: '10px', marginTop: '8px' }}>
                          <img src={bookImg} alt="" style={{ maxHeight: '100px', width: 'auto', objectFit: 'contain' }} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', width: '100%', paddingLeft: '12px' }}>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                            <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.72rem', color: '#eddbc3' }}>Up to</span>
                            <span style={{ fontFamily: 'var(--font-cormorant), serif', fontSize: '1.6rem', fontWeight: 900, color: '#eddbc3', lineHeight: 1 }}>{plan.books}</span>
                          </div>
                          <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.72rem', color: '#eddbc3' }}>books/month*</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 'auto', paddingTop: '24px' }}>
                          <span style={{ fontFamily: 'var(--font-cormorant), serif', fontSize: '2rem', fontWeight: 900, color: '#eddbc3', lineHeight: 1 }}><span style={{ fontSize: '0.75rem', fontWeight: 600 }}>AED </span>{plan.price}</span>
                          <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.6rem', color: '#eddbc3', letterSpacing: '0.05em', opacity: 0.8 }}>/month</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
                <p style={{ color: '#eddbc3', fontSize: '0.82rem', fontFamily: 'var(--font-montserrat), sans-serif', marginTop: '10px', opacity: 0.9 }}>*Based on choosing new books each week</p>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', marginTop: '50px', marginBottom: '0px' }}>
                  <img src="/underline_divider.png" alt="" style={{ width: '100%', height: 'auto', transform: 'scaleY(2)', transformOrigin: 'center' }} />
                  <img src="/star_button_on.png" alt="" style={{ position: 'absolute', width: '20px', height: '20px', transform: 'translateY(-4px)' }} />
                </div>
              </section>

              {/* 4. DELIVERY ADDRESS */}
              <section className="flex flex-col gap-4">
                <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                  <div className="flex items-center justify-center gap-2">
                    <img src="/whiskers_left.png" alt="" style={{ height: '28px', width: 'auto', pointerEvents: 'none' }} />
                    <p style={{ fontFamily: 'var(--font-amatic)', fontWeight: 700, color: '#eddbc3', fontSize: '1.5rem', letterSpacing: '0.04em', margin: '0 0 6px', lineHeight: 1 }}>Where should the books go?</p>
                    <img src="/whiskers_right.png" alt="" style={{ height: '28px', width: 'auto', pointerEvents: 'none' }} />
                  </div>
                  <h2 style={{ fontFamily: 'var(--font-cormorant), serif', color: '#eddbc3', fontSize: 'clamp(2.4rem, 8vw, 3.5rem)', fontWeight: 700, lineHeight: 1.1, margin: '6px 0 0' }}>Your delivery details.</h2>
                </div>
                {/* Location pill */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginTop: '-4px', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'rgba(237,219,195,0.1)', border: '1px solid rgba(237,219,195,0.25)', borderRadius: '999px', padding: '6px 16px' }}>
                    <svg width="14" height="18" viewBox="0 0 14 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M7 0C3.13 0 0 3.13 0 7c0 5.25 7 11 7 11s7-5.75 7-11c0-3.87-3.13-7-7-7zm0 9.5C5.62 9.5 4.5 8.38 4.5 7S5.62 4.5 7 4.5 9.5 5.62 9.5 7 8.38 9.5 7 9.5z" fill="#e8533a"/>
                    </svg>
                    <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.78rem', color: '#eddbc3', fontWeight: 500 }}>
                      {checkForm.communityName || 'Your community'}{checkForm.propertyType ? ` · ${checkForm.propertyType.charAt(0).toUpperCase() + checkForm.propertyType.slice(1)}` : ''}
                    </span>
                  </div>
                  <button type="button" onClick={() => setStep('check')}
                    style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.78rem', color: '#eddbc3', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', textDecorationColor: '#f9d174', textDecorationThickness: '2px', textUnderlineOffset: '3px', padding: 0 }}>
                    Change
                  </button>
                </div>
                {form.houseType === 'apartment' ? (
                  <div className="flex gap-3">
                    <div className="flex flex-col gap-1" style={{ flex: 1 }}>
                      <label style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600, fontSize: '0.7rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#eddbc3' }}>Apartment Number</label>
                      <input type="text" placeholder="" value={form.villaFlat} onChange={e => set('villaFlat', e.target.value)} className={inputClass} />
                    </div>
                    <div className="flex flex-col gap-1" style={{ flex: 1 }}>
                      <label style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600, fontSize: '0.7rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#eddbc3' }}>Building Name</label>
                      <input type="text" placeholder="" value={form.building} onChange={e => set('building', e.target.value)} className={inputClass} />
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1">
                    <label style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600, fontSize: '0.7rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#eddbc3' }}>Villa Name or Number</label>
                    <input type="text" placeholder="" value={form.villaFlat} onChange={e => set('villaFlat', e.target.value)} className={inputClass} />
                  </div>
                )}
                <div className="flex flex-col gap-1">
                  <label style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600, fontSize: '0.7rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#eddbc3' }}>Street</label>
                  <input type="text" placeholder="" value={form.street} onChange={e => set('street', e.target.value)} className={inputClass} />
                </div>
                <div className="flex gap-3 items-end">
                  <div className="flex flex-col gap-1 flex-1">
                    <label style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600, fontSize: '0.7rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#eddbc3' }}>Sub-community<br /><span style={{ textTransform: 'none', fontWeight: 400, opacity: 0.7 }}>(optional)</span></label>
                    <input type="text" placeholder="" value={form.subCommunity} onChange={e => set('subCommunity', e.target.value)} className={inputClass} />
                  </div>
                  <div className="flex flex-col gap-1 flex-1">
                    <label style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600, fontSize: '0.7rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#eddbc3' }}>Area<br /><span style={{ textTransform: 'none', fontWeight: 400, opacity: 0.7 }}>(optional)</span></label>
                    <input type="text" placeholder="" value={form.area} onChange={e => set('area', e.target.value)} className={inputClass} />
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <label style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600, fontSize: '0.7rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#eddbc3' }}>Delivery Notes <span style={{ textTransform: 'none', fontWeight: 400, opacity: 0.7 }}>(optional)</span></label>
                  <input type="text" placeholder="e.g. gate code, beware tiny ferocious dog..." value={form.deliveryNotes} onChange={e => set('deliveryNotes', e.target.value)} className={inputClass} />
                </div>
                <div className="flex flex-col gap-1">
                  <label style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600, fontSize: '0.7rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#eddbc3' }}>Mobile Number</label>
                  <input type="tel" placeholder="05XXXXXXXX" value={form.phone} onChange={e => { set('phone', e.target.value); set('whatsapp', e.target.value) }} className={inputClass} />
                  {fieldErrors.phone && <p style={{ color: '#f87171', fontSize: '0.75rem', marginTop: '2px', fontFamily: 'var(--font-montserrat), sans-serif' }}>{fieldErrors.phone}</p>}
                </div>
                <div className="flex flex-col gap-1">
                  <label style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600, fontSize: '0.7rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#eddbc3' }}>WhatsApp Number <span style={{ textTransform: 'none', fontWeight: 400, opacity: 0.7 }}>(if different)</span></label>
                  <div className="flex gap-2">
                    <div ref={countryDropdownRef} style={{ position: 'relative', width: '130px', flexShrink: 0 }}>
                      <button type="button" onClick={() => { setCountryDropdownOpen(o => !o); setCountrySearch('') }}
                        className={inputClass}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', padding: '12px 10px', border: '1px solid #d1d5db' }}>
                        <span>{COUNTRY_CODES.find(c => c.code === form.whatsappCountryCode)?.label ?? form.whatsappCountryCode}</span>
                        <svg width="10" height="6" viewBox="0 0 12 8" fill="none" style={{ flexShrink: 0, marginLeft: '4px', transform: countryDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}><path d="M1 1L6 7L11 1" stroke="#888" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </button>
                      {countryDropdownOpen && (
                        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, backgroundColor: '#fcf7eb', border: '1px solid #d1d5db', borderRadius: '10px', zIndex: 50, overflow: 'hidden', boxShadow: '0 4px 16px rgba(0,0,0,0.15)' }}>
                          <input
                            type="text"
                            placeholder="Search..."
                            value={countrySearch}
                            onChange={e => setCountrySearch(e.target.value)}
                            autoFocus
                            style={{ width: '100%', padding: '10px 12px', border: 'none', borderBottom: '1px solid #e5e7eb', outline: 'none', fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.8rem', backgroundColor: '#fcf7eb', color: '#1a1a1a', boxSizing: 'border-box' }}
                          />
                          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                            {COUNTRY_CODES.filter(c =>
                              c.label.toLowerCase().includes(countrySearch.toLowerCase()) ||
                              c.code.includes(countrySearch)
                            ).map(c => (
                              <button key={c.label} type="button"
                                onClick={() => { set('whatsappCountryCode', c.code); setCountryDropdownOpen(false); setCountrySearch('') }}
                                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px', fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.82rem', color: '#1a1a1a', background: form.whatsappCountryCode === c.code ? '#f0e8d8' : 'transparent', border: 'none', cursor: 'pointer' }}>
                                {c.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <input type="tel" placeholder="e.g. 501234567" value={form.whatsapp} onChange={e => set('whatsapp', e.target.value)} className={inputClass} style={{ flex: 1 }} />
                  </div>
                </div>
                {/* Location pin placeholder */}
                <div style={{ position: 'relative', marginTop: '4px' }}>
                  <button type="button" disabled
                    style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'none', border: 'none', padding: 0, cursor: 'not-allowed', textAlign: 'left' }}>
                    <svg width="18" height="22" viewBox="0 0 14 18" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
                      <path d="M7 0C3.13 0 0 3.13 0 7c0 5.25 7 11 7 11s7-5.75 7-11c0-3.87-3.13-7-7-7zm0 9.5C5.62 9.5 4.5 8.38 4.5 7S5.62 4.5 7 4.5 9.5 5.62 9.5 7 8.38 9.5 7 9.5z" fill="#54bdc0"/>
                    </svg>
                    <div>
                      <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.85rem', fontWeight: 600, color: '#54bdc0', textDecoration: 'underline', textDecorationThickness: '1.5px', textUnderlineOffset: '2px', margin: 0 }}>Add location pin <span style={{ fontWeight: 400, opacity: 0.8 }}>(optional)</span></p>
                      <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.8rem', color: '#eddbc3', margin: '2px 0 0' }}>Helps our delivery team<br />find you easily.</p>
                    </div>
                  </button>
                  <img src="/sign.png" alt="" style={{ position: 'absolute', right: '-24px', top: '-40px', height: '160px', width: 'auto', pointerEvents: 'none' }} />
                </div>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', marginTop: '50px', marginBottom: '50px' }}>
                  <img src="/underline_divider.png" alt="" style={{ width: '100%', height: 'auto', transform: 'scaleY(2)', transformOrigin: 'center' }} />
                  <img src="/star_button_on.png" alt="" style={{ position: 'absolute', width: '20px', height: '20px', transform: 'translateY(-4px)' }} />
                </div>
              </section>

              {/* 5. DELIVERY PREFERENCE */}
              <section className="flex flex-col gap-4">
                <div style={{ textAlign: 'center' }}>
                  <div className="flex items-center justify-center gap-2">
                    <img src="/whiskers_left.png" alt="" style={{ height: '28px', width: 'auto', pointerEvents: 'none' }} />
                    <p style={{ fontFamily: 'var(--font-amatic)', fontWeight: 700, color: '#f9d174', fontSize: '1.5rem', letterSpacing: '0.04em', margin: '0 0 6px', lineHeight: 1 }}>The important stuff</p>
                    <img src="/whiskers_right.png" alt="" style={{ height: '28px', width: 'auto', pointerEvents: 'none' }} />
                  </div>
                  <h2 style={{ fontFamily: 'var(--font-cormorant), serif', color: '#eddbc3', fontSize: 'clamp(2.4rem, 8vw, 3.5rem)', fontWeight: 700, lineHeight: 1.1, margin: '6px 0 0' }}>How should we deliver?</h2>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { value: 'leave_at_door', label: 'At the door', sub: 'Contactless' },
                    { value: 'leave_safe_spot', label: 'Safe spot', sub: 'Contactless' },
                    { value: 'ring_bell', label: 'Ring the bell', sub: "Someone's home" },
                    { value: 'call_no_bell', label: "Call me", sub: "Don't ring bell" },
                    { value: 'leave_with_reception', label: 'Reception', sub: 'Concierge' },
                  ].map(opt => (
                    <button key={opt.value} type="button" onClick={() => set('deliveryPreference', opt.value)}
                      className="flex flex-row items-center text-left px-3 py-3 rounded-xl transition-all border-[3px]"
                      style={{
                        borderColor: form.deliveryPreference === opt.value ? '#f9d174' : 'rgba(237,219,195,0.3)',
                        backgroundColor: 'rgba(255,255,255,0.04)',
                        gap: '10px',
                      }}>
                      <img src={form.deliveryPreference === opt.value ? '/star_button_on.png' : '/star_orangeoutline.png'} alt="" style={{ width: '22px', height: '22px', flexShrink: 0 }} />
                      <div>
                        <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#eddbc3', fontSize: '0.9rem', fontWeight: 600, display: 'block' }}>{opt.label}</span>
                        <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#eddbc3', fontSize: '0.75rem', opacity: 0.6, display: 'block', marginTop: '2px' }}>{opt.sub}</span>
                      </div>
                    </button>
                  ))}
                </div>
                {form.deliveryPreference === 'leave_safe_spot' && (
                  <input type="text" placeholder="Describe the safe spot" className={inputClass}
                    value={form.safeSpotDescription} onChange={e => set('safeSpotDescription', e.target.value)} />
                )}
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', marginTop: '50px', marginBottom: '50px' }}>
                  <img src="/underline_divider.png" alt="" style={{ width: '100%', height: 'auto', transform: 'scaleY(2)', transformOrigin: 'center' }} />
                  <img src="/star_button_on.png" alt="" style={{ position: 'absolute', width: '20px', height: '20px', transform: 'translateY(-4px)' }} />
                  <img src="/bonky_delivering.png" alt="" style={{ position: 'absolute', right: '50px', bottom: '0', height: '100px', width: 'auto', pointerEvents: 'none', transform: 'translateY(-12%)' }} />
                </div>
              </section>

              {/* REVIEW */}
              <section className="flex flex-col gap-5">
                <div style={{ textAlign: 'center' }}>
                  <div className="flex items-center justify-center gap-2">
                    <img src="/whiskers_left.png" alt="" style={{ height: '28px', width: 'auto', pointerEvents: 'none' }} />
                    <p style={{ fontFamily: 'var(--font-amatic)', fontWeight: 700, color: '#eddbc3', fontSize: '1.5rem', letterSpacing: '0.04em', margin: '0 0 6px', lineHeight: 1 }}>One last look</p>
                    <img src="/whiskers_right.png" alt="" style={{ height: '28px', width: 'auto', pointerEvents: 'none' }} />
                  </div>
                  <h2 style={{ fontFamily: 'var(--font-cormorant), serif', color: '#eddbc3', fontSize: 'clamp(2.4rem, 8vw, 3.5rem)', fontWeight: 700, lineHeight: 1.1, margin: '6px 0 0' }}>Everything look right?</h2>
                </div>

                <div className="rounded-2xl" style={{ backgroundColor: '#fcf7eb', overflow: 'hidden', marginTop: '16px' }}>
                  {/* Plan row */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '16px 20px', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
                    <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 700, fontSize: '0.78rem', color: '#374151', width: '72px', flexShrink: 0, paddingTop: '2px' }}>Plan</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600, fontSize: '0.85rem', color: '#1a1a1a', margin: 0 }}>{selectedPlan.label}</p>
                        <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 700, fontSize: '0.85rem', color: '#1a1a1a', margin: 0, whiteSpace: 'nowrap' }}>AED&nbsp;{selectedPlan.price}/month</p>
                      </div>
                      <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.78rem', color: '#6b7280', margin: '2px 0 0' }}>{selectedPlan.swapBooks} books at a time</p>
                      <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.78rem', color: '#6b7280', margin: '1px 0 0' }}>Up to {selectedPlan.books} books/month</p>
                      <button type="button" onClick={() => document.getElementById('plan-section')?.scrollIntoView({ behavior: 'smooth' })}
                        style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.78rem', color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: '4px 0 0', display: 'block', textAlign: 'right', width: '100%' }}>Edit</button>
                    </div>
                  </div>
                  {/* Delivery row */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '16px 20px', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
                    <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 700, fontSize: '0.78rem', color: '#374151', width: '72px', flexShrink: 0, paddingTop: '2px' }}>Delivery</span>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600, fontSize: '0.85rem', color: '#1a1a1a', margin: 0 }}>{checkForm.communityName}{form.villaFlat ? `, ${form.houseType === 'apartment' ? 'Apt' : 'Villa'} ${form.villaFlat}` : ''}</p>
                      {form.street ? <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.78rem', color: '#6b7280', margin: '2px 0 0' }}>{form.street}</p> : null}
                      <button type="button" onClick={() => document.getElementById('delivery-section')?.scrollIntoView({ behavior: 'smooth' })}
                        style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.78rem', color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: '4px 0 0', display: 'block', textAlign: 'right', width: '100%' }}>Edit</button>
                    </div>
                  </div>
                  {/* Home type row */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '16px 20px', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
                    <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 700, fontSize: '0.78rem', color: '#374151', width: '72px', flexShrink: 0, paddingTop: '2px' }}>Home type</span>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600, fontSize: '0.85rem', color: '#1a1a1a', margin: 0, textTransform: 'capitalize' }}>{form.houseType || '—'}</p>
                      <button type="button" onClick={() => setStep('check')}
                        style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.78rem', color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: '4px 0 0', display: 'block', textAlign: 'right', width: '100%' }}>Edit</button>
                    </div>
                  </div>
                </div>

                <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.78rem', color: '#eddbc3', textAlign: 'center', margin: '-4px 0 0' }}>Your membership renews monthly. Cancel anytime.</p>

                <div id="field-terms" className="flex flex-col gap-3">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input type="checkbox" checked={form.agreedToTerms}
                      onChange={e => { set('agreedToTerms', e.target.checked); setFieldErrors(prev => ({ ...prev, terms: '' })) }}
                      className="accent-amber-500 mt-1" />
                    <span className="text-sm" style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#eddbc3' }}>
                      I agree to the Bonkers{' '}
                      <span className="text-blue-400 underline cursor-pointer">Membership Rules</span>,{' '}
                      <span className="text-blue-400 underline cursor-pointer">Terms &amp; Conditions</span>
                      {', '}and{' '}
                      <span className="text-blue-400 underline cursor-pointer">Privacy Policy</span>.
                    </span>
                  </label>
                  {fieldErrors.terms && <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#e57451', fontSize: '0.95rem', marginTop: '-8px', paddingLeft: '28px' }}>{fieldErrors.terms}</p>}
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input type="checkbox" checked={form.agreedToMarketing}
                      onChange={e => set('agreedToMarketing', e.target.checked)}
                      className="accent-amber-500 mt-1" />
                    <span className="text-sm" style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#eddbc3' }}>
                      Send me Bonkers news, book recommendations and other brilliant nonsense. <span style={{ opacity: 0.6 }}>(optional)</span>
                    </span>
                  </label>
                </div>

                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', marginTop: '50px', marginBottom: '50px' }}>
                  <img src="/underline_divider.png" alt="" style={{ width: '100%', height: 'auto', transform: 'scaleY(2)', transformOrigin: 'center' }} />
                  <img src="/star_button_on.png" alt="" style={{ position: 'absolute', width: '20px', height: '20px', transform: 'translateY(-4px)' }} />
                </div>

                <div style={{ textAlign: 'left' }}>
                  <div className="flex items-center gap-2" style={{ marginLeft: 0 }}>
                    <img src="/whiskers_left.png" alt="" style={{ height: '28px', width: 'auto', pointerEvents: 'none', flexShrink: 0 }} />
                    <p style={{ fontFamily: 'var(--font-amatic)', fontWeight: 700, color: '#eddbc3', fontSize: '1.5rem', letterSpacing: '0.04em', margin: '0 0 6px', lineHeight: 1 }}>Almost Bonkers</p>
                    <img src="/whiskers_right.png" alt="" style={{ height: '28px', width: 'auto', pointerEvents: 'none' }} />
                  </div>
                  <h2 style={{ fontFamily: 'var(--font-cormorant), serif', color: '#eddbc3', fontSize: 'clamp(2.4rem, 8vw, 3.5rem)', fontWeight: 700, lineHeight: 1.1, margin: '6px 0 0', paddingLeft: '36px' }}>Payment</h2>
                </div>

                <hr style={{ borderColor: '#eddbc3', opacity: 0.3 }} />

                <div className="flex flex-col gap-3">
                  <p className="font-black uppercase tracking-widest flex items-center gap-2" style={{ fontFamily: 'var(--font-cormorant), serif', color: '#eddbc3', fontSize: '1.2rem' }}>
                    Payment Method
                  </p>
                  {[
                    { value: 'card', label: 'Credit / Debit Card' },
                    { value: 'apple', label: 'Apple Pay' },
                    { value: 'tabby', label: 'Tabby - Buy now, pay later' },
                  ].map(method => (
                    <label key={method.value} className="flex items-center gap-3 p-3 rounded-xl cursor-pointer hover:border-amber-300 text-sm" style={{ backgroundColor: '#fcf7eb', border: '2px solid transparent' }}>
                      <input type="radio" name="paymentMethod" value={method.value} defaultChecked={method.value === 'card'} className="accent-amber-500" />
                      <span className="text-gray-700">{method.label}</span>
                    </label>
                  ))}
                </div>


                 <div className="flex flex-col items-center gap-3" style={{ marginTop: '8px' }}>
                   <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', opacity: loading ? 0.7 : 1, transition: 'opacity 0.2s' }}>
                     <img src="/whiskers_left.png" alt="" style={{ position: 'absolute', left: '-36px', height: '48px', width: 'auto', zIndex: 1, pointerEvents: 'none', filter: 'brightness(0) saturate(100%) invert(87%) sepia(33%) saturate(762%) hue-rotate(339deg) brightness(103%) contrast(98%)' }} />
                     <button type="submit" disabled={loading}
                       style={{ backgroundImage: 'url(/button2.png)', backgroundSize: '300% 300%', backgroundPosition: 'center', backgroundRepeat: 'no-repeat', backgroundColor: 'transparent', border: 'none', borderRadius: '999px', cursor: loading ? 'not-allowed' : 'pointer', padding: '14px 32px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                       <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 600, fontSize: '0.85rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#fff', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '8px' }}>
                         {loading ? 'Setting up...' : 'Join Bonkers'}
                         {!loading && <img src="/magicwand.png" alt="" style={{ height: '18px', width: 'auto' }} />}
                       </span>
                     </button>
                     <img src="/whiskers_right.png" alt="" style={{ position: 'absolute', right: '-36px', height: '48px', width: 'auto', zIndex: 1, pointerEvents: 'none', filter: 'brightness(0) saturate(100%) invert(87%) sepia(33%) saturate(762%) hue-rotate(339deg) brightness(103%) contrast(98%)' }} />
                   </div>
                   <p className="text-center text-sm" style={{ color: '#eddbc3' }}>No commitment. Cancel anytime.</p>
                 </div>

              </section>

            </form>

            <div className="mt-6">
              <p className="text-sm font-bold" style={{ color: '#eddbc3' }}>Questions? We&apos;re here to help!</p>
              <p className="text-sm mt-1" style={{ color: '#eddbc3' }}>
                WhatsApp us on +971 50 123 4567 or email{' '}
                <span style={{ color: '#f9d174', textDecoration: 'underline' }}>hello@bonkers.ae</span>
              </p>
            </div>
          </div>
        )}

      </div>
    </main>
  )
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  )
}



