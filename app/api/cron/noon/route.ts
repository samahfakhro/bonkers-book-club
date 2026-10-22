import { NextRequest, NextResponse } from 'next/server'
import { cronAllowed } from '@/lib/cron-auth'
import { runBillingDay } from '@/lib/membership/billing-day'
import { sendCutoffReminders } from '@/lib/reminders'
import { sendSignupReminders } from '@/lib/signup-leads'

// 12 noon Dubai: membership billing day (downgrades, reminders, cancellations), "choose your books by tonight" reminders,
// and the one "you're nearly there" email for half-finished sign-ups
export async function GET(req: NextRequest) {
  if (!cronAllowed(req)) return NextResponse.json({ error: 'Not allowed' }, { status: 401 })
  const billing = await runBillingDay()
  const cutoffReminders = await sendCutoffReminders()
  const signupReminders = await sendSignupReminders()
  return NextResponse.json({ ok: true, billing, cutoffReminders: cutoffReminders.length, signupReminders: signupReminders.length })
}
