import { NextRequest, NextResponse } from 'next/server'
import { completeStop, type StopReport } from '@/lib/driver/server'

type Ctx = { params: Promise<{ id: string }> }

// POST StopReport → record the outcome of this stop and move the books accordingly
export async function POST(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  const report = await req.json().catch(() => null) as StopReport | null
  if (!report) return NextResponse.json({ error: 'Nothing sent' }, { status: 400 })
  try {
    return NextResponse.json(await completeStop(id, report))
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Could not save this stop' }, { status: 400 })
  }
}
