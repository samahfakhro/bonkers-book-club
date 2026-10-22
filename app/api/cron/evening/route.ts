import { NextRequest, NextResponse } from 'next/server'
import { cronAllowed } from '@/lib/cron-auth'
import { sendCuriousDayEveMessages } from '@/lib/reminders'

// 6pm Dubai: "Tomorrow is your Curious Day!" for families with a delivery and/or collection tomorrow
export async function GET(req: NextRequest) {
  if (!cronAllowed(req)) return NextResponse.json({ error: 'Not allowed' }, { status: 401 })
  const sent = await sendCuriousDayEveMessages()
  return NextResponse.json({ ok: true, sent: sent.length })
}
