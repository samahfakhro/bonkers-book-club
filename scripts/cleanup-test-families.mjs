// Removes every TEST family created for route/packing/driver testing, and everything hanging off them.
// Test families are marked with households.name = 'TEST DATA'. Real families are never touched.
// Run from the project folder:  node scripts/cleanup-test-families.mjs
import fs from 'node:fs'

const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split(/\r?\n/).filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]))
const URL = env.NEXT_PUBLIC_SUPABASE_URL, KEY = env.SUPABASE_SERVICE_ROLE_KEY
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' }
const api = async (method, path) => {
  const res = await fetch(`${URL}/rest/v1/${path}`, { method, headers: H })
  const text = await res.text()
  if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${text}`)
  return text ? JSON.parse(text) : []
}
const inList = ids => `in.(${ids.join(',')})`

const households = await api('GET', 'households?name=eq.TEST%20DATA&select=id,first_name,last_name')
if (!households.length) { console.log('No test families found — nothing to do.'); process.exit(0) }
const hhIds = households.map(h => h.id)
console.log(`Removing ${households.length} test families…`)

const requests = await api('GET', `swap_requests?household_id=${inList(hhIds)}&select=id`)
if (requests.length) await api('DELETE', `swap_request_items?swap_request_id=${inList(requests.map(r => r.id))}`)
const counts = {
  swap_requests: (await api('DELETE', `swap_requests?household_id=${inList(hhIds)}`)).length,
  loans: (await api('DELETE', `loans?household_id=${inList(hhIds)}`)).length,
  route_stops: (await api('DELETE', `route_stops?household_id=${inList(hhIds)}`)).length,
  child_profiles: (await api('DELETE', `child_profiles?household_id=${inList(hhIds)}`)).length,
  households: (await api('DELETE', `households?id=${inList(hhIds)}`)).length,
}
console.log('Removed:', Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(', '))
console.log('Tip: rebuild any draft routes so their stop numbers close up.')
