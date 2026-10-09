import { NextRequest, NextResponse } from 'next/server'
import { stopByToken, manageInfo, saveFamilyResponse } from '@/lib/manage-delivery'

type Ctx = { params: Promise<{ token: string }> }

// No-login version, reached from the WhatsApp/email link. The unguessable token identifies the visit;
// it only works until the route closes.
export async function GET(_req: NextRequest, ctx: Ctx) {
  const { token } = await ctx.params
  const stop = await stopByToken(token)
  if (!stop) return NextResponse.json({ error: 'This link isn’t valid' }, { status: 404 })
  return NextResponse.json(await manageInfo(stop))
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const { token } = await ctx.params
  const stop = await stopByToken(token)
  if (!stop) return NextResponse.json({ error: 'This link isn’t valid' }, { status: 404 })
  const error = await saveFamilyResponse(stop, await req.json().catch(() => ({})))
  return error ? NextResponse.json({ error }, { status: 400 }) : NextResponse.json({ ok: true })
}
