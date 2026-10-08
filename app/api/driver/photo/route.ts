import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// POST multipart { stopId, photo } → stores a safe-drop photo in the private 'delivery-photos' bucket
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const stopId = String(form.get('stopId') || '')
    const photo = form.get('photo')
    if (!/^[0-9a-f-]{36}$/.test(stopId) || !(photo instanceof File)) return NextResponse.json({ error: 'Send a stop and a photo' }, { status: 400 })
    if (!photo.type.startsWith('image/')) return NextResponse.json({ error: 'That isn’t a photo' }, { status: 400 })
    if (photo.size > 12 * 1024 * 1024) return NextResponse.json({ error: 'Photo is too large (max 12 MB)' }, { status: 400 })
    const ext = photo.type.includes('png') ? 'png' : 'jpg'
    const path = `${stopId}/${Date.now()}.${ext}`
    const { error } = await supabaseAdmin.storage.from('delivery-photos').upload(path, Buffer.from(await photo.arrayBuffer()), { contentType: photo.type })
    if (error) throw error
    return NextResponse.json({ path })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Photo upload failed' }, { status: 500 })
  }
}
