// Server-only driver logic: record a stop's outcome and move the books accordingly.
// Outcomes follow the master document (Appendix D — Driver Stop Status Reference).
import { supabaseAdmin } from '@/lib/supabase-admin'
import { routeWithEnvelopes } from '@/lib/routes/envelopes'
import { parseScannedCode } from '@/lib/routes/codes'

export type DeliveryResult = 'handed_over' | 'concierge' | 'neighbour' | 'safe_drop' | 'failed'
export type FailReason = 'no_answer' | 'no_access' | 'other'
export type CollectionResult = 'collected' | 'partial' | 'not_collected'

export type StopReport = {
  delivery?: { result: DeliveryResult; failReason?: FailReason; neighbour?: string; photoPath?: string; scannedCodes: string[] }
  collection?: { result: CollectionResult }
  notes?: string
}

export const OUTCOME_LABEL: Record<string, string> = {
  delivered: 'Delivered',
  collection_completed: 'Collection completed',
  delivery_collection_completed: 'Delivery + collection completed',
  delivery_failed: 'Delivery failed',
  collection_failed: 'Collection failed',
  partial_issue: 'Partial issue',
  no_access: 'No access',
  no_answer: 'No answer',
  left_with_concierge: 'Left with concierge',
  left_with_neighbour: 'Left with neighbour',
  safe_drop_completed: 'Safe drop completed',
}

// What the driver may do at this door — never leave books unattended without the family's permission
export function allowedDeliveryResults(h: any): DeliveryResult[] {
  const options: DeliveryResult[] = ['handed_over']
  if (h?.property_type === 'apartment' || h?.delivery_preference === 'leave_with_reception') options.push('concierge')
  if (h?.neighbour_permission_enabled) options.push('neighbour')
  if (h?.delivery_preference === 'leave_safe_spot') options.push('safe_drop')
  options.push('failed')
  return options
}

function outcomeFor(r: StopReport): string {
  const d = r.delivery, c = r.collection
  if (d?.result === 'failed') return d.failReason === 'no_access' ? 'no_access' : d.failReason === 'no_answer' ? 'no_answer' : 'delivery_failed'
  if (d) {
    if (c && c.result !== 'collected') return 'partial_issue'
    if (d.result === 'concierge') return 'left_with_concierge'
    if (d.result === 'neighbour') return 'left_with_neighbour'
    if (d.result === 'safe_drop') return 'safe_drop_completed'
    return c ? 'delivery_collection_completed' : 'delivered'
  }
  if (c?.result === 'collected') return 'collection_completed'
  if (c?.result === 'partial') return 'partial_issue'
  return 'collection_failed'
}

