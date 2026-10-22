import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { changePlan } from '@/lib/membership/plan'

// A family moves up to the bigger plan (e.g. to keep extra books). If that brings them back within
// their plan, new books are unblocked straight away.
export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace(/^Bearer /, '')
  const { data: { user } } = token ? await supabaseAdmin.auth.getUser(token) : { data: { user: null } }
  if (!user) return NextResponse.json({ error: 'Please sign in' }, { status: 401 })
  const { data: hh } = await supabaseAdmin.from('households').select('id').eq('user_id', user.id).single()
  if (!hh) return NextResponse.json({ error: 'Family not found' }, { status: 404 })

  const [{ data: sub }, { data: plans }] = await Promise.all([
    supabaseAdmin.from('subscriptions').select('id, plan_id, subscription_plans(book_count)').eq('household_id', hh.id).eq('status', 'active').maybeSingle(),
    supabaseAdmin.from('subscription_plans').select('id, name, book_count').eq('is_active', true).order('book_count', { ascending: false }),
  ])
  if (!sub) return NextResponse.json({ error: 'No active membership found' }, { status: 400 })
  const current = Number((sub.subscription_plans as any)?.book_count ?? 4)
  const bigger = (plans || []).find(p => Number(p.book_count) > current)
  if (!bigger) return NextResponse.json({ error: 'You’re already on our biggest plan' }, { status: 400 })

  // same rules and billing as Settings → Plan (immediate, part-month charge, re-checks the allowance)
  const result = await changePlan(hh.id, bigger.id)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ ok: true, plan: bigger.name, books: bigger.book_count })
}
