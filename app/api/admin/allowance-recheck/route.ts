import { NextRequest, NextResponse } from 'next/server'
import { recheckAllowance } from '@/lib/returns/finish'

// POST { householdId } → after admin changes a family's plan, unblock them if they're now within it
export async function POST(req: NextRequest) {
  const { householdId } = await req.json().catch(() => ({}))
  if (!/^[0-9a-f-]{36}$/.test(String(householdId || ''))) return NextResponse.json({ error: 'Choose a family' }, { status: 400 })
  await recheckAllowance(householdId)
  return NextResponse.json({ ok: true })
}
