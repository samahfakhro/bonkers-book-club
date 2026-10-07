import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { findZoneProblems, toPolygon, type ZoneShape } from '@/lib/zones/validate'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

type IncomingZone = ZoneShape & { name: string; bonkers_day: string | null; cutoff_time: string }

// Save all drawn zones. Rows are matched by code (Z1…Z6) so existing zone ids — and the
// households pointing at them — are kept.
export async function POST(req: NextRequest) {
  const { zones } = await req.json() as { zones: IncomingZone[] }
  if (!Array.isArray(zones) || !zones.length) return NextResponse.json({ error: 'No zones sent' }, { status: 400 })

  for (const z of zones) {
    if (!/^Z\d+$/.test(z.code)) return NextResponse.json({ error: `Bad zone code ${z.code}` }, { status: 400 })
    if (z.bonkers_day && !DAYS.includes(z.bonkers_day)) return NextResponse.json({ error: `${z.code}: delivery day must be Sunday–Friday` }, { status: 400 })
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(z.cutoff_time || '')) return NextResponse.json({ error: `${z.code}: cutoff time must look like 20:00` }, { status: 400 })
  }

  const problems = findZoneProblems(zones)
  if (problems.overlaps.length || problems.crossed.length || problems.tooSmall.length) {
    return NextResponse.json({ error: 'Zones overlap or have invalid outlines — fix them before saving', problems: { overlaps: problems.overlaps.map(o => o.codes), crossed: problems.crossed, tooSmall: problems.tooSmall } }, { status: 400 })
  }

  const version = 'drawn-' + new Date().toISOString().slice(0, 16).replace('T', ' ')
  const rows = zones.filter(z => z.ring.length >= 3).map(z => ({
    code: z.code,
    name: z.name.trim() || z.code,
    bonkers_day: z.bonkers_day || null,
    cutoff_time: z.cutoff_time,
    polygon: toPolygon(z),
    version,
    updated_at: new Date().toISOString(),
  }))

  const { error } = await supabaseAdmin.from('zones').upsert(rows, { onConflict: 'code' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, version, saved: rows.length })
}
