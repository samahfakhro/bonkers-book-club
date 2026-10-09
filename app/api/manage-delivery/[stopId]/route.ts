import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { FAILED_DELIVERY, manageLinkOpen } from '@/lib/driver/server'

type Ctx = { params: Promise<{ stopId: string }> }
const RESPONSES = ['retry_today', 'neighbour', 'concierge', 'safe_drop', 'next_bonkers_day'] as const

// Only the signed-in parent of this household may see or answer their missed visit
async function loadForParent(req: NextRequest, stopId: string) {
  const token = req.headers.get('authorization')?.replace(/^Bearer /, '')
  if (!token) return { error: 'Please sign in', status: 401 }
  const { data: { user } } = await supabaseAdmin.auth.getUser(token)
  if (!user) return { error: 'Please sign in', status: 401 }
  const { data: stop } = await supabaseAdmin
    .from('route_stops')
    .select('id, outcome, status, expected_deliveries_count, expected_collections_count, family_response, family_response_details, family_responded_at, household_id, routes(status, route_date), households(user_id, first_name, property_type, safe_spot_description, neighbour_details)')
    .eq('id', stopId).single()
  if (!stop || (stop.households as any)?.user_id !== user.id) return { error: 'We couldn’t find this delivery', status: 404 }
  return { stop }
}

export async function GET(req: NextRequest, ctx: Ctx) {
  const { stopId } = await ctx.params
  const r = await loadForParent(req, stopId)
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status })
  const s: any = r.stop
  const { data: children } = await supabaseAdmin.from('swap_requests').select('child_profiles(name)').eq('route_stop_id', stopId)
  return NextResponse.json({
    missedDelivery: FAILED_DELIVERY.has(s.outcome || ''),
    missedCollection: s.outcome === 'collection_failed' || s.outcome === 'partial_issue',
    deliveredAfterAll: s.status === 'done' && !FAILED_DELIVERY.has(s.outcome || '') && s.outcome !== 'collection_failed' && s.outcome !== 'partial_issue',
    open: manageLinkOpen(s.routes),
    routeDate: s.routes?.route_date,
    childNames: (children || []).map((c: any) => c.child_profiles?.name).filter(Boolean),
    isApartment: s.households?.property_type === 'apartment',
    savedSafeSpot: s.households?.safe_spot_description || '',
    savedNeighbour: s.households?.neighbour_details || '',
    response: s.family_response, responseDetails: s.family_response_details, respondedAt: s.family_responded_at,
  })
}

// POST { response, details } → save the family's choice; the driver app shows it on the stop
export async function POST(req: NextRequest, ctx: Ctx) {
  const { stopId } = await ctx.params
  const r = await loadForParent(req, stopId)
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status })
  const s: any = r.stop
  if (!manageLinkOpen(s.routes)) return NextResponse.json({ error: 'Today’s round has finished — your books will come on your next Bonkers Day.' }, { status: 400 })
  const body = await req.json().catch(() => ({}))
  if (!RESPONSES.includes(body.response)) return NextResponse.json({ error: 'Please choose an option' }, { status: 400 })
  const details = String(body.details || '').trim().slice(0, 300)
  if ((body.response === 'neighbour' || body.response === 'safe_drop') && !details) {
    return NextResponse.json({ error: body.response === 'neighbour' ? 'Please add your neighbour’s name and villa/flat number' : 'Please describe where to leave the books' }, { status: 400 })
  }
  const now = new Date().toISOString()
  await supabaseAdmin.from('route_stops').update({ family_response: body.response, family_response_details: details || null, family_responded_at: now }).eq('id', stopId)
  await supabaseAdmin.from('delivery_events').insert({ route_stop_id: stopId, event_type: `family_response:${body.response}`, notes: details || null })
  return NextResponse.json({ ok: true })
}
