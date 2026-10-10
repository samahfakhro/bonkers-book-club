import { supabaseAdmin } from '@/lib/supabase-admin'

// Admin Reports. Everything is worked out from the raw tables for the chosen date range (Dubai dates).

const NOT_USABLE = ['retired', 'lost', 'lost_settled', 'removed', 'damaged', 'withdrawn']
const ACTIVE = ['active', 'paused']
const STAGES = ['Hatchling', 'Chick', 'Bird']

const dubaiDate = (iso: string | null | undefined) => iso ? new Date(Date.parse(iso) + 4 * 3600_000).toISOString().slice(0, 10) : null
const month = (iso: string | null | undefined) => dubaiDate(iso)?.slice(0, 7) ?? null
function stageForAge(dob: string | null) {
  if (!dob) return null
  const b = new Date(dob), now = new Date()
  let age = now.getFullYear() - b.getFullYear()
  if (now < new Date(now.getFullYear(), b.getMonth(), b.getDate())) age--
  return STAGES[age < 5 ? 0 : age < 8 ? 1 : 2]
}
const tally = (keys: (string | null | undefined)[]) => {
  const m = new Map<string, number>()
  keys.forEach(k => { const key = (k || 'Unknown').toString(); m.set(key, (m.get(key) || 0) + 1) })
  return [...m.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count)
}
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : null)

