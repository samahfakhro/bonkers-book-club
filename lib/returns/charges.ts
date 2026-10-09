import { supabaseAdmin } from '@/lib/supabase-admin'
import { notifyHousehold } from '@/lib/notify'

// Payment requests for lost or damaged books.
// A LOST book keeps counting as "at home" until its request is Paid or Waived — then the family
// is re-checked and unblocked if they're back within their plan.

export type ChargeStatus = 'requested' | 'paid' | 'waived' | 'disputed'

async function settings() {
  const { data } = await supabaseAdmin.from('system_settings').select('key, value')
    .in('key', ['default_replacement_aed', 'lost_charge_percent', 'damage_charge_percent', 'damage_warning_level'])
  const get = (k: string, d: number) => { const n = Number(data?.find(r => r.key === k)?.value); return Number.isFinite(n) ? n : d }
  return { replacement: get('default_replacement_aed', 60), lostPct: get('lost_charge_percent', 100), damagePct: get('damage_charge_percent', 50), warnAt: get('damage_warning_level', 3) }
}

async function suggestedAmount(copyId: string, kind: 'lost' | 'damaged') {
  const s = await settings()
  const { data: c } = await supabaseAdmin.from('book_copies').select('replacement_charge_aed, buy_price_aed, purchase_price_aed').eq('id', copyId).single()
  const price = Number(c?.replacement_charge_aed ?? c?.buy_price_aed ?? c?.purchase_price_aed ?? s.replacement)
  return Math.round(price * (kind === 'lost' ? s.lostPct : s.damagePct)) / 100
}

export async function requestPayment(opts: { householdId: string; copyId: string; kind: 'lost' | 'damaged'; loanId?: string | null; inspectionId?: string | null; amount?: number | null; notes?: string | null }) {
  const amount = opts.amount != null && opts.amount >= 0 ? opts.amount : await suggestedAmount(opts.copyId, opts.kind)
  const { data: charge, error } = await supabaseAdmin.from('damage_charges').insert({
    household_id: opts.householdId, book_copy_id: opts.copyId, kind: opts.kind, loan_id: opts.loanId ?? null,
    inspection_id: opts.inspectionId ?? null, charge_amount_aed: amount, status: 'requested', notes: opts.notes ?? null,
  }).select('id').single()
  if (error) return { error: error.message }
  const { data: copy } = await supabaseAdmin.from('book_copies').select('books(title)').eq('id', opts.copyId).single()
  const title = (copy?.books as any)?.title || 'a book'
  await notifyHousehold({
    householdId: opts.householdId, type: 'damage_charge',
    title: opts.kind === 'lost' ? 'A lost book' : 'A damaged book',
    message: opts.kind === 'lost'
      ? `We’ve marked ${title} as lost. The replacement cost is AED ${amount}. We’ll be in touch about payment — once it’s settled, you’re all clear.`
      : `${title} came back damaged. The repair/replacement cost is AED ${amount}. We’ll be in touch about payment.`,
    link: '/dashboard',
  })
  return { ok: true, chargeId: charge?.id, amount }
}

// Damage request straight from a checked-in book on the Returns screen
export async function requestDamagePayment(inspectionId: string, amount: number | null) {
  const { data: insp } = await supabaseAdmin.from('return_inspections').select('id, household_id, book_copy_id, notes').eq('id', inspectionId).single()
  if (!insp?.household_id) return { error: 'Check-in not found' }
  const { count } = await supabaseAdmin.from('damage_charges').select('id', { count: 'exact', head: true }).eq('inspection_id', inspectionId).neq('status', 'waived')
  if (count) return { error: 'A payment has already been requested for this book' }
  return requestPayment({ householdId: insp.household_id, copyId: insp.book_copy_id, kind: 'damaged', inspectionId, amount, notes: insp.notes })
}

export async function updateCharge(chargeId: string, change: { status?: ChargeStatus; amount?: number; reason?: string }) {
  const { data: ch } = await supabaseAdmin.from('damage_charges').select('id, household_id, loan_id, kind').eq('id', chargeId).single()
  if (!ch) return { error: 'Payment request not found' }
  const patch: Record<string, unknown> = {}
  if (change.amount != null) patch.charge_amount_aed = change.amount
  if (change.status) {
    patch.status = change.status
    patch.waived = change.status === 'waived'
    if (change.status === 'waived') patch.waive_reason = change.reason || null
    patch.resolved_at = change.status === 'paid' || change.status === 'waived' ? new Date().toISOString() : null
  }
  await supabaseAdmin.from('damage_charges').update(patch).eq('id', chargeId)
  if (change.status === 'paid') {
    const { data: c } = await supabaseAdmin.from('damage_charges').select('charge_amount_aed').eq('id', chargeId).single()
    await supabaseAdmin.from('payments').insert({ household_id: ch.household_id, type: ch.kind === 'lost' ? 'lost_book' : 'damage', amount_aed: c?.charge_amount_aed, status: 'paid', notes: `Marked paid by admin (request ${chargeId})` })
  }
  // a settled lost book stops counting as "at home" → re-check the family
  if (ch.kind === 'lost' && ch.loan_id && (change.status === 'paid' || change.status === 'waived')) {
    await supabaseAdmin.from('loans').update({ status: 'lost_settled' }).eq('id', ch.loan_id)
    const { recheckAllowance } = await import('@/lib/returns/finish')
    await recheckAllowance(ch.household_id)
  }
  return { ok: true }
}

// Open requests + each family's damage history (for the ⚠ flag)
export async function chargesOverview() {
  const s = await settings()
  const { data: charges } = await supabaseAdmin.from('damage_charges')
    .select('id, household_id, kind, charge_amount_aed, status, notes, created_at, book_copies(internal_id, books(title)), households(first_name, last_name, name, whatsapp_number, mobile_phone)')
    .in('status', ['requested', 'disputed']).order('created_at', { ascending: false })
  const { data: damaged } = await supabaseAdmin.from('return_inspections').select('household_id').or('notes.like.damaged_ok%,notes.like.withdrawn%')
  const damageCount = new Map<string, number>()
  ;(damaged || []).forEach(d => d.household_id && damageCount.set(d.household_id, (damageCount.get(d.household_id) || 0) + 1))
  return {
    warnAt: s.warnAt,
    charges: (charges || []).map((c: any) => ({
      id: c.id, householdId: c.household_id, kind: c.kind, amount: Number(c.charge_amount_aed), status: c.status, notes: c.notes, createdAt: c.created_at,
      title: c.book_copies?.books?.title || '', internalId: c.book_copies?.internal_id || '',
      family: [c.households?.first_name, c.households?.last_name].filter(Boolean).join(' ') || c.households?.name || 'Family',
      phone: c.households?.whatsapp_number || c.households?.mobile_phone || null,
      damageCount: damageCount.get(c.household_id) || 0,
    })),
  }
}

export async function damageCountFor(householdId: string) {
  const s = await settings()
  const { count } = await supabaseAdmin.from('return_inspections').select('id', { count: 'exact', head: true })
    .eq('household_id', householdId).or('notes.like.damaged_ok%,notes.like.withdrawn%')
  return { count: count || 0, warnAt: s.warnAt }
}
