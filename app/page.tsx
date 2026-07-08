'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Step = 'welcome' | 'check' | 'eligible' | 'waitlist' | 'waitlist-done'

type Community = {
  id: string
  name: string
  accepted_property_types: string[]
}

export default function Home() {
  const searchParams = useSearchParams()
  const [step, setStep] = useState<Step>(searchParams.get('step') === 'check' ? 'check' : 'welcome')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const [communities, setCommunities] = useState<Community[]>([])
  const [form, setForm] = useState({
    communityId: '',
    communityName: '',
    propertyType: '',
  })
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const [waitlistForm, setWaitlistForm] = useState({
    name: '',
    email: '',
    manualCommunity: '',
    interestLevel: '3',
    propertyType: '',
    buildingName: '',
    whatsapp: '',
  })

  // Load active communities on page load
  useEffect(() => {
    const loadCommunities = async () => {
      const { data } = await supabase
        .from('communities')
        .select('id, name, accepted_property_types')
        .eq('is_active', true)
        .order('name')
      if (data) setCommunities(data)
    }
    loadCommunities()
  }, [])

  const selectedCommunity = communities.find(c => c.id === form.communityId)

  const handleCheck = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCommunity) return

    const acceptedTypes: string[] = selectedCommunity.accepted_property_types || []
    if (acceptedTypes.includes(form.propertyType)) {
      router.push(`/signup?community=${encodeURIComponent(form.communityId)}&type=${form.propertyType}`)
    } else {
      setWaitlistForm(prev => ({ ...prev, propertyType: form.propertyType }))
      setStep('waitlist')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const handleWaitlist = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    await supabase.from('waitlist_signup').insert({
      email: waitlistForm.email,
      community_name: form.communityName || waitlistForm.manualCommunity,
      interest_level: parseInt(waitlistForm.interestLevel),
      name: waitlistForm.name,
      phone: null,
      address: waitlistForm.buildingName || null,
      property_type: waitlistForm.propertyType || form.propertyType || null,
      children_count: null,
      children_ages: null,
    })

    setLoading(false)
    setStep('waitlist-done')
  }

  const goToWaitlist = () => {
    setWaitlistForm(prev => ({ ...prev, propertyType: form.propertyType }))
    setStep('waitlist')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <main className={`min-h-screen flex flex-col items-center px-4 py-12 ${step === 'welcome' ? 'justify-start pt-8' : 'justify-start'}`} style={{ backgroundImage: 'url(/background_3.png)', backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed', paddingTop: 'max(3rem, env(safe-area-inset-top))', paddingBottom: 'max(3rem, env(safe-area-inset-bottom))' }}>

      {step === 'welcome' && (
        <button onClick={() => router.push('/login')} className="flex flex-col items-center gap-1" style={{ position: 'fixed', top: '40px', right: '20px', fontFamily: 'var(--font-amatic), sans-serif', color: '#eddbc3', fontSize: '1.6rem', zIndex: 100 }}>
          <span className="flex items-center gap-1">
            <img src="/star_button_on.png" alt="" style={{ height: '16px', width: '16px' }} />
            Log in
            <img src="/arrow_cream.png" alt="" style={{ height: '16px', width: 'auto' }} />
          </span>
        </button>
      )}

      <div className="w-full flex flex-col items-center">

      {/* STEP 0: Welcome */}
      {step === 'welcome' && (
        <div className="w-full flex flex-col items-center text-center px-4" style={{ maxWidth: '520px' }}>

          {/* Owl image */}
          <img src="/Bonkers_Image_Logo.png" alt="Bonkers owl" className="w-full h-auto" style={{ maxWidth: '190px', marginBottom: '-10px' }} />

          {/* Word logo */}
          <img src="/Bonkers_Word_Logo_White1.png" alt="Bonkers Book Club" className="w-full h-auto" style={{ maxWidth: '340px', marginTop: '-22px' }} />

          {/* Strapline */}
          <p style={{ fontFamily: 'var(--font-cormorant), serif', color: '#eddbc3', fontSize: '1.7rem', fontWeight: 600, marginTop: '-14px' }}>
            Stories that come to you.
          </p>
          <img src="/underlines_3.png" alt="" style={{ width: '80%', maxWidth: '300px', height: 'auto', marginTop: '1px' }} />

          {/* Description */}
          <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', color: '#eddbc3', fontSize: '1.05rem', letterSpacing: '0.06em', marginTop: '20px', lineHeight: '1.2', maxWidth: '360px' }}>
            A curated children's library with books delivered and collected from your doorstep.
          </p>

          {/* Three icons */}
          <div style={{ marginTop: '28px', width: '100%' }}>
            {/* Icons row — dividers centred with images */}
            <div className="flex items-center justify-center w-full">
              <div className="flex justify-center" style={{ width: '30%' }}>
                <img src="/Book_Stack.png" alt="Books" style={{ height: '50px', width: 'auto' }} />
              </div>
              <img src="/divider_vertical.png" alt="" style={{ height: '60px', width: 'auto', marginLeft: '8px', marginRight: '8px' }} />
              <div className="flex justify-center" style={{ width: '30%' }}>
                <img src="/van.png" alt="Delivery van" style={{ height: '50px', width: 'auto' }} />
              </div>
              <img src="/divider_vertical.png" alt="" style={{ height: '60px', width: 'auto', marginLeft: '8px', marginRight: '8px' }} />
              <div className="flex justify-center" style={{ width: '30%' }}>
                <img src="/magic_book.png" alt="Magic book" style={{ height: '50px', width: 'auto' }} />
              </div>
            </div>
            {/* Text row */}
            <div className="flex justify-center w-full" style={{ marginTop: '8px' }}>
              <p className="text-center" style={{ width: '34%', fontFamily: 'var(--font-montserrat), sans-serif', color: '#eddbc3', fontSize: '0.85rem', lineHeight: '1.1', letterSpacing: '0.03em', marginLeft: '-8px' }}>
                Brilliant books.<br/>No boring allowed.
              </p>
              <div style={{ width: '5%' }} />
              <p className="text-center" style={{ width: '30%', fontFamily: 'var(--font-montserrat), sans-serif', color: '#eddbc3', fontSize: '0.85rem', lineHeight: '1.1', letterSpacing: '0.03em' }}>
                We do the running.
              </p>
              <div style={{ width: '5%' }} />
              <p className="text-center" style={{ width: '30%', fontFamily: 'var(--font-montserrat), sans-serif', color: '#eddbc3', fontSize: '0.85rem', lineHeight: '1.1', letterSpacing: '0.03em' }}>
                Fresh stories<br/>whenever you're ready.
              </p>
            </div>
          </div>

          {/* Join the Club button */}
          <div className="relative flex items-center justify-center" style={{ width: '71%', maxWidth: '260px', marginTop: '18px' }}>
            <img src="/whiskers_left.png" alt="" style={{ position: 'absolute', left: '-15px', height: '50px', width: 'auto', zIndex: 1, pointerEvents: 'none' }} />
            <div style={{ position: 'relative', width: '100%', paddingBottom: 'calc(100% / 2.97)' }}>
              <button
                onClick={() => { setStep('check'); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                className="flex items-center justify-center border-none bg-transparent cursor-pointer"
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', backgroundImage: 'url(/button2.png)', backgroundSize: '100% 100%', backgroundRepeat: 'no-repeat' }}>
                <span className="relative z-10 flex items-center text-2xl text-white" style={{ fontFamily: 'var(--font-amatic)', fontWeight: 700, letterSpacing: '0.04em', marginBottom: '9px' }}>
                  Join the Club <span style={{ display: 'inline-block', transform: 'translateY(-4px)', marginLeft: '4px' }}>→</span>
                </span>
              </button>
            </div>
            <img src="/whiskers_right.png" alt="" style={{ position: 'absolute', right: '-15px', height: '50px', width: 'auto', zIndex: 1, pointerEvents: 'none' }} />
          </div>

        </div>
      )}

      {/* STEP 1: Eligibility Check */}
      {step === 'check' && (
        <div className="w-full flex flex-col items-center px-4 pb-6" style={{ maxWidth: '490px', marginTop: '0px' }}>
          {/* Logo at top */}
          <img src="/Bonkers_Word_Logo_White1.png" alt="Bonkers Book Club" className="h-auto" style={{ width: '160px', display: 'block', margin: '0 auto 24px' }} />
          <div className="text-center w-full">
            <h2 className="font-black" style={{ fontFamily: 'var(--font-cormorant), serif', color: '#eddbc3', fontSize: '2.6rem', lineHeight: '0.95', marginTop: '-12px' }}>
              Do we deliver to your area?
            </h2>
          </div>

          <img src="/map_eligibility.png" alt="" className="w-full h-auto" style={{ marginTop: '24px' }} />

          <form onSubmit={handleCheck} className="flex flex-col gap-0 w-full">
            <div style={{ marginTop: '40px' }}>
{communities.length === 0 ? (
                <div className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-400 bg-white">
                  Loading communities...
                </div>
              ) : (
                <div ref={dropdownRef} style={{ position: 'relative', width: '85%', margin: '0 auto' }}>
                  {/* Bird peering over box */}
                  <img src="/bonky_box.png" alt="" style={{ position: 'absolute', top: '-38px', left: '-8px', height: '50px', width: 'auto', zIndex: 10, pointerEvents: 'none' }} />
                  {/* Trigger button */}
                  <button type="button" onClick={() => setDropdownOpen(o => !o)}
                    style={{ width: '100%', backgroundColor: '#efe7dd', border: 'none', borderRadius: '12px', fontFamily: 'var(--font-nunito), sans-serif', fontSize: '1.1rem', cursor: 'pointer', textAlign: 'center', padding: '14px 2.5rem 14px 1rem', color: form.communityId ? '#1a1a1a' : '#3d3d3d', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {form.communityName || 'Select your community...'}
                    <svg style={{ position: 'absolute', right: '1rem', top: '50%', transform: dropdownOpen ? 'translateY(-50%) rotate(180deg)' : 'translateY(-50%)', transition: 'transform 0.2s', pointerEvents: 'none' }} width="12" height="8" viewBox="0 0 12 8" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 1L6 7L11 1" stroke="#555" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </button>
                  {/* Dropdown list */}
                  {dropdownOpen && (
                    <div style={{ position: 'absolute', top: '100%', left: '0', right: '0', backgroundColor: '#efe7dd', borderRadius: '12px', zIndex: 50, marginTop: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                      <div
                          onClick={() => { setForm({ ...form, communityId: '', communityName: '', propertyType: '' }); setDropdownOpen(false) }}
                          style={{ padding: '12px 20px', fontFamily: 'var(--font-nunito), sans-serif', fontSize: '1.1rem', cursor: 'pointer', borderBottom: '1px solid rgba(0,0,0,0.08)', color: '#3d3d3d' }}
                          className="hover:bg-white transition-colors">
                          Select your community...
                        </div>
                      {communities.map(c => (
                        <div key={c.id}
                          onClick={() => { setForm({ ...form, communityId: c.id, communityName: c.name, propertyType: '' }); setDropdownOpen(false) }}
                          style={{ padding: '12px 20px', fontFamily: 'var(--font-nunito), sans-serif', fontSize: '1.1rem', cursor: 'pointer', borderBottom: '1px solid rgba(0,0,0,0.08)', color: '#1a1a1a' }}
                          className="hover:bg-white transition-colors">
                          {c.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div style={{ marginTop: '28px' }}>
              <label className="block text-sm font-semibold text-gray-700 mb-0" style={{ fontFamily: 'var(--font-cormorant), serif', color: '#eddbc3', textAlign: 'center', fontSize: '1.5rem' }}>
                Your home type:
              </label>
              <div className="flex gap-3" style={{ marginTop: '4px', width: '80%', margin: '4px auto 0' }}>
                {['villa', 'apartment'].map(type => (
                  <button key={type} type="button"
                    onClick={() => setForm({ ...form, propertyType: type })}
                    style={{
                      fontFamily: 'var(--font-amatic)',
                      fontSize: '1.5rem',
                      letterSpacing: '0.04em',
                      color: '#eddbc3',
                      backgroundImage: form.propertyType === type ? 'url(/orange_box.png)' : 'url(/blue_box.png)',
                      backgroundSize: '100% 100%',
                      backgroundRepeat: 'no-repeat',
                    }}
                    className="flex-1 py-3 pb-5 font-bold capitalize transition-all border-none bg-transparent">
                    {type === 'villa' ? 'Villa' : 'Apartment'}
                  </button>
                ))}
              </div>
            </div>

            <div className="relative flex items-center justify-center" style={{ margin: '4px auto 0', width: '75%', maxWidth: '260px' }}>
              <img src="/whiskers_left.png" alt="" style={{ position: 'absolute', left: '-15px', height: '50px', width: 'auto', zIndex: 1 }} />
              <div style={{ position: 'relative', width: '100%', paddingBottom: 'calc(100% / 2.97)' }}>
                <button type="submit"
                  disabled={!form.communityId || !form.propertyType}
                  className="disabled:cursor-not-allowed flex items-center justify-center border-none bg-transparent"
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', backgroundImage: 'url(/button2.png)', backgroundSize: '100% 100%', backgroundRepeat: 'no-repeat' }}>
                  <span className="relative z-10 flex items-center gap-2 text-2xl text-white" style={{ fontFamily: 'var(--font-amatic)', fontWeight: 700, letterSpacing: '0.04em', marginBottom: '5px' }}>
                    Check My Area
                    <img src="/magicwand.png" alt="" style={{ height: '22px', width: 'auto' }} />
                  </span>
                </button>
              </div>
              <img src="/whiskers_right.png" alt="" style={{ position: 'absolute', right: '-15px', height: '50px', width: 'auto', zIndex: 1 }} />
            </div>
          </form>

          <button onClick={goToWaitlist} className="w-full border-none bg-transparent p-0 cursor-pointer" style={{ position: 'relative', display: 'block' }}>
            <img src="/parchment_community.png" alt="" className="h-auto" style={{ width: '90%', display: 'block', margin: '0 auto' }} />
            <span style={{ position: 'absolute', top: '42%', left: '50%', transform: 'translate(-50%, -50%)', fontFamily: 'var(--font-cormorant), serif', fontSize: '1rem', color: '#1a0a00', whiteSpace: 'nowrap' }}>
              Can&apos;t find your community?
            </span>
            <span style={{ position: 'absolute', top: '65%', left: '51%', transform: 'translate(-50%, -50%)', fontFamily: 'var(--font-cormorant), serif', fontSize: '1.2rem', color: '#d64329', whiteSpace: 'nowrap', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '7px' }}>
              Join our waitlist
              <svg width="18" height="14" viewBox="0 0 18 14" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginTop: '6px' }}>
                <line x1="0" y1="7" x2="14" y2="7" stroke="#d64329" strokeWidth="1.5"/>
                <line x1="8" y1="1" x2="14" y2="7" stroke="#d64329" strokeWidth="1.5"/>
                <line x1="8" y1="13" x2="14" y2="7" stroke="#d64329" strokeWidth="1.5"/>
              </svg>
            </span>
          </button>
        </div>
      )}

      {/* STEP 2: Eligible */}
      {step === 'eligible' && (
        <div className="bg-white rounded-3xl shadow-lg p-8 w-full max-w-md text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            Great news!
          </h2>
          <p className="text-gray-500 text-sm mb-6">
            Bonkers Book Club delivers to <span className="font-semibold text-gray-700">{form.communityName}</span>! Let&apos;s get your family set up.
          </p>
          <button
            onClick={() => router.push(`/signup?community=${encodeURIComponent(form.communityId)}&type=${form.propertyType}`)}
            className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 rounded-xl transition-all text-sm"
          >
            Join Bonkers Book Club →
          </button>
          <button
            onClick={() => { setStep('check'); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
            className="mt-3 text-sm text-gray-400 hover:text-gray-600"
          >
            ← Go back
          </button>
        </div>
      )}

      {/* STEP 3: Waitlist Form */}
      {step === 'waitlist' && (
        <div className="rounded-3xl shadow-xl px-4 pb-8 w-full flex flex-col" style={{ maxWidth: '640px', backgroundColor: 'transparent', position: 'relative', marginTop: '0px' }}>
          <img src="/Bonkers_Word_Logo_White1.png" alt="Bonkers Book Club" className="h-auto" style={{ width: '160px', display: 'block', margin: '0 auto 24px' }} />
          <div className="text-center mb-4">
            <h2 className="font-black" style={{ fontFamily: 'var(--font-cormorant), serif', color: '#eddbc3', fontSize: '2rem', lineHeight: '0.95', marginTop: '-12px' }}>
              Bonkers hasn&apos;t reached your area...<span style={{ color: '#ebb34d' }}>yet!</span>
            </h2>
            <p className="mt-1" style={{ fontFamily: 'var(--font-cormorant), serif', color: '#eddbc3', fontSize: '1.45rem', marginTop: '14px', lineHeight: '1.1' }}>
              Our map grows a little bigger every month. Leave your email and we&apos;ll let you know the moment Bonkers arrives in your neighbourhood.
            </p>
          </div>

          <img src="/map_bonkers.png" alt="" className="w-full h-auto" style={{ marginTop: '6px' }} />

          <form onSubmit={handleWaitlist} className="flex flex-col gap-3">

            {/* Where do you call home */}
            <p className="text-center" style={{ fontFamily: 'var(--font-cormorant), serif', fontSize: '1.5rem', color: '#eddbc3', fontWeight: 700, marginTop: '32px', lineHeight: '1.1' }}>
              Where do you live?
            </p>

            {/* Community */}
            <div style={{ width: '85%', margin: '0 auto' }}>
              <input
                type="text"
                placeholder="Type community name or area"
                value={form.communityName || waitlistForm.manualCommunity}
                onChange={e => !form.communityName && setWaitlistForm({ ...waitlistForm, manualCommunity: e.target.value })}
                readOnly={!!form.communityName}
                className="w-full rounded-xl focus:outline-none"
                style={{ backgroundColor: '#efe7dd', border: 'none', fontFamily: 'var(--font-nunito), sans-serif', fontSize: '1.1rem', padding: '14px 1rem', opacity: form.communityName ? 0.8 : 1, textAlign: 'center' }}
              />
            </div>

            {/* Email centred */}
            <div style={{ width: '85%', margin: '16px auto 0' }}>
              <input
                type="email"
                required
                placeholder="Email address"
                value={waitlistForm.email}
                onChange={e => setWaitlistForm({ ...waitlistForm, email: e.target.value })}
                className="w-full rounded-xl focus:outline-none"
                style={{ backgroundColor: '#efe7dd', border: 'none', fontFamily: 'var(--font-nunito), sans-serif', fontSize: '1.1rem', padding: '14px 1rem', textAlign: 'center' }}
              />
            </div>

            {/* Home type */}
            <div style={{ marginTop: '8px' }}>
              <label className="block mb-1" style={{ fontFamily: 'var(--font-cormorant), serif', color: '#eddbc3', fontSize: '1.5rem', textAlign: 'center' }}>Your home type:</label>
              <div className="flex gap-3" style={{ width: '80%', margin: '4px auto 0' }}>
                {['villa', 'apartment'].map(type => (
                  <button key={type} type="button"
                    onClick={() => setWaitlistForm({ ...waitlistForm, propertyType: type })}
                    style={{
                      fontFamily: 'var(--font-amatic)',
                      fontSize: '1.5rem',
                      letterSpacing: '0.04em',
                      color: '#eddbc3',
                      backgroundImage: waitlistForm.propertyType === type ? 'url(/orange_box.png)' : 'url(/blue_box.png)',
                      backgroundSize: '100% 100%',
                      backgroundRepeat: 'no-repeat',
                    }}
                    className="flex-1 py-3 pb-5 font-bold capitalize transition-all border-none bg-transparent">
                    {type === 'villa' ? 'Villa' : 'Apartment'}
                  </button>
                ))}
              </div>
            </div>

            {/* Submit */}
            <div className="relative flex items-center justify-center" style={{ width: '75%', maxWidth: '260px', margin: '4px auto 0' }}>
              <img src="/whiskers_left.png" alt="" style={{ position: 'absolute', left: '-15px', height: '50px', width: 'auto', zIndex: 1 }} />
              <div style={{ position: 'relative', width: '100%', paddingBottom: 'calc(100% / 2.97)' }}>
                <button type="submit" disabled={loading}
                  className="disabled:cursor-not-allowed flex items-center justify-center border-none bg-transparent"
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', backgroundImage: 'url(/button2.png)', backgroundSize: '100% 100%', backgroundRepeat: 'no-repeat' }}>
                  <span className="relative z-10 flex items-center gap-2 text-2xl text-white" style={{ fontFamily: 'var(--font-amatic)', fontWeight: 700, letterSpacing: '0.04em', marginBottom: '8px' }}>
                    {loading ? 'Joining...' : 'Join the Waitlist'}
                  </span>
                </button>
              </div>
              <img src="/whiskers_right.png" alt="" style={{ position: 'absolute', right: '-15px', height: '50px', width: 'auto', zIndex: 1 }} />
            </div>
          </form>

          <button onClick={() => { setStep('check'); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
            className="w-full text-center" style={{ color: '#eddbc3', opacity: 0.7, fontFamily: 'var(--font-cormorant), serif', fontSize: '1.3rem', marginTop: '-4px' }}>
            ← Go back
          </button>
        </div>
      )}

      {/* STEP 4: Waitlist Done */}
      {step === 'waitlist-done' && (
        <div className="bg-white rounded-3xl shadow-lg p-8 w-full max-w-md text-center">
          <div className="text-6xl mb-4">🐣</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            You&apos;re on the list!
          </h2>
          <p className="text-gray-500 text-sm">
            We&apos;ll let you know as soon as Bonkers lands in your area. Good things come to those who wait... especially when those things are books. 📚
          </p>
        </div>
      )}

      </div>
    </main>
  )
}
