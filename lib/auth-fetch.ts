import { supabase } from '@/lib/supabase'

// Admin and driver pages call /api/admin/* and /api/driver/* with plain fetch().
// This adds the signed-in session token to those calls so proxy.ts can check who's asking.
let installed = false

export function installAuthFetch() {
  if (installed || typeof window === 'undefined') return
  installed = true
  const original = window.fetch.bind(window)
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    let path = ''
    try { const u = new URL(url, window.location.origin); if (u.origin === window.location.origin) path = u.pathname } catch {}
    if (!/^\/api\/(admin|driver)\//.test(path)) return original(input, init)
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined))
    if (!headers.has('Authorization')) {
      const { data } = await supabase.auth.getSession()
      if (data.session) headers.set('Authorization', `Bearer ${data.session.access_token}`)
    }
    return original(input, { ...init, headers })
  }
}
