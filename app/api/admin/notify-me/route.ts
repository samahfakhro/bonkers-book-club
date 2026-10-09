import { NextRequest, NextResponse } from 'next/server'
import { sendBackOnShelfAlerts } from '@/lib/notify-me'

// POST { bookIds } → "back on the shelf" alerts, e.g. after a new copy is added in admin Books
export async function POST(req: NextRequest) {
  const { bookIds } = await req.json().catch(() => ({}))
  if (!Array.isArray(bookIds)) return NextResponse.json({ error: 'Send bookIds' }, { status: 400 })
  return NextResponse.json({ sent: await sendBackOnShelfAlerts(bookIds.map(String)) })
}
