// Visit tracking (browser side). On a visitor's first ever page view we work out where they came from —
// a tagged link (?src=instagram or utm_source), else the site that sent them, else "direct" — and keep it
// in their browser. It's sent along when they join the waitlist or sign up. Anonymous: just a random id.

export type FirstTouch = { visitorId: string; source: string; medium: string | null; campaign: string | null; referrer: string | null; landingPath: string; at: string }

const KEY = 'bonkers_first_touch'

// referrer site → source name
const SITES: [RegExp, string][] = [
  [/instagram\.com|l\.instagram/, 'instagram'], [/tiktok\.com/, 'tiktok'],
  [/chatgpt\.com|chat\.openai\.com|openai\.com/, 'chatgpt'], [/perplexity\.ai/, 'perplexity'],
  [/gemini\.google\.com|bard\.google\.com/, 'gemini'], [/claude\.ai/, 'claude'],
  [/google\./, 'google'], [/bing\.com/, 'bing'],
  [/facebook\.com|fb\.com|fb\.me|m\.facebook/, 'facebook'], [/whatsapp\.com|wa\.me/, 'whatsapp'],
]

export function sourceFrom(search: string, referrer: string, ownHost: string): { source: string; medium: string | null; campaign: string | null } {
  const q = new URLSearchParams(search)
  const tagged = (q.get('src') || q.get('utm_source') || '').trim().toLowerCase()
  const medium = q.get('utm_medium'), campaign = q.get('utm_campaign')
  if (tagged) return { source: tagged.replace(/[^a-z0-9_-]/g, '').slice(0, 40) || 'other', medium, campaign }
  let host = ''
  try { host = referrer ? new URL(referrer).hostname.replace(/^www\./, '') : '' } catch {}
  if (!host || host === ownHost.replace(/^www\./, '')) return { source: 'direct', medium, campaign }
  return { source: SITES.find(([re]) => re.test(host))?.[1] ?? host, medium, campaign }
}

export function getFirstTouch(): FirstTouch | null {
  try { const v = localStorage.getItem(KEY); return v ? JSON.parse(v) : null } catch { return null }
}

// Call on every page view; only the very first one is recorded
export function recordFirstTouch() {
  if (getFirstTouch()) return
  const { source, medium, campaign } = sourceFrom(window.location.search, document.referrer, window.location.hostname)
  const touch: FirstTouch = {
    visitorId: crypto.randomUUID(), source, medium, campaign,
    referrer: document.referrer || null, landingPath: window.location.pathname, at: new Date().toISOString(),
  }
  try { localStorage.setItem(KEY, JSON.stringify(touch)) } catch { return }
  fetch('/api/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(touch), keepalive: true }).catch(() => {})
}
