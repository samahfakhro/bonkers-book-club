import { NextRequest, NextResponse } from 'next/server'
import { routeWithEnvelopes } from '@/lib/routes/envelopes'
import { allowedDeliveryResults, OUTCOME_LABEL } from '@/lib/driver/server'

type Ctx = { params: Promise<{ id: string }> }

// GET → the route in stop order, with what each stop delivers/collects and what the driver may do there
export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  try {
    const route = await routeWithEnvelopes(id)
    if (route.status !== 'locked' && route.status !== 'completed') return NextResponse.json({ error: 'This route isn’t ready for delivery yet' }, { status: 400 })
    return NextResponse.json({
      ...route,
      stops: route.stops.map(s => ({
        ...s,
        // shelf locations and covers aren't needed at the door
        children: s.children.map(c => ({ childId: c.childId, number: c.number, envelopeCode: c.envelopeCode, name: c.name, lastName: c.lastName, bookCount: c.books.length })),
        allowed: allowedDeliveryResults(s.households, (s as any).family_response),
        outcomeLabel: s.outcome ? OUTCOME_LABEL[s.outcome] ?? s.outcome : null,
      })),
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Route not found' }, { status: 404 })
  }
}
