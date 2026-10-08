import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { PLACE_HOLDING_STATUSES, parseCap } from '@/lib/membership/availability'

// Capacity dashboard — everything here is information except the caps/pauses, which signup enforces.

export const dynamic = 'force-dynamic'

const DAY_ORDER = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DEFAULT_BOOKS_PER_CHILD_WARNING = 10
const NOT_USABLE = ['retired', 'lost', 'removed', 'damaged']

// Child stage from date of birth: under 5 → 1st stage (Hatchling), 5–7 → 2nd (Chick), 8+ → 3rd (Bird)
function stageIndexForAge(dob: string | null): number | null {
  if (!dob) return null
  const birth = new Date(dob)
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  if (now < new Date(now.getFullYear(), birth.getMonth(), birth.getDate())) age--
  return age < 5 ? 0 : age < 8 ? 1 : 2
}

const countBy = (items: (string | null)[]) => {
  const counts: Record<string, number> = {}
  for (const k of items) { const key = k?.trim() || 'Unknown'; counts[key] = (counts[key] ?? 0) + 1 }
  return Object.entries(counts).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count)
}

export async function GET() {
  const [settingsRes, zonesRes, householdsRes, copiesRes, booksRes, bookLevelsRes, levelsRes, childrenRes, waitlistRes] = await Promise.all([
    supabaseAdmin.from('system_settings').select('key, value'),
    supabaseAdmin.from('zones').select('id, code, name, bonkers_day, membership_cap, is_paused'),
    supabaseAdmin.from('households').select('id, signup_zone_id').in('account_status', PLACE_HOLDING_STATUSES),
    supabaseAdmin.from('book_copies').select('book_id, status, is_suitable_for_circulation'),
    supabaseAdmin.from('books').select('id, reading_level_id, reading_level_ids').eq('is_active', true),
    supabaseAdmin.from('book_reading_levels').select('book_id, reading_level_id'),
    supabaseAdmin.from('reading_levels').select('id, name, display_order').order('display_order'),
    supabaseAdmin.from('child_profiles').select('household_id, date_of_birth').eq('is_active', true),
    supabaseAdmin.from('waitlist_signup').select('zone_id, community_name, reason, latitude').eq('status', 'waiting'),
  ])
  const failed = [settingsRes, zonesRes, householdsRes, copiesRes, booksRes, bookLevelsRes, levelsRes, childrenRes, waitlistRes].find(r => r.error)
  if (failed) return NextResponse.json({ error: failed.error!.message }, { status: 500 })

  const setting = (key: string) => settingsRes.data!.find(s => s.key === key)?.value
  const households = householdsRes.data!
  const zones = zonesRes.data!

  // Memberships
  const globalCap = parseCap(setting('global_membership_cap'))
  const memberships = {
    active: households.length,
    cap: globalCap,
    paused: String(setting('global_memberships_paused')) === 'true',
  }

  const zoneRows = zones
    .map(z => ({ ...z, active: households.filter(h => h.signup_zone_id === z.id).length }))
    .sort((a, b) => (DAY_ORDER.indexOf(a.bonkers_day ?? '') + 1 || 99) - (DAY_ORDER.indexOf(b.bonkers_day ?? '') + 1 || 99) || (a.code ?? '').localeCompare(b.code ?? ''))

  // Books (only active titles, only copies fit for circulation)
  const activeBookIds = new Set(booksRes.data!.map(b => b.id))
  const usable = copiesRes.data!.filter(c => activeBookIds.has(c.book_id) && c.is_suitable_for_circulation !== false && !NOT_USABLE.includes(c.status))
  const available = usable.filter(c => c.status === 'available')
  const books = { usable: usable.length, borrowed: usable.length - available.length, available: available.length }

  // Which stages each book belongs to (a book can be in more than one)
  const bookStages = new Map<string, Set<string>>()
  const addStage = (bookId: string, levelId: string | null) => {
    if (!levelId) return
    if (!bookStages.has(bookId)) bookStages.set(bookId, new Set())
    bookStages.get(bookId)!.add(levelId)
  }
  for (const b of booksRes.data!) {
    addStage(b.id, b.reading_level_id)
    for (const id of b.reading_level_ids ?? []) addStage(b.id, id)
  }
  for (const r of bookLevelsRes.data!) addStage(r.book_id, r.reading_level_id)

  // Children in households that hold a place
  const memberHouseholds = new Set(households.map(h => h.id))
  const children = childrenRes.data!.filter(c => memberHouseholds.has(c.household_id))
  const levels = levelsRes.data!
  const stageCounts = new Array(levels.length).fill(0)
  let unknownAge = 0
  for (const c of children) {
    const i = stageIndexForAge(c.date_of_birth)
    if (i == null || !levels[i]) unknownAge++
    else stageCounts[i]++
  }
  const stageNames: Record<string, string> = { '3-5': 'Hatchling', '5-7': 'Chick', '8-10': 'Bird' }
  const stages = levels.map((l, i) => ({
    id: l.id,
    name: stageNames[l.name] ?? l.name,
    ages: l.name,
    children: stageCounts[i],
    availableBooks: available.filter(c => bookStages.get(c.book_id)?.has(l.id)).length,
    usableBooks: usable.filter(c => bookStages.get(c.book_id)?.has(l.id)).length,
  }))

  // Waitlist demand
  const waiting = waitlistRes.data!
  const zoneName = (id: string | null) => {
    const z = zones.find(z => z.id === id)
    return z ? `${z.name}${z.bonkers_day ? ` (${z.bonkers_day})` : ''}` : 'Outside all zones'
  }
  const waitlist = {
    total: waiting.length,
    byZone: countBy(waiting.map(w => w.latitude == null ? 'No map pin (older entry)' : zoneName(w.zone_id))),
    byArea: countBy(waiting.map(w => w.community_name)),
    byReason: countBy(waiting.map(w => w.reason)),
  }

  const booksPerChildWarning = parseCap(setting('stage_books_per_child_warning')) ?? DEFAULT_BOOKS_PER_CHILD_WARNING

  return NextResponse.json({ memberships, zones: zoneRows, books, stages, unknownAge, waitlist, booksPerChildWarning })
}

