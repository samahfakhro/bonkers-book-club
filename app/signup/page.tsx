'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Suspense } from 'react'

const PLANS = [
  { id: 'starter', label: 'A Little Bonkers', price: 149, badge: null, books: 8, swapBooks: 2, perBook: '18', weeklyNote: 'Up to 2 books each week' },
  { id: 'mid', label: 'Quite Bonkers', price: 199, badge: 'MOST POPULAR', books: 16, swapBooks: 4, perBook: '12', weeklyNote: 'Up to 4 books each week' },
  { id: 'full', label: 'Absolutely Bonkers', price: 249, badge: null, books: 24, swapBooks: 6, perBook: '10', weeklyNote: 'Up to 6 books each week' },
]

const COUNTRY_CODES = [
  { code: '+971', label: 'UAE +971' },
  { code: '+93', label: 'Afghanistan +93' },
  { code: '+355', label: 'Albania +355' },
  { code: '+213', label: 'Algeria +213' },
  { code: '+376', label: 'Andorra +376' },
  { code: '+244', label: 'Angola +244' },
  { code: '+1268', label: 'Antigua and Barbuda +1268' },
  { code: '+54', label: 'Argentina +54' },
  { code: '+374', label: 'Armenia +374' },
  { code: '+61', label: 'Australia +61' },
  { code: '+43', label: 'Austria +43' },
  { code: '+994', label: 'Azerbaijan +994' },
  { code: '+1242', label: 'Bahamas +1242' },
  { code: '+973', label: 'Bahrain +973' },
  { code: '+880', label: 'Bangladesh +880' },
  { code: '+1246', label: 'Barbados +1246' },
  { code: '+375', label: 'Belarus +375' },
  { code: '+32', label: 'Belgium +32' },
  { code: '+501', label: 'Belize +501' },
  { code: '+229', label: 'Benin +229' },
  { code: '+975', label: 'Bhutan +975' },
  { code: '+591', label: 'Bolivia +591' },
  { code: '+387', label: 'Bosnia and Herzegovina +387' },
  { code: '+267', label: 'Botswana +267' },
  { code: '+55', label: 'Brazil +55' },
  { code: '+673', label: 'Brunei +673' },
  { code: '+359', label: 'Bulgaria +359' },
  { code: '+226', label: 'Burkina Faso +226' },
  { code: '+257', label: 'Burundi +257' },
  { code: '+855', label: 'Cambodia +855' },
  { code: '+237', label: 'Cameroon +237' },
  { code: '+1', label: 'Canada +1' },
  { code: '+238', label: 'Cape Verde +238' },
  { code: '+236', label: 'Central African Republic +236' },
  { code: '+235', label: 'Chad +235' },
  { code: '+56', label: 'Chile +56' },
  { code: '+86', label: 'China +86' },
  { code: '+57', label: 'Colombia +57' },
  { code: '+269', label: 'Comoros +269' },
  { code: '+242', label: 'Congo +242' },
  { code: '+243', label: 'Congo (DR) +243' },
  { code: '+506', label: 'Costa Rica +506' },
  { code: '+385', label: 'Croatia +385' },
  { code: '+53', label: 'Cuba +53' },
  { code: '+357', label: 'Cyprus +357' },
  { code: '+420', label: 'Czech Republic +420' },
  { code: '+45', label: 'Denmark +45' },
  { code: '+253', label: 'Djibouti +253' },
  { code: '+1767', label: 'Dominica +1767' },
  { code: '+1809', label: 'Dominican Republic +1809' },
  { code: '+593', label: 'Ecuador +593' },
  { code: '+20', label: 'Egypt +20' },
  { code: '+503', label: 'El Salvador +503' },
  { code: '+240', label: 'Equatorial Guinea +240' },
  { code: '+291', label: 'Eritrea +291' },
  { code: '+372', label: 'Estonia +372' },
  { code: '+251', label: 'Ethiopia +251' },
  { code: '+679', label: 'Fiji +679' },
  { code: '+358', label: 'Finland +358' },
  { code: '+33', label: 'France +33' },
  { code: '+241', label: 'Gabon +241' },
  { code: '+220', label: 'Gambia +220' },
  { code: '+995', label: 'Georgia +995' },
  { code: '+49', label: 'Germany +49' },
  { code: '+233', label: 'Ghana +233' },
  { code: '+30', label: 'Greece +30' },
  { code: '+1473', label: 'Grenada +1473' },
  { code: '+502', label: 'Guatemala +502' },
  { code: '+224', label: 'Guinea +224' },
  { code: '+245', label: 'Guinea-Bissau +245' },
  { code: '+592', label: 'Guyana +592' },
  { code: '+509', label: 'Haiti +509' },
  { code: '+504', label: 'Honduras +504' },
  { code: '+852', label: 'Hong Kong +852' },
  { code: '+36', label: 'Hungary +36' },
  { code: '+354', label: 'Iceland +354' },
  { code: '+91', label: 'India +91' },
  { code: '+62', label: 'Indonesia +62' },
  { code: '+98', label: 'Iran +98' },
  { code: '+964', label: 'Iraq +964' },
  { code: '+353', label: 'Ireland +353' },
  { code: '+972', label: 'Israel +972' },
  { code: '+39', label: 'Italy +39' },
  { code: '+1876', label: 'Jamaica +1876' },
  { code: '+81', label: 'Japan +81' },
  { code: '+962', label: 'Jordan +962' },
  { code: '+7', label: 'Kazakhstan +7' },
  { code: '+254', label: 'Kenya +254' },
  { code: '+686', label: 'Kiribati +686' },
  { code: '+965', label: 'Kuwait +965' },
  { code: '+996', label: 'Kyrgyzstan +996' },
  { code: '+856', label: 'Laos +856' },
  { code: '+371', label: 'Latvia +371' },
  { code: '+961', label: 'Lebanon +961' },
  { code: '+266', label: 'Lesotho +266' },
  { code: '+231', label: 'Liberia +231' },
  { code: '+218', label: 'Libya +218' },
  { code: '+423', label: 'Liechtenstein +423' },
  { code: '+370', label: 'Lithuania +370' },
  { code: '+352', label: 'Luxembourg +352' },
  { code: '+853', label: 'Macau +853' },
  { code: '+261', label: 'Madagascar +261' },
  { code: '+265', label: 'Malawi +265' },
  { code: '+60', label: 'Malaysia +60' },
  { code: '+960', label: 'Maldives +960' },
  { code: '+223', label: 'Mali +223' },
  { code: '+356', label: 'Malta +356' },
  { code: '+222', label: 'Mauritania +222' },
  { code: '+230', label: 'Mauritius +230' },
  { code: '+52', label: 'Mexico +52' },
  { code: '+373', label: 'Moldova +373' },
  { code: '+377', label: 'Monaco +377' },
  { code: '+976', label: 'Mongolia +976' },
  { code: '+382', label: 'Montenegro +382' },
  { code: '+212', label: 'Morocco +212' },
  { code: '+258', label: 'Mozambique +258' },
  { code: '+95', label: 'Myanmar +95' },
  { code: '+264', label: 'Namibia +264' },
  { code: '+674', label: 'Nauru +674' },
  { code: '+977', label: 'Nepal +977' },
  { code: '+31', label: 'Netherlands +31' },
  { code: '+64', label: 'New Zealand +64' },
  { code: '+505', label: 'Nicaragua +505' },
  { code: '+227', label: 'Niger +227' },
  { code: '+234', label: 'Nigeria +234' },
  { code: '+850', label: 'North Korea +850' },
  { code: '+389', label: 'North Macedonia +389' },
  { code: '+47', label: 'Norway +47' },
  { code: '+968', label: 'Oman +968' },
  { code: '+92', label: 'Pakistan +92' },
  { code: '+680', label: 'Palau +680' },
  { code: '+970', label: 'Palestine +970' },
  { code: '+507', label: 'Panama +507' },
  { code: '+675', label: 'Papua New Guinea +675' },
  { code: '+595', label: 'Paraguay +595' },
  { code: '+51', label: 'Peru +51' },
  { code: '+63', label: 'Philippines +63' },
  { code: '+48', label: 'Poland +48' },
  { code: '+351', label: 'Portugal +351' },
  { code: '+974', label: 'Qatar +974' },
  { code: '+40', label: 'Romania +40' },
  { code: '+7', label: 'Russia +7' },
  { code: '+250', label: 'Rwanda +250' },
  { code: '+1869', label: 'Saint Kitts and Nevis +1869' },
  { code: '+1758', label: 'Saint Lucia +1758' },
  { code: '+1784', label: 'Saint Vincent and the Grenadines +1784' },
  { code: '+685', label: 'Samoa +685' },
  { code: '+378', label: 'San Marino +378' },
  { code: '+239', label: 'Sao Tome and Principe +239' },
  { code: '+966', label: 'Saudi Arabia +966' },
  { code: '+221', label: 'Senegal +221' },
  { code: '+381', label: 'Serbia +381' },
  { code: '+248', label: 'Seychelles +248' },
  { code: '+232', label: 'Sierra Leone +232' },
  { code: '+65', label: 'Singapore +65' },
  { code: '+421', label: 'Slovakia +421' },
  { code: '+386', label: 'Slovenia +386' },
  { code: '+677', label: 'Solomon Islands +677' },
  { code: '+252', label: 'Somalia +252' },
  { code: '+27', label: 'South Africa +27' },
  { code: '+82', label: 'South Korea +82' },
  { code: '+211', label: 'South Sudan +211' },
  { code: '+34', label: 'Spain +34' },
  { code: '+94', label: 'Sri Lanka +94' },
  { code: '+249', label: 'Sudan +249' },
  { code: '+597', label: 'Suriname +597' },
  { code: '+46', label: 'Sweden +46' },
  { code: '+41', label: 'Switzerland +41' },
  { code: '+963', label: 'Syria +963' },
  { code: '+886', label: 'Taiwan +886' },
  { code: '+992', label: 'Tajikistan +992' },
  { code: '+255', label: 'Tanzania +255' },
  { code: '+66', label: 'Thailand +66' },
  { code: '+670', label: 'Timor-Leste +670' },
  { code: '+228', label: 'Togo +228' },
  { code: '+676', label: 'Tonga +676' },
  { code: '+1868', label: 'Trinidad and Tobago +1868' },
  { code: '+216', label: 'Tunisia +216' },
  { code: '+90', label: 'Turkey +90' },
  { code: '+993', label: 'Turkmenistan +993' },
  { code: '+688', label: 'Tuvalu +688' },
  { code: '+256', label: 'Uganda +256' },
  { code: '+380', label: 'Ukraine +380' },
  { code: '+44', label: 'United Kingdom +44' },
  { code: '+1', label: 'United States +1' },
  { code: '+598', label: 'Uruguay +598' },
  { code: '+998', label: 'Uzbekistan +998' },
  { code: '+678', label: 'Vanuatu +678' },
  { code: '+58', label: 'Venezuela +58' },
  { code: '+84', label: 'Vietnam +84' },
  { code: '+967', label: 'Yemen +967' },
  { code: '+260', label: 'Zambia +260' },
  { code: '+263', label: 'Zimbabwe +263' },
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

function SignupForm() {
  const router = useRouter()
  const params = useSearchParams()
  const communityParam = params.get('community') || ''
  const typeParam = params.get('type') || ''

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [showPassword, setShowPassword] = useState(false)
  const [communities, setCommunities] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    supabase.from('communities').select('id, name').eq('is_active', true).order('name')
      .then(({ data }) => { if (data) setCommunities(data) })
  }, [])

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    whatsapp: '',
    whatsappCountryCode: '+971',
    samePhone: false,
    email: '',
    password: '',
    villaFlat: '',
    building: '',
    floor: '',
    street: '',
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

    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
    })

    if (signUpError || !authData.user) {
      setError(signUpError?.message ?? 'Something went wrong. Please try again.')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      setLoading(false)
      return
    }

    const whatsappFull = form.samePhone
      ? `+971${form.phone.replace(/^0/, '')}`
      : `${form.whatsappCountryCode}${form.whatsapp.replace(/^0/, '')}`

    const { error: householdError } = await supabase.from('households').insert({
      user_id: authData.user.id,
      first_name: form.firstName,
      last_name: form.lastName,
      mobile_phone: form.phone,
      whatsapp_number: whatsappFull,
      community_id: form.community || null,
      property_type: form.houseType || null,
      building: form.building || null,
      floor: form.floor || null,
      street: form.street || null,
      delivery_preference: form.deliveryPreference || null,
      delivery_notes: form.deliveryNotes || null,
      safe_spot_description: form.safeSpotDescription || null,
      signup_source_category: form.hearAboutUs || null,
      signup_source_sub_detail: form.hearDetail || null,
      agreed_to_marketing: form.agreedToMarketing,
      terms_accepted_at: new Date().toISOString(),
      account_status: 'active',
    })

    if (householdError) {
      setError(`DB error: ${householdError.message} (code: ${householdError.code})`)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      setLoading(false)
      return
    }

    const { data: householdData } = await supabase
      .from('households')
      .select('id')
      .eq('user_id', authData.user.id)
      .single()

    if (householdData) {
      const selectedPlanData = PLANS.find(p => p.id === form.planId)
      const { data: planRow } = await supabase
        .from('subscription_plans')
        .select('id')
        .eq('name', selectedPlanData?.label ?? '')
        .maybeSingle()

      await supabase.from('subscriptions').insert({
        household_id: householdData.id,
        plan_id: planRow?.id ?? null,
        status: 'active',
        start_date: new Date().toISOString(),
      })
    }

    setLoading(false)
    router.push('/dashboard')
  }

  const inputClass = "w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-amber-400 bg-[#efe7dd]"
  const labelClass = "block text-sm font-semibold text-gray-700 mb-1"


  return (
    <main className="min-h-screen">


      <div className="max-w-2xl md:max-w-3xl mx-auto px-4 py-10">
        <img src="/Bonkers_Word_Logo_White1.png" alt="Bonkers Book Club" className="h-auto" style={{ width: '160px', display: 'block', margin: '0 auto 24px' }} />
        <div>
            <h1 className="font-black mb-1 text-center" style={{ fontFamily: 'var(--font-cormorant), serif', color: '#eddbc3', fontSize: '2.4rem', lineHeight: '1.1', marginTop: '-16px' }}>
              Wonderful News!
            </h1>
            <p className="text-center mb-1" style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#eddbc3', fontSize: '1.05rem', lineHeight: '1.2', marginTop: '16px' }}>
              We deliver to your neighbourhood.
            </p>
            <img src="/books_marching1.png" alt="" className="h-auto" style={{ width: '90%', display: 'block', margin: '8px auto' }} />
            <h2 className="font-black text-center" style={{ fontFamily: 'var(--font-cormorant), serif', color: '#eddbc3', fontSize: '2rem', lineHeight: '1', marginBottom: '16px', marginTop: '-8px' }}>
              Join the Club
            </h2>
            <div className="mb-6 px-2">
              <ul className="flex flex-col gap-2 items-center">
                {['Free weekly delivery & collection', 'Keep books as long as you like — no late fees', 'Cancel, pause, or change plan anytime'].map((b, i) => (
                  <li key={i} className="flex items-center justify-center gap-2" style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.9rem', color: '#eddbc3' }}>
                    <img src="/star_button_on.png" alt="" style={{ width: '12px', height: '12px', flexShrink: 0 }} />
                    {b}
                  </li>
                ))}
              </ul>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm mb-6">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-8">

              {/* 1. CHOOSE YOUR PLAN */}
              <section>
                <h2 className="font-normal tracking-widest uppercase mb-4 pb-2" style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#f9d174', fontSize: '1rem' }}>
                  1. Choose Your Plan
                </h2>
                <div className="flex flex-col gap-3" style={{ maxWidth: '420px', margin: '0 auto' }}>
                  {PLANS.map(plan => (
                    <div key={plan.id}>
                      <div
                        onClick={() => set('planId', plan.id)}
                        style={{ fontFamily: 'var(--font-cormorant), serif', backgroundColor: '#efe7dd', borderColor: form.planId === plan.id ? '#e57451' : 'transparent', cursor: 'pointer' }}
                        className="relative flex items-center justify-between px-5 py-3 rounded-2xl border-[4px] transition-all hover:border-amber-300">

                        {plan.badge && (
                          <span className="absolute -top-2 left-4 font-black px-2 py-0.5 rounded-full whitespace-nowrap" style={{ fontSize: '0.8rem', backgroundColor: '#f5c047', color: '#374151', fontFamily: 'var(--font-cormorant), serif' }}>
                            {plan.badge}
                          </span>
                        )}
                        <div className="flex flex-col text-left w-full">
                          {/* Title row with price aligned right */}
                          <div className="flex items-start justify-between w-full">
                            <span className="font-bold text-gray-800 text-2xl">{plan.label}</span>
                            {/* Star bottom left */}
                            <span className="relative flex items-center" style={{ position: 'absolute', bottom: '10px', left: '14px' }}>
                              {form.planId === plan.id && <img src="/whiskers_left.png" alt="" style={{ position: 'absolute', right: '100%', height: '18px', width: 'auto', pointerEvents: 'none' }} />}
                              <img src={form.planId === plan.id ? '/star_button_on.png' : '/star_button_off.png'} alt="" style={{ width: '22px', height: '22px', objectFit: 'contain' }} />
                              {form.planId === plan.id && <img src="/whiskers_right.png" alt="" style={{ position: 'absolute', left: '100%', height: '18px', width: 'auto', pointerEvents: 'none' }} />}
                            </span>
                            <div className="flex flex-col items-end">
                              <span className="text-3xl font-black text-gray-900 leading-none flex items-baseline gap-1">{plan.price}<span className="text-xs text-gray-900" style={{ fontFamily: 'var(--font-cormorant), serif' }}>AED</span></span>
                              <span className="text-xs text-gray-900" style={{ fontFamily: 'var(--font-montserrat), sans-serif' }}>{plan.price && '/month'}</span>
                            </div>
                          </div>
                          {/* Books row */}
                          <div className="flex flex-col items-center w-full" style={{ marginTop: '-18px' }}>
                            <span className="text-5xl font-black text-gray-900 leading-none">{plan.books}</span>
                            <span className="text-base text-gray-900" style={{ fontFamily: 'var(--font-montserrat), sans-serif' }}>books / month</span>
                          </div>
                          {/* Weekly note */}
                          {(plan as any).weeklyNote && (
                            <span className="text-sm text-gray-900 text-center w-full" style={{ fontFamily: 'var(--font-montserrat), sans-serif', marginTop: '2px' }}>
                              Up to <span style={{ fontFamily: 'var(--font-cormorant), serif', fontSize: '1.1rem', lineHeight: 1, verticalAlign: 'bottom' }}>{plan.swapBooks}</span> books each week
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>


              {/* 2. TELL US ABOUT YOU */}
              <section className="flex flex-col gap-4" style={{ marginTop: '40px' }}>
                <div className="relative mb-1" style={{ overflow: 'visible' }}>
                  <p className="uppercase tracking-widest" style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#f9d174', fontSize: '1rem' }}>2. Tell Us About You</p>
                  <img src="/bonky_signup_1.png" alt="" style={{ position: 'absolute', top: '-70px', right: '0', height: '120px', width: 'auto', pointerEvents: 'none' }} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input type="text" placeholder="First name *"
                    value={form.firstName} onChange={e => set('firstName', e.target.value)}
                    className={inputClass} />
                  <input type="text" placeholder="Last name *"
                    value={form.lastName} onChange={e => set('lastName', e.target.value)}
                    className={inputClass} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div id="field-phone">
                    <input type="tel" placeholder="UAE Mobile *"
                      value={form.phone}
                      onChange={e => {
                        const val = e.target.value.replace(/[^\d]/g, '').slice(0, 10)
                        set('phone', val)
                        if (form.samePhone) set('whatsapp', val.replace(/^0/, ''))
                        setFieldErrors(prev => ({ ...prev, phone: '' }))
                      }}
                      className={inputClass} />
                    <p className="text-xs mt-1" style={{ color: '#eddbc3' }}>Format: 05XXXXXXXX</p>
                    {fieldErrors.phone && <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#e57451', fontSize: '0.95rem', marginTop: '4px', paddingLeft: '4px' }}>{fieldErrors.phone}</p>}
                  </div>
                  <div>
                    <div className="flex">
                      <input type="text" value={form.whatsappCountryCode}
                        onChange={e => set('whatsappCountryCode', e.target.value)}
                        className="w-14 shrink-0 border border-r-0 border-gray-300 rounded-l-lg px-1 py-3 bg-[#efe7dd] text-center focus:outline-none focus:ring-2 focus:ring-amber-400" />
                      <input type="tel" placeholder="WhatsApp *"
                        value={form.whatsapp}
                        onChange={e => set('whatsapp', e.target.value)}
                        className="flex-1 min-w-0 border border-gray-300 rounded-r-lg px-2 py-3 bg-[#efe7dd] focus:outline-none focus:ring-2 focus:ring-amber-400" />
                    </div>
                    <label className="flex items-center gap-2 mt-2 text-xs cursor-pointer" style={{ color: '#eddbc3' }}>
                      <input type="checkbox" checked={form.samePhone}
                        onChange={e => {
                          set('samePhone', e.target.checked)
                          if (e.target.checked) { set('whatsapp', form.phone.replace(/^0/, '')); set('whatsappCountryCode', '+971') }
                        }}
                        className="accent-amber-500" />
                      Same as mobile
                    </label>
                  </div>
                </div>
              </section>

              {/* 3. YOUR LOGIN DETAILS */}
              <section className="flex flex-col gap-4">
                <p className="uppercase tracking-widest mb-1" style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#f9d174', fontSize: '1rem' }}>3. Your Login Details</p>
                <input type="email" placeholder="Email address *"
                  value={form.email} onChange={e => set('email', e.target.value)}
                  className="w-full rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  style={{ background: 'transparent', border: '2px solid #f9d174', color: '#eddbc3' }} />
                <div id="field-password">
                  <div className="relative">
                    <input type={showPassword ? 'text' : 'password'} placeholder="Create a password *"
                      value={form.password} onChange={e => { set('password', e.target.value); setFieldErrors(prev => ({ ...prev, password: '' })) }}
                      className="w-full rounded-lg px-4 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-amber-400"
                      style={{ background: 'transparent', border: '2px solid #f9d174', color: '#eddbc3' }} />
                    <button type="button" onClick={() => setShowPassword(v => !v)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm">
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  {fieldErrors.password && <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#e57451', fontSize: '0.95rem', marginTop: '4px', paddingLeft: '4px' }}>{fieldErrors.password}</p>}
                </div>
              </section>

              {/* 4. DELIVERY ADDRESS */}
              <section className="flex flex-col gap-4">
                <p className="uppercase tracking-widest mb-1" style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#f9d174', fontSize: '1rem' }}>4. Delivery Address</p>
                <div className="relative" style={{ overflow: 'visible' }}>
                  <img src="/bonky_signup_2.png" alt="" style={{ position: 'absolute', top: '-28px', left: '0', height: '120px', width: 'auto', pointerEvents: 'none' }} />
                  <div className="flex gap-3" style={{ width: '65%', marginLeft: 'auto', paddingLeft: '12px' }}>
                    {[{ value: 'villa', label: 'Villa' }, { value: 'flat', label: 'Apartment' }].map(opt => (
                      <button key={opt.value} type="button" onClick={() => set('houseType', opt.value)}
                        style={{
                          fontFamily: 'var(--font-amatic)',
                          fontSize: '1.5rem',
                          letterSpacing: '0.04em',
                          color: '#eddbc3',
                          backgroundImage: form.houseType === opt.value ? 'url(/orange_box.png)' : 'url(/blue_box.png)',
                          backgroundSize: '100% 100%',
                          backgroundRepeat: 'no-repeat',
                        }}
                        className="flex-1 py-3 pb-5 font-bold transition-all border-none bg-transparent">
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <input type="text" placeholder="Villa or Apartment number *"
                  value={form.villaFlat} onChange={e => set('villaFlat', e.target.value)}
                  className={inputClass} />
                {form.houseType === 'flat' && (
                  <input type="text" placeholder="Building Name *"
                    value={form.building} onChange={e => set('building', e.target.value)}
                    className={inputClass} />
                )}
                <input type="text" placeholder="Street *"
                  value={form.street} onChange={e => set('street', e.target.value)}
                  className={inputClass} />
                <div className="flex gap-3">
                  <select value={form.community} onChange={e => set('community', e.target.value)} className={inputClass} style={{ flex: 1, appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1L6 7L11 1' stroke='%23888' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round' fill='none'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', paddingRight: '2rem' }}>
                    <option value="">Select your community *</option>
                    {communities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <input type="text" readOnly value={form.city} className={inputClass + ' cursor-not-allowed'} style={{ width: '86px', flexShrink: 0, textAlign: 'center' }} />
                </div>
                <input type="text" placeholder="Delivery Instructions (optional)"
                  value={form.deliveryNotes} onChange={e => set('deliveryNotes', e.target.value)}
                  className={inputClass} />
              </section>

              {/* 5. DELIVERY PREFERENCE */}
              <section className="flex flex-col gap-4">
                <p className="uppercase tracking-widest mb-1" style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#f9d174', fontSize: '1rem' }}>5. How should we deliver and collect your books?</p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { value: 'leave_at_door', label: 'At the door', sub: 'Contactless' },
                    { value: 'leave_safe_spot', label: 'Safe spot', sub: 'Contactless' },
                    { value: 'ring_bell', label: 'Ring the bell', sub: 'Someone will be home' },
                    { value: 'call_no_bell', label: "Call me", sub: "Don't ring bell" },
                    { value: 'leave_with_reception', label: 'Reception', sub: 'Security / concierge' },
                  ].map(opt => (
                    <button key={opt.value} type="button" onClick={() => set('deliveryPreference', opt.value)}
                      className="flex flex-col items-center justify-center text-center px-2 py-3 rounded-xl transition-all border-[3px]"
                      style={{
                        borderColor: form.deliveryPreference === opt.value ? '#e57451' : 'rgba(237,219,195,0.3)',
                        backgroundColor: 'rgba(255,255,255,0.04)',
                      }}>
                      <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#eddbc3', fontSize: '1rem', fontWeight: 600 }}>{opt.label}</span>
                      <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#eddbc3', fontSize: '0.85rem', opacity: 0.6, marginTop: '2px' }}>{opt.sub}</span>
                    </button>
                  ))}
                </div>
                {form.deliveryPreference === 'leave_safe_spot' && (
                  <input type="text" placeholder="Describe the safe spot" className={inputClass}
                    value={form.safeSpotDescription} onChange={e => set('safeSpotDescription', e.target.value)} />
                )}
              </section>

              {/* 6. PAYMENT */}
              <section className="flex flex-col gap-5">
                <div className="relative mb-1" style={{ overflow: 'visible' }}>
                  <p className="uppercase tracking-widest" style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#f9d174', fontSize: '1rem' }}>6. Review</p>
                  <img src="/bonky_signup_3.png" alt="" style={{ position: 'absolute', top: '-58px', right: '0', height: '120px', width: 'auto', pointerEvents: 'none' }} />
                </div>

                  {/* Your order */}
                  <div className="rounded-2xl p-5" style={{ backgroundColor: '#efe7dd' }}>
                    <p className="font-bold text-gray-800 mb-3 flex items-center gap-2" style={{ fontFamily: 'var(--font-cormorant), serif', fontSize: '1.5rem' }}>Your order <img src="/star_button_on.png" alt="" style={{ width: '18px', height: '18px', objectFit: 'contain' }} /></p>
                    <div className="flex flex-col gap-2 text-base text-gray-600">
                      <div className="flex justify-between">
                        <span>Plan</span>
                        <div className="flex flex-col items-end">
                          <span className="font-semibold text-gray-800" style={{ fontFamily: 'var(--font-cormorant), serif', fontSize: '1.4rem' }}>{selectedPlan.label}</span>
                          <span className="text-gray-600" style={{ fontFamily: 'var(--font-cormorant), serif', fontSize: '1.1rem', lineHeight: 1 }}>{selectedPlan.books} books / month</span>
                        </div>
                      </div>
                      <div className="flex justify-between">
                        <span>Delivery</span>
                        <span className="font-semibold text-green-600" style={{ fontFamily: 'var(--font-cormorant), serif', fontSize: '1.4rem' }}>Free</span>
                      </div>
                      <div className="flex justify-between border-t border-gray-300 pt-2 mt-1">
                        <span className="font-bold text-gray-900" style={{ fontFamily: 'var(--font-cormorant), serif', fontSize: '1.4rem' }}>First Payment</span>
                        <span className="font-black text-gray-900" style={{ fontFamily: 'var(--font-cormorant), serif', fontSize: '1.4rem' }}>AED {selectedPlan.price}</span>
                      </div>
                    </div>
                  </div>

                  {/* A Few Important Bits */}
                  <div className="rounded-2xl p-5" style={{ backgroundColor: '#efe7dd' }}>
                    <p className="font-black mb-3 flex items-center gap-2" style={{ fontFamily: 'var(--font-cormorant), serif', color: '#374151', fontSize: '1.7rem' }}>
                      <img src="/whiskers_left.png" alt="" style={{ height: '32px', width: 'auto' }} />
                      A few important bits
                      <img src="/whiskers_right.png" alt="" style={{ height: '32px', width: 'auto' }} />
                    </p>
                    <ul className="flex flex-col gap-2">
                      {[
                        'Your membership renews automatically each month.',
                        'You can pause, cancel or change your membership at any time.',
                        'If you cancel or pause, books should be returned within 14 days.',
                        'Lost or heavily damaged books may incur a replacement charge.',
                        'Books remain the property of Bonkers Book Club unless purchased.',
                      ].map((item, i) => (
                        <li key={i} className="flex items-start gap-2" style={{ color: '#374151', fontSize: '1.05rem' }}>
                          <img src="/checkmark_orange.png" alt="" style={{ width: '16px', height: '16px', marginTop: '2px', flexShrink: 0 }} />
                          <span style={{ fontFamily: 'var(--font-montserrat), sans-serif', letterSpacing: '0.02em' }}>{item}</span>
                        </li>
                      ))}
                    </ul>
                    <div id="field-terms" className="mt-4">
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input type="checkbox" checked={form.agreedToTerms}
                          onChange={e => { set('agreedToTerms', e.target.checked); setFieldErrors(prev => ({ ...prev, terms: '' })) }}
                          className="accent-amber-500 mt-1" />
                        <span className="text-sm" style={{ color: '#374151' }}>
                          I have read and agree to the{' '}
                          <span className="text-blue-400 underline cursor-pointer">Membership Rules</span>,{' '}
                          <span className="text-blue-400 underline cursor-pointer">Terms &amp; Conditions</span>
                          {' '}and{' '}
                          <span className="text-blue-400 underline cursor-pointer">Privacy Policy</span>.
                        </span>
                      </label>
                      {fieldErrors.terms && <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#e57451', fontSize: '0.95rem', marginTop: '4px', paddingLeft: '4px' }}>{fieldErrors.terms}</p>}
                    </div>
                  </div>

                  <hr style={{ borderColor: '#eddbc3', opacity: 0.3 }} />

                  {/* Payment method */}
                  <div className="flex flex-col gap-3">
                    <p className="font-black uppercase tracking-widest flex items-center gap-2" style={{ fontFamily: 'var(--font-cormorant), serif', color: '#eddbc3', fontSize: '1.2rem' }}>
                      Payment Method
                    </p>
                    {[
                      { value: 'card', label: 'Credit / Debit Card' },
                      { value: 'apple', label: 'Apple Pay' },
                      { value: 'tabby', label: 'Tabby - Buy now, pay later' },
                    ].map(method => (
                      <label key={method.value} className="flex items-center gap-3 p-3 rounded-xl cursor-pointer hover:border-amber-300 text-sm" style={{ backgroundColor: '#efe7dd', border: '2px solid transparent' }}>
                        <input type="radio" name="paymentMethod" value={method.value} defaultChecked={method.value === 'card'} className="accent-amber-500" />
                        <span className="text-gray-700">{method.label}</span>
                      </label>
                    ))}
                  </div>

                  <hr style={{ borderColor: '#eddbc3', opacity: 0.3 }} />

                  {/* How did you hear */}
                  <div className="flex flex-col gap-3">
                    <p className="font-bold" style={{ fontFamily: 'var(--font-cormorant), serif', color: '#eddbc3', fontSize: '1.4rem', lineHeight: '1.1' }}>How did you hear about us? <span style={{ fontWeight: 400, opacity: 0.7, fontSize: '1rem' }}>(Optional)</span></p>
                    <select value={form.hearAboutUs} onChange={e => { set('hearAboutUs', e.target.value); set('hearDetail', '') }} className={inputClass}>
                      <option value="">Please select</option>
                      {HOW_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    {selectedHowOption?.followUp && (
                      <input type="text" placeholder={selectedHowOption.followUp} value={form.hearDetail} onChange={e => set('hearDetail', e.target.value)} className={inputClass} />
                    )}
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input type="checkbox" checked={form.agreedToMarketing}
                        onChange={e => set('agreedToMarketing', e.target.checked)}
                        className="accent-amber-500 mt-1" />
                      <span className="text-sm" style={{ color: '#eddbc3' }}>I'd like to receive updates, offers and news from Bonkers Book Club</span>
                    </label>
                  </div>


                  {/* Submit button */}
                  <div className="relative flex items-center justify-center" style={{ width: '85%', maxWidth: '300px', margin: '8px auto 0' }}>
                    <img src="/whiskers_left.png" alt="" style={{ position: 'absolute', left: '-15px', height: '50px', width: 'auto', zIndex: 1, pointerEvents: 'none' }} />
                    <div style={{ position: 'relative', width: '100%', paddingBottom: 'calc(100% / 2.97)' }}>
                      <button type="submit" disabled={loading}
                        className="disabled:cursor-not-allowed flex items-center justify-center border-none bg-transparent"
                        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', backgroundImage: 'url(/button2.png)', backgroundSize: '100% 100%', backgroundRepeat: 'no-repeat' }}>
                        <span className="relative z-10 flex items-center gap-2 text-2xl text-white" style={{ fontFamily: 'var(--font-amatic)', fontWeight: 700, letterSpacing: '0.04em', marginBottom: '5px' }}>
                          {loading ? 'Setting up...' : 'Complete Sign Up'}
                          {!loading && <img src="/magicwand.png" alt="" style={{ height: '22px', width: 'auto' }} />}
                        </span>
                      </button>
                    </div>
                    <img src="/whiskers_right.png" alt="" style={{ position: 'absolute', right: '-15px', height: '50px', width: 'auto', zIndex: 1, pointerEvents: 'none' }} />
                  </div>
                  <p className="text-center text-xs -mt-4" style={{ color: '#eddbc3', opacity: 0.7 }}>Secure checkout. Your data is safe with us.</p>

              </section>

            </form>

            <div className="mt-10 pt-6 border-t border-gray-200">
              <p className="text-sm font-bold text-gray-800">Questions? We&apos;re here to help!</p>
              <p className="text-sm text-gray-500 mt-1">
                WhatsApp us on +971 50 123 4567 or email{' '}
                <span className="text-blue-600 underline">hello@bonkersbookclub.ae</span>
              </p>
            </div>
        </div>
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
