import { NextRequest, NextResponse } from 'next/server'

// Supabase redirects here after email confirmation with ?code=xxx (PKCE flow)
// The client-side supabase instance will exchange the code automatically when
// the dashboard page loads — we just need to forward it with the code in the URL.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    // Forward to dashboard with the code — the client will exchange it via
    // supabase.auth.exchangeCodeForSession() on load
    return NextResponse.redirect(`${origin}${next}?code=${code}`)
  }

  return NextResponse.redirect(`${origin}/dashboard`)
}