export async function completeStop(stopId: string, report: StopReport) {
  const { data: stopRow } = await supabaseAdmin.from('route_stops').select('id, route_id, status, household_id').eq('id', stopId).single()
  if (!stopRow) throw new Error('Stop not found')
  if (stopRow.status === 'done') throw new Error('This stop has already been completed')

  const route = await routeWithEnvelopes(stopRow.route_id)
  if (route.status !== 'locked') throw new Error('This route isn’t ready for delivery yet (it must be locked)')
  const stop = route.stops.find(s => s.id === stopId)!
  const hasDelivery = stop.children.length > 0
  const hasCollection = stop.collectCount > 0

  // ── validate what the driver sent ──
  if (hasDelivery && !report.delivery) throw new Error('Record what happened with the delivery')
  if (hasCollection && !report.collection) throw new Error('Record what happened with the collection')
  const d = report.delivery
  if (d) {
    if (!allowedDeliveryResults(stop.households).includes(d.result)) throw new Error('That option isn’t allowed for this family')
    if (d.result === 'neighbour' && !d.neighbour?.trim()) throw new Error('Add the neighbour’s name and villa/flat number')
    if (d.result === 'safe_drop' && !d.photoPath) throw new Error('Take a photo of where the books were left')
    if (d.result !== 'failed') {
      // every child's envelope must be scanned, and only this family's envelopes count
      const expected = new Set(stop.children.map(c => c.envelopeCode))
      const scanned = new Set<string>()
      for (const raw of d.scannedCodes || []) {
        const p = parseScannedCode(raw)
        if (!p || p.family !== stop.familyCode) throw new Error(`“${raw}” isn’t one of this family’s envelopes`)
        scanned.add(`${p.family}-${p.childNumber}`)
      }
      const missing = [...expected].filter(code => !scanned.has(code))
      if (missing.length) throw new Error(`Scan every envelope first — still missing ${missing.join(', ')}`)
    }
  }

  const outcome = outcomeFor(report)
  const now = new Date().toISOString()
  const noteParts = [
    d?.result === 'neighbour' ? `Neighbour: ${d.neighbour!.trim()}` : null,
    d?.result === 'failed' && d.failReason === 'other' ? 'Delivery not possible' : null,
    report.collection?.result === 'partial' ? 'Only some books collected' : null,
    report.collection?.result === 'not_collected' ? 'Books not collected' : null,
    report.notes?.trim() || null,
  ].filter(Boolean)
  const warnings: string[] = []

  // ── books delivered → they're at the family's home ──
  if (d && d.result !== 'failed') {
    for (const child of stop.children) {
      const packedBooks = child.books.filter(b => b.packedCopyId)
      if (packedBooks.length < child.books.length) warnings.push(`${child.name}: ${child.books.length - packedBooks.length} book(s) had no packed copy recorded`)
      if (packedBooks.length) {
        await supabaseAdmin.from('loans').insert(packedBooks.map(b => ({ book_copy_id: b.packedCopyId, child_id: child.childId, household_id: stop.household_id, status: 'checked_out', checked_out_at: now })))
        await supabaseAdmin.from('book_copies').update({ status: 'checked_out', current_household_id: stop.household_id, updated_at: now }).in('id', packedBooks.map(b => b.packedCopyId!))
      }
      await supabaseAdmin.from('swap_requests').update({ status: 'delivered' }).eq('id', child.requestId)
    }
  } else if (d?.result === 'failed') {
    // books come back to the warehouse; the visit is flagged for follow-up
    await supabaseAdmin.from('swap_requests').update({ status: 'delivery_failed' }).in('id', stop.children.map(c => c.requestId))
  }

  // ── books collected → on their way back to the warehouse (scanned back in at Returns) ──
  if (report.collection) {
    const { data: loans } = await supabaseAdmin.from('loans').select('id, book_copy_id').eq('collection_stop_id', stopId)
    if (report.collection.result === 'not_collected') {
      // release them so the next route picks them up again
      await supabaseAdmin.from('loans').update({ collection_stop_id: null }).eq('collection_stop_id', stopId)
    } else if (loans?.length) {
      await supabaseAdmin.from('loans').update({ status: 'in_return_transit' }).in('id', loans.map(l => l.id))
      await supabaseAdmin.from('book_copies').update({ status: 'in_return_transit', updated_at: now }).in('id', loans.map(l => l.book_copy_id).filter(Boolean))
    }
  }

  // ── record the outcome + a log entry ──
  await supabaseAdmin.from('route_stops').update({ status: 'done', outcome, outcome_notes: noteParts.join(' · ') || null, completed_at: now }).eq('id', stopId)
  await supabaseAdmin.from('delivery_events').insert({ route_stop_id: stopId, event_type: outcome, notes: [...noteParts, ...warnings].join(' · ') || null, photo_url: d?.photoPath ?? null })

  // ── last stop done → route completed ──
  const { data: remaining } = await supabaseAdmin.from('route_stops').select('id').eq('route_id', stopRow.route_id).not('status', 'in', '(done,cancelled)')
  if (!remaining?.length) await supabaseAdmin.from('routes').update({ status: 'completed', completed_at: now }).eq('id', stopRow.route_id)

  return { outcome, label: OUTCOME_LABEL[outcome], warnings }
}
