import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// Server-only. Who counts as an admin — matches the admin_read_all_* rules in the database.
// TODO (admin security task): use this on every /api/admin route and guard the /admin pages.
export const ADMIN_EMAILS = ['samahfakhro@gmail.com']

// Returns the signed-in admin's email, or null if the caller isn't a signed-in admin.
// The browser sends its Supabase session token as "Authorization: Bearer …".
export async function adminFromRequest(req: NextRequest): Promise<string | null> {
  const token = req.headers.get('authorization')?.replace(/^Bearer /, '')
  if (!token) return null
  const { data: { user } } = await supabaseAdmin.auth.getUser(token)
  const email = user?.email?.toLowerCase()
  return email && ADMIN_EMAILS.includes(email) ? email : null
}