// Save a cap / pause. Empty cap = no limit.
export async function POST(req: NextRequest) {
  const body = await req.json()
  const capValue = (v: unknown) => {
    if (v == null || String(v).trim() === '') return { ok: true, cap: null }
    const n = Number(v)
    return Number.isInteger(n) && n >= 0 ? { ok: true, cap: n === 0 ? null : n } : { ok: false, cap: null } // 0 = no limit
  }

  if (body.type === 'global') {
    const rows: { key: string; value: string; updated_at: string }[] = []
    const now = new Date().toISOString()
    if ('cap' in body) {
      const c = capValue(body.cap)
      if (!c.ok) return NextResponse.json({ error: 'Cap must be a whole number (0 or empty = no limit)' }, { status: 400 })
      rows.push({ key: 'global_membership_cap', value: c.cap == null ? '' : String(c.cap), updated_at: now })
    }
    if ('paused' in body) rows.push({ key: 'global_memberships_paused', value: body.paused ? 'true' : 'false', updated_at: now })
    if ('booksPerChildWarning' in body) {
      const c = capValue(body.booksPerChildWarning)
      if (!c.ok) return NextResponse.json({ error: 'Warning level must be a whole number' }, { status: 400 })
      rows.push({ key: 'stage_books_per_child_warning', value: c.cap == null ? '' : String(c.cap), updated_at: now })
    }
    const { error } = await supabaseAdmin.from('system_settings').upsert(rows, { onConflict: 'key' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (body.type === 'zone' && body.id) {
    const update: { membership_cap?: number | null; is_paused?: boolean; updated_at: string } = { updated_at: new Date().toISOString() }
    if ('cap' in body) {
      const c = capValue(body.cap)
      if (!c.ok) return NextResponse.json({ error: 'Cap must be a whole number (0 or empty = no limit)' }, { status: 400 })
      update.membership_cap = c.cap
    }
    if ('paused' in body) update.is_paused = !!body.paused
    const { error } = await supabaseAdmin.from('zones').update(update).eq('id', body.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown update' }, { status: 400 })
}
