import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

const clip = (v: unknown, n: number) => (typeof v === 'string' && v ? v.slice(0, n) : null)

// A visitor's first page view: where they came from (anonymous). One row per visitor.
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}))
  if (!/^[0-9a-f-]{36}$/i.test(String(b.visitorId || '')) || !b.source) return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  await supabaseAdmin.from('site_visits').upsert({
    visitor_id: b.visitorId, source: clip(b.source, 60), medium: clip(b.medium, 60), campaign: clip(b.campaign, 100),
    referrer: clip(b.referrer, 300), landing_path: clip(b.landingPath, 200),
  }, { onConflict: 'visitor_id', ignoreDuplicates: true })
  return NextResponse.json({ ok: true })
}
