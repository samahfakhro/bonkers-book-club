import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { adminFromRequest } from '@/lib/admin-auth'

// POST { householdId } → a one-time sign-in link that opens that family's dashboard.
// Admins only, and every use is written to admin_audit_log.
export async function POST(req: NextRequest) {
  const admin = await adminFromRequest(req)
  if (!admin) return NextResponse.json({ error: 'Only a signed-in admin can do this' }, { status: 403 })

  const { householdId } = await req.json().catch(() => ({}))
  if (!householdId) return NextResponse.json({ error: 'Choose a family' }, { status: 400 })
  const { data: hh } = await supabaseAdmin.from('households').select('id, user_id, first_name, last_name').eq('id', householdId).single()
  if (!hh?.user_id) return NextResponse.json({ error: 'This family doesn’t have a login (test families can’t be opened)' }, { status: 400 })

  const { data: userData, error: userErr } = await supabaseAdmin.auth.admin.getUserById(hh.user_id)
  const email = userData?.user?.email
  if (userErr || !email) return NextResponse.json({ error: 'Couldn’t find this family’s login' }, { status: 404 })

  const origin = req.headers.get('origin') || req.nextUrl.origin
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink', email,
    options: { redirectTo: `${origin}/dashboard?viewingAs=${encodeURIComponent([hh.first_name, hh.last_name].filter(Boolean).join(' ') || 'this family')}` },
  })
  if (error || !data?.properties?.action_link) return NextResponse.json({ error: error?.message || 'Couldn’t create the sign-in link' }, { status: 500 })

  await supabaseAdmin.from('admin_audit_log').insert({ admin_email: admin, action: 'log_in_as_family', household_id: hh.id, detail: email })
  return NextResponse.json({ link: data.properties.action_link })
}
