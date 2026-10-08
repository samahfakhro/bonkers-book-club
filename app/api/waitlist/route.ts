import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { checkAvailability } from '@/lib/membership/availability'

type GeoComponent = { long_name: string; types: string[] }

// Community name for waitlist demand (e.g. "Arabian Ranches", "Mirdif") from the map pin.
// Prefers Google's neighbourhood (developer community), falls back to the official area.
async function lookUpArea(lat: unknown, lng: unknown): Promise<{ community: string | null; address: string | null }> {
  const none = { community: null, address: null }
  if (typeof lat !== 'number' || typeof lng !== 'number') return none
  try {
    const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY}`)
    const results: { formatted_address: string; address_components: GeoComponent[] }[] = (await res.json()).results ?? []
    const find = (type: string) => {
      for (const r of results) for (const c of r.address_components) if (c.types.includes(type)) return c.long_name
      return null
    }
    return {
      community: find('neighborhood') ?? find('sublocality_level_1') ?? find('sublocality'),
      address: results[0]?.formatted_address ?? null,
    }
  } catch {
    return none
  }
}

// Saves a waitlist entry with the internal reason + zone worked out here (never trusted from the browser).
// One entry per email — a repeat updates the existing entry.
export async function POST(request: NextRequest) {
  try {
    const { name, email, phone, lat, lng, address, area, propertyType } = await request.json()
    const cleanEmail = String(email ?? '').trim().toLowerCase()
    if (!cleanEmail) return NextResponse.json({ error: 'Missing email' }, { status: 400 })

    const [availability, place] = await Promise.all([checkAvailability(lat, lng), lookUpArea(lat, lng)])
    const entry = {
      name: name || null,
      email: cleanEmail,
      phone: phone || null,
      address: address || place.address,
      community_name: area || place.community,
      property_type: propertyType || null,
      latitude: typeof lat === 'number' ? lat : null,
      longitude: typeof lng === 'number' ? lng : null,
      zone_id: availability.zoneId,
      reason: availability.canJoin ? null : availability.reason,
      status: 'waiting',
    }

    const { data: existing } = await supabaseAdmin
      .from('waitlist_signup').select('id').eq('email', cleanEmail)
      .order('created_at', { ascending: false }).limit(1).maybeSingle()

    const { error } = existing
      ? await supabaseAdmin.from('waitlist_signup').update(entry).eq('id', existing.id)
      : await supabaseAdmin.from('waitlist_signup').insert({ ...entry, interest_level: 3 })

    if (error) {
      console.error('Waitlist save error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('waitlist error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
