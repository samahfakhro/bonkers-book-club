import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { adminFromRequest } from '@/lib/admin-auth'
import { MESSAGE_TEMPLATES, templateByKey } from '@/lib/message-templates'
import { clearMessageCache } from '@/lib/messages'

// Admin → Messages. GET: every message (original + any edit). PUT: save an edit. DELETE ?key=: reset to original.
export async function GET() {
  const { data: edits } = await supabaseAdmin.from('message_templates').select('key, title, body, updated_at, updated_by')
  const byKey = new Map((edits || []).map(e => [e.key, e]))
  return NextResponse.json({
    messages: MESSAGE_TEMPLATES.map(t => {
      const e = byKey.get(t.key)
      return { ...t, original: { title: t.title ?? null, body: t.body }, title: e ? e.title : t.title ?? null, body: e ? e.body : t.body, edited: !!e, updatedAt: e?.updated_at ?? null, updatedBy: e?.updated_by ?? null }
    }),
  })
}

export async function PUT(req: NextRequest) {
  const { key, title, body } = await req.json().catch(() => ({}))
  const t = templateByKey(key)
  if (!t) return NextResponse.json({ error: 'Unknown message' }, { status: 400 })
  if (typeof body !== 'string' || !body.trim()) return NextResponse.json({ error: 'The message can’t be empty' }, { status: 400 })
  if (t.title !== undefined && (typeof title !== 'string' || !title.trim())) return NextResponse.json({ error: 'The headline can’t be empty' }, { status: 400 })
  // placeholders must be ones this message knows about, so nothing goes out with a stray {word}
  const known = new Set(t.placeholders.map(p => p.key))
  const unknown = [...`${title || ''} ${body}`.matchAll(/\{(\w+)\}/g)].map(m => m[1]).filter(k => !known.has(k))
  if (unknown.length) return NextResponse.json({ error: `This message can’t use {${unknown[0]}}. Use one of the words listed under it.` }, { status: 400 })
  const by = await adminFromRequest(req)
  const { error } = await supabaseAdmin.from('message_templates').upsert({ key, title: t.title !== undefined ? title.trim() : null, body: body.trim(), updated_at: new Date().toISOString(), updated_by: by })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  clearMessageCache()
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const key = req.nextUrl.searchParams.get('key')
  if (!key || !templateByKey(key)) return NextResponse.json({ error: 'Unknown message' }, { status: 400 })
  await supabaseAdmin.from('message_templates').delete().eq('key', key)
  clearMessageCache()
  return NextResponse.json({ ok: true })
}
