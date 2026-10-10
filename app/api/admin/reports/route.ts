import { NextRequest, NextResponse } from 'next/server'
import { buildReport } from '@/lib/reports'

export const dynamic = 'force-dynamic'

// GET ?from=YYYY-MM-DD&to=YYYY-MM-DD (either can be left out for "all time")
export async function GET(req: NextRequest) {
  const valid = (d: string | null) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null)
  try {
    return NextResponse.json(await buildReport(valid(req.nextUrl.searchParams.get('from')), valid(req.nextUrl.searchParams.get('to'))))
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Could not build the report' }, { status: 500 })
  }
}