export async function buildReport(from: string | null, to: string | null) {
  const inRange = (iso: string | null | undefined) => {
    const d = dubaiDate(iso)
    return !!d && (!from || d >= from) && (!to || d <= to)
  }

  const [hhRes, subsRes, kidsRes, visitsRes, waitRes, loansRes, copiesRes, booksRes] = await Promise.all([
    supabaseAdmin.from('households').select('id, created_at, account_status, first_touch_source, signup_source_category, name'),
    supabaseAdmin.from('subscriptions').select('household_id, status, cancelled_at, created_at'),
    supabaseAdmin.from('child_profiles').select('id, household_id, date_of_birth, is_active'),
    supabaseAdmin.from('site_visits').select('source, created_at'),
    supabaseAdmin.from('waitlist_signup').select('created_at, status, first_touch_source, community_name, zone_id, invited_at, joined_at, zones(name)'),
    supabaseAdmin.from('loans').select('id, child_id, household_id, checked_out_at, returned_at, status, book_copies(book_id)'),
    supabaseAdmin.from('book_copies').select('book_id, status'),
    supabaseAdmin.from('books').select('id, title, cover_image_url, average_rating, total_ratings_count, age_min, is_active'),
  ])
  // test families are left out of every number
  const households = (hhRes.data || []).filter(h => h.name !== 'TEST DATA')
  const real = new Set(households.map(h => h.id))
  const subs = (subsRes.data || []).filter(s => real.has(s.household_id))
  const kids = (kidsRes.data || []).filter(k => real.has(k.household_id) && k.is_active !== false)
  const loans = (loansRes.data || []).filter(l => real.has(l.household_id))
  const books = (booksRes.data || []).filter(b => b.is_active !== false)
  const bookById = new Map(books.map(b => [b.id, b]))

  // ── Members ──
  const signups = households.filter(h => inRange(h.created_at))
  const cancellations = subs.filter(s => s.cancelled_at && inRange(s.cancelled_at))
  const activeFamilies = households.filter(h => ACTIVE.includes(h.account_status || '')).length
  const kidsPerFamily = new Map<string, number>()
  kids.forEach(k => kidsPerFamily.set(k.household_id, (kidsPerFamily.get(k.household_id) || 0) + 1))
  const activeIds = households.filter(h => ACTIVE.includes(h.account_status || '')).map(h => h.id)
  const childrenPerFamily = tally(activeIds.map(id => { const n = kidsPerFamily.get(id) || 0; return n >= 3 ? '3 or more' : `${n} child${n === 1 ? '' : 'ren'}` }))
  const months = [...new Set([...signups.map(h => month(h.created_at)!), ...cancellations.map(s => month(s.cancelled_at)!)])].sort()
  const byMonth = months.map(m => ({
    month: m, signups: signups.filter(h => month(h.created_at) === m).length,
    cancellations: cancellations.filter(s => month(s.cancelled_at) === m).length,
  }))

  // ── Where families come from ──
  const visits = (visitsRes.data || []).filter(v => inRange(v.created_at))
  const wait = waitRes.data || []
  const waitInRange = wait.filter(w => inRange(w.created_at))
  const sources = [...new Set([...visits.map(v => v.source), ...waitInRange.map(w => w.first_touch_source || 'unknown'), ...signups.map(h => h.first_touch_source || 'unknown')])]
  const funnel = sources.map(source => {
    const v = visits.filter(x => x.source === source).length
    const w = waitInRange.filter(x => (x.first_touch_source || 'unknown') === source).length
    const m = signups.filter(x => (x.first_touch_source || 'unknown') === source).length
    return { source, visits: v, waitlist: w, members: m, visitToMember: pct(m, v) }
  }).sort((a, b) => b.members - a.members || b.visits - a.visits)
  const saidVsSaw = tally(signups.map(h => `${h.signup_source_category || 'not asked'} → ${h.first_touch_source || 'unknown'}`))
    .map(r => { const [said, saw] = r.label.split(' → '); return { said, saw, count: r.count } })

  // ── Books ──
  const loansInRange = loans.filter(l => inRange(l.checked_out_at))
  const loanBook = (l: any) => l.book_copies?.book_id as string | undefined
  const borrowCount = tally(loansInRange.map(loanBook))
  const mostBorrowed = borrowCount.filter(r => bookById.has(r.label)).slice(0, 10)
    .map(r => ({ title: bookById.get(r.label)!.title, cover: bookById.get(r.label)!.cover_image_url, count: r.count }))
  const everBorrowed = new Set(loans.map(loanBook))
  const neverBorrowedList = books.filter(b => !everBorrowed.has(b.id))
  const bestReviewed = books.filter(b => Number(b.total_ratings_count) > 0)
    .sort((a, b) => Number(b.average_rating) - Number(a.average_rating) || Number(b.total_ratings_count) - Number(a.total_ratings_count)).slice(0, 10)
    .map(b => ({ title: b.title, cover: b.cover_image_url, rating: Number(b.average_rating), ratings: Number(b.total_ratings_count) }))
  const returned = loans.filter(l => l.returned_at && inRange(l.returned_at) && l.checked_out_at)
  const avgDaysOut = returned.length ? Math.round(returned.reduce((s, l) => s + (Date.parse(l.returned_at!) - Date.parse(l.checked_out_at!)) / 86400_000, 0) / returned.length) : null
  const kidStage = new Map(kids.map(k => [k.id, stageForAge(k.date_of_birth)]))
  const loansByStage = STAGES.map(stage => {
    const stageKids = kids.filter(k => kidStage.get(k.id) === stage).length
    const n = loansInRange.filter(l => kidStage.get(l.child_id) === stage).length
    return { stage, children: stageKids, loans: n, perChild: stageKids ? Math.round((n / stageKids) * 10) / 10 : null }
  })

  // ── Stock (today) ──
  const usable = (copiesRes.data || []).filter(c => !NOT_USABLE.includes(c.status || ''))
  const bookStage = (id: string) => { const a = Number(bookById.get(id)?.age_min); return Number.isFinite(a) && bookById.get(id)?.age_min != null ? STAGES[a < 5 ? 0 : a < 8 ? 1 : 2] : null }
  const stockByStage = STAGES.map(stage => {
    const children = kids.filter(k => activeIds.includes(k.household_id) && kidStage.get(k.id) === stage).length
    const copies = usable.filter(c => bookStage(c.book_id) === stage).length
    return { stage, copies, children, perChild: children ? Math.round((copies / children) * 10) / 10 : null }
  })
  const stock = {
    usableCopies: usable.length, onShelf: usable.filter(c => c.status === 'available').length, activeFamilies,
    perTenFamilies: activeFamilies ? Math.round((usable.length / activeFamilies) * 10) : null, guidePerTen: 100,
    unknownStageCopies: usable.filter(c => !bookStage(c.book_id)).length, byStage: stockByStage,
  }

  // ── Waitlist ──
  const invited = wait.filter(w => w.invited_at && inRange(w.invited_at))
  const joinedFromInvite = invited.filter(w => w.status === 'joined' || w.joined_at)
  const waitlist = {
    newEntries: waitInRange.length,
    stillWaiting: wait.filter(w => w.status === 'waiting' || w.status === 'invited').length,
    byArea: tally(waitInRange.map(w => w.community_name)).slice(0, 15),
    byZone: tally(waitInRange.map(w => (w.zones as any)?.name || (w.zone_id ? 'Zone' : 'Outside all zones'))),
    invited: invited.length, joined: joinedFromInvite.length, inviteToJoin: pct(joinedFromInvite.length, invited.length),
    byMonth: [...new Set(waitInRange.map(w => month(w.created_at)!))].sort().map(m => ({ month: m, count: waitInRange.filter(w => month(w.created_at) === m).length })),
  }

  return {
    range: { from, to },
    members: { signups: signups.length, cancellations: cancellations.length, activeFamilies, childrenPerFamily, byMonth },
    sources: { funnel, saidVsSaw, totalVisits: visits.length },
    books: { mostBorrowed, neverBorrowed: neverBorrowedList.length, neverBorrowedSample: neverBorrowedList.slice(0, 12).map(b => ({ title: b.title, cover: b.cover_image_url })), bestReviewed, avgDaysOut, loansInRange: loansInRange.length, loansByStage },
    stock, waitlist,
  }
}
