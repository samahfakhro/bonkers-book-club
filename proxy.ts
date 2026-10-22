import { NextRequest, NextResponse } from 'next/server'
import { teamFromRequest } from '@/lib/admin-auth'
import { canUseApi } from '@/lib/team'
import { SITE_COOKIE, accessToken, isOpenPath, sitePassword } from '@/lib/site-lock'

// 1. Site lock (pre-launch): while SITE_PASSWORD is set, everyone needs the password first. Google is asked not to list the site.
// 2. Every admin and driver data route needs a signed-in team member whose role allows it
//    (admins: everything; drivers: /api/driver; warehouse: packing, returns and routes).
export async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname
  const password = sitePassword()

  if (password && !isOpenPath(path) && req.cookies.get(SITE_COOKIE)?.value !== await accessToken(password)) {
    if (path.startsWith('/api/')) return NextResponse.json({ error: 'This site is locked' }, { status: 401 })
    const url = req.nextUrl.clone()
    url.pathname = '/locked'
    url.search = `?next=${encodeURIComponent(path + req.nextUrl.search)}`
    return NextResponse.redirect(url)
  }

  if (path.startsWith('/api/admin/') || path.startsWith('/api/driver/')) {
    const member = await teamFromRequest(req)
    if (!member) return NextResponse.json({ error: 'Team sign-in required' }, { status: 401 })
    if (!canUseApi(member.role, path)) return NextResponse.json({ error: 'Your role can’t use this' }, { status: 403 })
  }

  const res = NextResponse.next()
  if (password) res.headers.set('X-Robots-Tag', 'noindex, nofollow')
  return res
}

export const config = {
  // everything except Next's own files and images/fonts (so the lock page can show the logo)
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|woff|woff2|ttf|mp4)$).*)'],
}
