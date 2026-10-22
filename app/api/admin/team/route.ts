import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { hiddenTeamEmail, normalisePhone, type TeamRole } from '@/lib/team'

// Admin → Team. (proxy.ts already makes sure only admins get here.)
const ROLES: TeamRole[] = ['admin', 'driver', 'warehouse']
const MIN_PASSWORD = 8

export async function GET() {
  const { data, error } = await supabaseAdmin.from('team_members')
    .select('id, name, phone, email, role, is_owner, active, created_at').order('is_owner', { ascending: false }).order('created_at')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  // the hidden login address for mobile-only staff isn't useful to show
  return NextResponse.json({ team: (data || []).map(m => ({ ...m, email: m.email?.endsWith('@team.curiouslibrary.ae') ? null : m.email })) })
}

// Add someone: name, role, a starting password, and a mobile number (or an email if they have one)
export async function POST(req: NextRequest) {
  const { name, phone, email, role, password } = await req.json().catch(() => ({}))
  if (!name?.trim()) return NextResponse.json({ error: 'Add their name' }, { status: 400 })
  if (!ROLES.includes(role)) return NextResponse.json({ error: 'Choose a role' }, { status: 400 })
  if (!password || password.length < MIN_PASSWORD) return NextResponse.json({ error: `The password needs at least ${MIN_PASSWORD} characters` }, { status: 400 })
  const digits = phone ? normalisePhone(phone) : ''
  const realEmail = email?.trim().toLowerCase() || ''
  if (!digits && !realEmail) return NextResponse.json({ error: 'Add a mobile number or an email' }, { status: 400 })
  if (digits && digits.length < 10) return NextResponse.json({ error: 'That mobile number looks too short' }, { status: 400 })

  const loginEmail = realEmail || hiddenTeamEmail(digits)
  const { data: created, error: authError } = await supabaseAdmin.auth.admin.createUser({ email: loginEmail, password, email_confirm: true, user_metadata: { team_name: name.trim() } })
  if (authError || !created.user) {
    const taken = /already|registered|exists/i.test(authError?.message || '')
    return NextResponse.json({ error: taken ? 'Someone with that mobile number or email already has a login' : (authError?.message || 'Could not create the login') }, { status: 400 })
  }
  const { error } = await supabaseAdmin.from('team_members').insert({ user_id: created.user.id, name: name.trim(), phone: digits || null, email: loginEmail, role })
  if (error) {
    await supabaseAdmin.auth.admin.deleteUser(created.user.id) // don't leave a login with no team entry
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

// Change someone: name, role, switch on/off, or set a new password. The owner's role and access can't change.
export async function PATCH(req: NextRequest) {
  const { id, name, role, active, password } = await req.json().catch(() => ({}))
  const { data: member } = await supabaseAdmin.from('team_members').select('id, user_id, is_owner').eq('id', id).maybeSingle()
  if (!member) return NextResponse.json({ error: 'Team member not found' }, { status: 404 })
  if (member.is_owner && (role !== undefined || active !== undefined)) return NextResponse.json({ error: 'The owner always keeps full access' }, { status: 400 })

  const update: Record<string, unknown> = {}
  if (name !== undefined) { if (!name.trim()) return NextResponse.json({ error: 'Add their name' }, { status: 400 }); update.name = name.trim() }
  if (role !== undefined) { if (!ROLES.includes(role)) return NextResponse.json({ error: 'Unknown role' }, { status: 400 }); update.role = role }
  if (active !== undefined) update.active = !!active
  if (password !== undefined) {
    if (password.length < MIN_PASSWORD) return NextResponse.json({ error: `The password needs at least ${MIN_PASSWORD} characters` }, { status: 400 })
    if (!member.user_id) return NextResponse.json({ error: 'This person has no login' }, { status: 400 })
    const { error } = await supabaseAdmin.auth.admin.updateUserById(member.user_id, { password })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (Object.keys(update).length) {
    const { error } = await supabaseAdmin.from('team_members').update(update).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
