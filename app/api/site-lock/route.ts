import { NextRequest, NextResponse } from 'next/server'
import { SITE_COOKIE, accessToken, sitePassword } from '@/lib/site-lock'

// The password on the lock page. Right password → a cookie that lets this browser in for 90 days.
export async function POST(req: NextRequest) {
  const password = sitePassword()
  if (!password) return NextResponse.json({ ok: true })
  const { attempt } = await req.json().catch(() => ({}))
  if (typeof attempt !== 'string' || attempt !== password) {
    await new Promise(r => setTimeout(r, 800))   // slow down guessing
    return NextResponse.json({ error: 'That password isn’t right' }, { status: 401 })
  }
  const res = NextResponse.json({ ok: true })
  res.cookies.set(SITE_COOKIE, await accessToken(password), { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 90 * 86400 })
  return res
}
