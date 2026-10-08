import { NextRequest, NextResponse } from 'next/server'
import { getRoute, reorderRoute, setRouteLocked } from '@/lib/routes/server'

type Ctx = { params: Promise<{ id: string }> }

// GET → the route with its stops in order (stop refs like Z3-001 and box letters included)
export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  try {
    return NextResponse.json(await getRoute(id))
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Route not found' }, { status: 404 })
  }
}

// POST { action: 'reorder', stopIds } | { action: 'lock' } | { action: 'unlock' }
export async function POST(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  const body = await req.json().catch(() => ({}))
  try {
    if (body.action === 'reorder' && Array.isArray(body.stopIds)) await reorderRoute(id, body.stopIds)
    else if (body.action === 'lock') await setRouteLocked(id, true)
    else if (body.action === 'unlock') await setRouteLocked(id, false)
    else return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    return NextResponse.json(await getRoute(id))
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Could not update route' }, { status: 400 })
  }
}
