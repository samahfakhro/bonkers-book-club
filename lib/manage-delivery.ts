// Server-only. Manage Delivery: what a family sees and can answer after a missed visit.
// Reached either signed in (/dashboard/manage-delivery/<stopId>) or from the no-login WhatsApp/email link (/m/<token>).
import { supabaseAdmin } from '@/lib/supabase-admin'
import { FAILED_DELIVERY, manageLinkOpen } from '@/lib/driver/server'

const RESPONSES = ['retry_today', 'neighbour', 'concierge', 'safe_drop', 'next_bonkers_day'] as const
const SELECT = 'id, outcome, status, family_response, family_response_details, family_responded_at, household_id, routes(status, route_date), households(user_id, first_name, property_type, safe_spot_description, neighbour_details)'

export async function stopByToken(token: string) {
  if (!/^[0-9a-f-]{36}$/i.test(token)) return null
  const { data } = await supabaseAdmin.from('route_stops').select(SELECT).eq('manage_token', token).maybeSingle()
  return data
}

export async function stopForParent(stopId: string, accessToken: string | undefined) {
  if (!accessToken) return null
  const { data: { user } } = await supabaseAdmin.auth.getUser(accessToken)
  if (!user) return null
  const { data } = await supabaseAdmin.from('route_stops').select(SELECT).eq('id', stopId).maybeSingle()
  return data && (data.households as any)?.user_id === user.id ? data : null
}

export async function manageInfo(stop: any) {
  const { data: children } = await supabaseAdmin.from('swap_requests').select('child_profiles(name)').eq('route_stop_id', stop.id)
  const missedDelivery = FAILED_DELIVERY.has(stop.outcome || '')
  const noReturn = stop.outcome === 'books_not_returned'
  const missedCollection = stop.outcome === 'collection_failed' || stop.outcome === 'partial_issue' || noReturn
  return {
    missedDelivery, missedCollection, noReturn,
    deliveredAfterAll: stop.status === 'done' && !missedDelivery && !missedCollection,
    open: manageLinkOpen(stop.routes),
    routeDate: stop.routes?.route_date,
    parentName: stop.households?.first_name || null,
    childNames: [...new Set<string>((children || []).map((c: any) => c.child_profiles?.name).filter(Boolean))],
    isApartment: stop.households?.property_type === 'apartment',
    savedSafeSpot: stop.households?.safe_spot_description || '',
    savedNeighbour: stop.households?.neighbour_details || '',
    response: stop.family_response, responseDetails: stop.family_response_details, respondedAt: stop.family_responded_at,
  }
}

// Returns an error message, or null when saved. The driver app shows the answer on the stop.
export async function saveFamilyResponse(stop: any, body: { response?: string; details?: string }): Promise<string | null> {
  if (!manageLinkOpen(stop.routes)) return 'Today’s round has finished — your books will come on your next Bonkers Day.'
  if (!RESPONSES.includes(body.response as any)) return 'Please choose an option'
  const details = String(body.details || '').trim().slice(0, 300)
  if ((body.response === 'neighbour' || body.response === 'safe_drop') && !details) {
    return body.response === 'neighbour' ? 'Please add your neighbour’s name and villa/flat number' : 'Please describe where to leave the books'
  }
  await supabaseAdmin.from('route_stops').update({ family_response: body.response, family_response_details: details || null, family_responded_at: new Date().toISOString() }).eq('id', stop.id)
  await supabaseAdmin.from('delivery_events').insert({ route_stop_id: stop.id, event_type: `family_response:${body.response}`, notes: details || null })
  return null
}
