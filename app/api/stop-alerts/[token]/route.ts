import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

type Ctx = { params: Promise<{ token: string }> }
const valid = (t: string) => /^[0-9a-f-]{36}$/i.test(t)

// No-login "Stop alerts for this book" from the email. GET shows which book; POST removes the alert.
export async function GET(_req: NextRequest, ctx: Ctx) {
  const { token } = await ctx.params
  if (!valid(token)) return NextResponse.json({ error: 'This link isn’t valid' }, { status: 404 })
  const { data } = await supabaseAdmin.from('book_availability_notifications').select('id, books(title)').eq('stop_token', token).maybeSingle()
  if (!data) return NextResponse.json({ stopped: true })
  return NextResponse.json({ title: (data.books as any)?.title || 'this book' })
}

export async function POST(_req: NextRequest, ctx: Ctx) {
  const { token } = await ctx.params
  if (!valid(token)) return NextResponse.json({ error: 'This link isn’t valid' }, { status: 404 })
  await supabaseAdmin.from('book_availability_notifications').delete().eq('stop_token', token)
  return NextResponse.json({ stopped: true })
}
