import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { ADMIN_EMAILS, isAdminEmail } from '@/lib/admin-emails'

// Server-only. Used by proxy.ts to guard every /api/admin and /api/driver route.
export { ADMIN_EMAILS }

// Returns the signed-in admin's email, or null if the caller isn't a signed-in admin.
// The browser sends its Supabase session token as "Authorization: Bearer …" (see lib/auth-fetch.ts).
export async function adminFromRequest(req: NextRequest): Promise<string | null> {
  const token = req.headers.get('authorization')?.replace(/^Bearer /, '')
  if (!token) return null
  const { data: { user } } = await supabaseAdmin.auth.getUser(token)
  return isAdminEmail(user?.email) ? user!.email!.toLowerCase() : null
}
