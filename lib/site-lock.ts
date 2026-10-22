// Site lock: while SITE_PASSWORD is set, every page needs the password first (pre-launch trial).
// Remove SITE_PASSWORD (in Vercel) at launch and the site opens to everyone — nothing else changes.
// Links that arrive by email / WhatsApp and are already protected by their own private token stay open.

export const SITE_COOKIE = 'site_access'

export const sitePassword = () => process.env.SITE_PASSWORD || ''

// What the cookie holds: a fingerprint of the password, never the password itself
export async function accessToken(password: string) {
  const data = new TextEncoder().encode(`curious-library:${password}`)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}

const OPEN_PATHS = [
  '/locked', '/api/site-lock',            // the lock page itself
  '/api/cron',                            // scheduled jobs (they check their own secret)
  '/api/webhooks',                        // payment providers (they check their own signature)
  '/m', '/api/m',                         // missed-visit links (private token)
  '/stop-alerts', '/api/stop-alerts',     // "stop alerts for this book" links (private token)
  '/api/signup-lead/unsubscribe',         // unsubscribe from the sign-up reminder (private token)
  '/auth', '/reset-password',             // login links from emails
]
export const isOpenPath = (path: string) => OPEN_PATHS.some(p => path === p || path.startsWith(p + '/') || path.startsWith(p + '?'))
