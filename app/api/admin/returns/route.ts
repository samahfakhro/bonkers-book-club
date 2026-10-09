import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { returnsOverview, checkInByScan, setCondition, shelveUndelivered, releaseReserved } from '@/lib/returns/server'

export async function GET() {
  try { return NextResponse.json(await returnsOverview()) }
  catch (err: any) { return NextResponse.json({ error: err.message || 'Could not load returns' }, { status: 500 }) }
}

// POST JSON  { action: 'checkin', code } | { action: 'condition', inspectionId, condition, note, photoPath }
//            { action: 'undelivered', code } | { action: 'release', copyId }
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
      b.action === 'release' ? await releaseReserved(String(b.copyId)) :
      { error: 'Unknown action' }
    return NextResponse.json(result, { status: 'error' in result ? 400 : 200 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Something went wrong' }, { status: 500 })
  }
}
