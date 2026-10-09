import { NextRequest, NextResponse } from 'next/server'
import { adminFromRequest } from '@/lib/admin-auth'

// Every admin and driver data route needs a signed-in admin.
// (Drivers use the admin login until driver logins are built.)
export async function proxy(req: NextRequest) {
  if (!(await adminFromRequest(req))) return NextResponse.json({ error: 'Admin sign-in required' }, { status: 401 })
  return NextResponse.next()
}

export const config = {
  matcher: ['/api/admin/:path*', '/api/driver/:path*'],
}
