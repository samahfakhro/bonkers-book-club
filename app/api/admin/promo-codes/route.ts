import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { createCoupon, stripeEnabled } from '@/lib/billing/stripe'
import { cleanCode, describeCode } from '@/lib/promo-codes'

// Admin → Finance → Promo codes (admins only: proxy.ts).  GET list · POST create · PATCH { id, active }
export async function GET() {
  const { data, error } = await supabaseAdmin.from('promo_codes').select('*').order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ codes: (data || []).map(c => ({ ...c, description: describeCode(c) })) })
}

export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}))
  const code = cleanCode(b.code)
  if (!/^[A-Z0-9_-]{3,30}$/.test(code)) return NextResponse.json({ error: 'Codes are 3–30 letters or numbers, no spaces.' }, { status: 400 })
  const kind = b.kind === 'discount' ? 'discount' : 'free'
  const percent = Math.round(Number(b.percentOff))
  const months = Math.max(1, Math.round(Number(b.months) || 1))
  const maxUses = b.maxUses ? Math.round(Number(b.maxUses)) : null
  if (kind === 'discount' && !(percent >= 1 && percent <= 100)) return NextResponse.json({ error: 'Choose a discount between 1% and 100%.' }, { status: 400 })
  if (maxUses !== null && !(maxUses >= 1)) return NextResponse.json({ error: 'Number of uses must be 1 or more.' }, { status: 400 })

  const { data: taken } = await supabaseAdmin.from('promo_codes').select('id').eq('code', code).maybeSingle()
  if (taken) return NextResponse.json({ error: `${code} already exists.` }, { status: 400 })

  let couponId: string | null = null
  if (kind === 'discount') {
    if (!stripeEnabled()) return NextResponse.json({ error: 'Discount codes need Stripe to be connected.' }, { status: 400 })
    try { couponId = await createCoupon(percent, months, code) }
    catch (e: any) { return NextResponse.json({ error: `Stripe: ${e.message}` }, { status: 500 }) }
  }
  const { error } = await supabaseAdmin.from('promo_codes').insert({
    code, kind, percent_off: kind === 'discount' ? percent : null, duration_months: kind === 'discount' ? months : null,
    stripe_coupon_id: couponId, max_uses: maxUses, expires_on: b.expiresOn || null, note: String(b.note || '').trim() || null,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function PATCH(req: NextRequest) {
  const { id, active } = await req.json().catch(() => ({}))
  if (!id || typeof active !== 'boolean') return NextResponse.json({ error: 'id and active required' }, { status: 400 })
  const { error } = await supabaseAdmin.from('promo_codes').update({ active }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
