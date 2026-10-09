import { NextRequest, NextResponse } from 'next/server'
import { reopenStop } from '@/lib/driver/server'

type Ctx = { params: Promise<{ id: string }> }

// POST → reopen a missed stop so the driver can try again today
export async function POST(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  try {
    await reopenStop(id)
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Could not reopen this stop' }, { status: 400 })
  }
}
