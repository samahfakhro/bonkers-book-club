// Server-only. Google Route Optimization: the best visiting order by real roads.
// Signs in with the service account (GOOGLE_SERVICE_ACCOUNT_JSON in Vercel; locally the git-ignored
// google-service-account.json in the project folder). Any problem throws, and the caller falls back to builtInOrder.
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import type { LatLng } from '@/lib/routing/builtin'

type ServiceAccount = { project_id: string; client_email: string; private_key: string }

function serviceAccount(): ServiceAccount | null {
  try {
    const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
      || fs.readFileSync(path.join(process.cwd(), 'google-service-account.json'), 'utf8')
    const sa = JSON.parse(raw)
    return sa.project_id && sa.client_email && sa.private_key ? sa : null
  } catch { return null }
}

export const googleRoutingConfigured = () => serviceAccount() !== null

let cachedToken: { token: string; expires: number } | null = null

async function accessToken(sa: ServiceAccount): Promise<string> {
  if (cachedToken && cachedToken.expires > Date.now() + 60_000) return cachedToken.token
  const now = Math.floor(Date.now() / 1000)
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({
    iss: sa.client_email, scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  })}`
  const signature = crypto.createSign('RSA-SHA256').update(unsigned).sign(sa.private_key, 'base64url')
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${signature}` }),
  })
  const data = await res.json()
  if (!res.ok || !data.access_token) throw new Error(`Google sign-in failed: ${data.error_description || data.error || res.status}`)
  cachedToken = { token: data.access_token, expires: Date.now() + (data.expires_in ?? 3600) * 1000 }
  return data.access_token
}

// Returns the visiting order as indexes into `stops` (same shape as builtInOrder), plus road distance and drive time.
// The route starts at the warehouse and ends at the last stop.
export async function googleOrder(start: LatLng, stops: LatLng[]): Promise<{ order: number[]; distanceM: number; durationS: number }> {
  if (stops.length <= 1) return { order: stops.map((_, i) => i), distanceM: 0, durationS: 0 }
  const sa = serviceAccount()
  if (!sa) throw new Error('Google route planning is not set up')
  const token = await accessToken(sa)

  const res = await fetch(`https://routeoptimization.googleapis.com/v1/projects/${sa.project_id}:optimizeTours`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(25_000),
    body: JSON.stringify({
      model: {
        shipments: stops.map((s, i) => ({
          label: String(i),
          deliveries: [{ arrivalLocation: { latitude: s.lat, longitude: s.lng }, duration: '180s' }],   // ~3 minutes at each door
        })),
        vehicles: [{ startLocation: { latitude: start.lat, longitude: start.lng }, costPerKilometer: 1, costPerHour: 30 }],
      },
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`Google route planning failed: ${data.error?.message || res.status}`)
  const route = data.routes?.[0]
  if (data.skippedShipments?.length) throw new Error('Google skipped some stops')
  // Google leaves out shipmentIndex when it is 0, so read the label we set instead
  const order: number[] = (route?.visits || []).map((v: { shipmentLabel?: string; shipmentIndex?: number }) => Number(v.shipmentLabel ?? v.shipmentIndex ?? 0))
  if (order.length !== stops.length || new Set(order).size !== stops.length) throw new Error('Google returned an incomplete route')
  return {
    order,
    distanceM: Number(route.metrics?.travelDistanceMeters ?? 0),
    durationS: parseInt(String(route.metrics?.travelDuration ?? route.metrics?.totalDuration ?? '0'), 10) || 0,
  }
}
