import { NextResponse } from 'next/server'
import { publicSettings } from '@/lib/settings'

export const dynamic = 'force-dynamic'

// Settings parents' pages need: plans, choose-by deadline, contact details, signup options
export async function GET() {
  return NextResponse.json(await publicSettings())
}
