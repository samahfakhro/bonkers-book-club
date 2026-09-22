import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const key = process.env.OPENAI_API_KEY
  return NextResponse.json({
    hasKey: !!key,
    keyLength: key?.length ?? 0,
    keyPrefix: key?.slice(0, 7) ?? 'not set',
  })
}
