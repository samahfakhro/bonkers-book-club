import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import type { TeamRole } from '@/lib/team'

// Server-only. Used by proxy.ts to guard every /api/admin and /api/driver route.
// The browser sends its Supabase session token as "Authorization: Bearer …" (see lib/auth-fetch.ts).

export type TeamMember = { id: string; name: string; email: string | null; role: TeamRole; is_owner: boolean }

// The signed-in, active team member — or null for families and switched-off staff.
export async function teamFromRequest(req: NextRequest): Promise<TeamMember | null> {
  const token = req.headers.get('authorization')?.replace(/^Bearer /, '')
  if (!token) return null
  const { data: { user } } = await supabaseAdmin.auth.getUser(token)
  if (!user) return null
  const { data } = await supabaseAdmin.from('team_members').select('id, name, email, role, is_owner').eq('user_id', user.id).eq('active', true).maybeSingle()
  return (data as TeamMember) ?? null
}

// Returns the signed-in admin's name/email (for audit notes), or null if the caller isn't an admin.
export async function adminFromRequest(req: NextRequest): Promise<string | null> {
  const member = await teamFromRequest(req)
  return member?.role === 'admin' ? (member.email || member.name) : null
}
