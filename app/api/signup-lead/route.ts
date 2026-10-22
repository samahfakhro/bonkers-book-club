import { NextRequest, NextResponse } from 'next/server'
import { leadByToken, saveLead } from '@/lib/signup-leads'

// POST: save details after "About you" (so a reminder can bring them back). GET ?token=: the details for the resume link.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const result = await saveLead(body)
  return 'error' in result ? NextResponse.json(result, { status: 400 }) : NextResponse.json(result)
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token') || ''
  if (!/^[0-9a-f-]{36}$/i.test(token)) return NextResponse.json({ lead: null })
  return NextResponse.json({ lead: await leadByToken(token) })
}
