import { NextRequest, NextResponse } from 'next/server'
import { checkAvailability } from '@/lib/membership/availability'

// Public — only ever says yes/no. The real reason stays on the server.
export async function POST(request: NextRequest) {
  try {
    const { lat, lng } = await request.json()
    const result = await checkAvailability(lat, lng)
    return NextResponse.json({ canJoin: result.canJoin })
  } catch {
    return NextResponse.json({ canJoin: false })
  }
}
