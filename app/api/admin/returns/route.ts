import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { returnsOverview, checkInByScan, setCondition, shelveUndelivered } from '@/lib/returns/server'
import { finishInspecting, overAllowanceList, giveMoreTime, markLost } from '@/lib/returns/finish'
import { chargesOverview, requestDamagePayment, updateCharge } from '@/lib/returns/charges'

export async function GET() {
  try {
    const [overview, overAllowance, payments] = await Promise.all([returnsOverview(), overAllowanceList(), chargesOverview()])
    return NextResponse.json({ ...overview, overAllowance, payments })
  }
  catch (err: any) { return NextResponse.json({ error: err.message || 'Could not load returns' }, { status: 500 }) }
}

// POST JSON  { action: 'checkin', code } | { action: 'condition', inspectionId, condition, note, photoPath }
//            { action: 'undelivered', code } | { action: 'finish' }
//            { action: 'more_time', householdId } | { action: 'mark_lost', loanId, amount? }
//            { action: 'request_damage', inspectionId, amount? } | { action: 'charge', chargeId, status?, amount?, reason? }
// POST multipart { inspectionId, photo } → damage photo, returns { path }
export async function POST(req: NextRequest) {
  try {
    if (req.headers.get('content-type')?.includes('multipart/form-data')) {
      const form = await req.formData()
      const id = String(form.get('inspectionId') || ''), photo = form.get('photo')
      if (!/^[0-9a-f-]{36}$/.test(id) || !(photo instanceof File) || !photo.type.startsWith('image/')) return NextResponse.json({ error: 'Send a photo' }, { status: 400 })
      if (photo.size > 12 * 1024 * 1024) return NextResponse.json({ error: 'Photo is too large (max 12 MB)' }, { status: 400 })
      const path = `returns/${id}/${Date.now()}.${photo.type.includes('png') ? 'png' : 'jpg'}`
      const { error } = await supabaseAdmin.storage.from('delivery-photos').upload(path, Buffer.from(await photo.arrayBuffer()), { contentType: photo.type })
      if (error) throw error
      return NextResponse.json({ path })
    }
    const b = await req.json().catch(() => ({}))
    const result =
      b.action === 'checkin' ? await checkInByScan(String(b.code || '')) :
      b.action === 'condition' ? await setCondition(String(b.inspectionId), b.condition, String(b.note || '').trim(), b.photoPath || null) :
      b.action === 'undelivered' ? await shelveUndelivered(String(b.code || '')) :
      b.action === 'finish' ? await finishInspecting() :
      b.action === 'more_time' ? await giveMoreTime(String(b.householdId)) :
      b.action === 'mark_lost' ? await markLost(String(b.loanId), b.amount != null ? Number(b.amount) : null) :
      b.action === 'request_damage' ? await requestDamagePayment(String(b.inspectionId), b.amount != null ? Number(b.amount) : null) :
      b.action === 'charge' ? await updateCharge(String(b.chargeId), { status: b.status, amount: b.amount != null ? Number(b.amount) : undefined, reason: b.reason }) :
      { error: 'Unknown action' }
    return NextResponse.json(result, { status: 'error' in result ? 400 : 200 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Something went wrong' }, { status: 500 })
  }
}
