import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { notifyHousehold } from '@/lib/notify'
import { renderMessage } from '@/lib/messages'

// A child has sent their book choices to their grown-up → tell the parent, once per child per Curious Day
// (later changes don't send more; the noon cutoff reminder still catches anything left waiting).
export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace(/^Bearer /, '')
  const { data: { user } } = token ? await supabaseAdmin.auth.getUser(token) : { data: { user: null } }
  if (!user) return NextResponse.json({ error: 'Please sign in again' }, { status: 401 })
  const { childId } = await req.json().catch(() => ({}))
  const { data: child } = await supabaseAdmin.from('child_profiles').select('id, name, nickname, household_id, households!inner ( user_id )').eq('id', childId).single()
  if (!child || (child.households as any)?.user_id !== user.id) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const name = child.nickname || child.name
  const { title, body } = await renderMessage('child_sent', { child_name: name })
  const since = new Date(Date.now() - 4 * 86400_000).toISOString()   // one per weekly cycle
  const { count } = await supabaseAdmin.from('notifications').select('id', { count: 'exact', head: true }).eq('household_id', child.household_id).eq('title', title).gte('sent_at', since)
  if (!count) await notifyHousehold({ householdId: child.household_id, childId: child.id, type: 'swap_reminder', title, message: body, link: '/dashboard' }).catch(() => {})
  return NextResponse.json({ ok: true })
}
