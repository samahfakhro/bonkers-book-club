import booleanPointInPolygon from '@turf/boolean-point-in-polygon'
import { point } from '@turf/helpers'
import { supabaseAdmin } from '@/lib/supabase-admin'

// Server-only — decides whether a new household can join, using the caps/pauses set in /admin/capacity.
// Book stock and reading stages never block a signup (information only for V1).

export type WaitlistReason =
  | 'GLOBAL_PAUSED'
  | 'ZONE_NOT_OPEN'       // outside every zone, or zone has no Bonkers Day yet
  | 'ZONE_PAUSED'
  | 'GLOBAL_CAP_REACHED'
  | 'ZONE_CAP_REACHED'
  | 'CHECK_FAILED'        // something went wrong — fail safe to the waitlist

export type Availability =
  | { canJoin: true; zoneId: string; bonkersDay: string }
  | { canJoin: false; reason: WaitlistReason; zoneId: string | null }

// Paused families keep their place; cancelled ones free it
export const PLACE_HOLDING_STATUSES = ['active', 'paused']

// Empty / missing / 0 cap = no limit (to stop signups, use Pause)
export function parseCap(value: unknown): number | null {
  if (value == null || String(value).trim() === '') return null
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null
}

type ZoneRow ={ id: string; name: string; bonkers_day: string | null; polygon: any; membership_cap: number | null; is_paused: boolean }

export async function checkAvailability(lat: number | null | undefined, lng: number | null | undefined): Promise<Availability> {
  try {
    const [settingsRes, zonesRes] = await Promise.all([
      supabaseAdmin.from('system_settings').select('key, value').in('key', ['global_membership_cap', 'global_memberships_paused']),
      supabaseAdmin.from('zones').select('id, name, bonkers_day, polygon, membership_cap, is_paused'),
    ])
    if (settingsRes.error || zonesRes.error) throw settingsRes.error ?? zonesRes.error

    const setting = (key: string) => settingsRes.data.find(s => s.key === key)?.value
    const globalCap = parseCap(setting('global_membership_cap'))
    const globalPaused = String(setting('global_memberships_paused')) === 'true'

    if (globalPaused) return { canJoin: false, reason: 'GLOBAL_PAUSED', zoneId: null }

    // Which zone is the pin in? Must be exactly one
    if (typeof lat !== 'number' || typeof lng !== 'number') return { canJoin: false, reason: 'ZONE_NOT_OPEN', zoneId: null }
    const pt = point([lng, lat])
    const matches = (zonesRes.data as ZoneRow[]).filter(z => {
      try { return !!z.polygon && booleanPointInPolygon(pt, z.polygon) } catch { return false }
    })
    if (matches.length > 1) {
      console.error('Pin is inside more than one delivery zone', { lat, lng, zones: matches.map(z => z.name) })
      return { canJoin: false, reason: 'CHECK_FAILED', zoneId: null }
    }
    const zone = matches[0]
    // A zone needs a Bonkers Day to be open. An empty cap means no limit.
    if (!zone || !zone.bonkers_day) return { canJoin: false, reason: 'ZONE_NOT_OPEN', zoneId: zone?.id ?? null }
    if (zone.is_paused) return { canJoin: false, reason: 'ZONE_PAUSED', zoneId: zone.id }

    // Places taken globally and in this zone
    const [globalCount, zoneCount] = await Promise.all([
      supabaseAdmin.from('households').select('id', { count: 'exact', head: true }).in('account_status', PLACE_HOLDING_STATUSES),
      supabaseAdmin.from('households').select('id', { count: 'exact', head: true }).in('account_status', PLACE_HOLDING_STATUSES).eq('signup_zone_id', zone.id),
    ])
    if (globalCount.error || zoneCount.error) throw globalCount.error ?? zoneCount.error

    if (globalCap != null && (globalCount.count ?? 0) >= globalCap) return { canJoin: false, reason: 'GLOBAL_CAP_REACHED', zoneId: zone.id }
    const zoneCap = parseCap(zone.membership_cap)
    if (zoneCap != null && (zoneCount.count ?? 0) >= zoneCap) return { canJoin: false, reason: 'ZONE_CAP_REACHED', zoneId: zone.id }

    return { canJoin: true, zoneId: zone.id, bonkersDay: zone.bonkers_day }
  } catch (err) {
    console.error('Availability check failed:', err)
    return { canJoin: false, reason: 'CHECK_FAILED', zoneId: null }
  }
}
