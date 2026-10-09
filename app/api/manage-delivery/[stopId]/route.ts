import { NextRequest, NextResponse } from 'next/server'
import { stopForParent, manageInfo, saveFamilyResponse } from '@/lib/manage-delivery'

type Ctx = { params: Promise<{ stopId: string }> }
const token = (req: NextRequest) => req.headers.get('authorization')?.replace(/^Bearer /, '')

// Signed-in version: only the parent of this household may see or answer their missed visit
export async function GET(req: NextRequest, ctx: Ctx) {
  const { stopId } = await ctx.params
  const stop = await stopForParent(stopId, token(req))
  if (!stop) return NextResponse.json({ error: 'Please sign in to see this delivery' }, { status: 401 })
  return NextResponse.json(await manageInfo(stop))
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const { stopId } = await ctx.params
  const stop = await stopForParent(stopId, token(req))
  if (!stop) return NextResponse.json({ error: 'Please sign in to see this delivery' }, { status: 401 })
  const error = await saveFamilyResponse(stop, await req.json().catch(() => ({})))
  return error ? NextResponse.json({ error }, { status: 400 }) : NextResponse.json({ ok: true })
}
