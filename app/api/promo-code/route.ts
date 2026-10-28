import { NextRequest, NextResponse } from 'next/server'
import { describeCode, usableCode } from '@/lib/promo-codes'

// Sign-up "Apply" button: is this code valid, and what does it give?
export async function POST(req: NextRequest) {
  const { code } = await req.json().catch(() => ({}))
  const found = await usableCode(code)
  if (!found.ok) return NextResponse.json({ ok: false, error: found.error })
  return NextResponse.json({ ok: true, code: found.promo.code, free: found.promo.kind === 'free', description: describeCode(found.promo) })
}
