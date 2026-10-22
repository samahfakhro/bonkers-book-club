// Team roles and what each may use. Safe in the browser (no secrets).
// Staff are managed in Admin → Team (team_members table).

export type TeamRole = 'admin' | 'driver' | 'warehouse'

export const ROLE_LABEL: Record<TeamRole, string> = { admin: 'Admin', driver: 'Driver', warehouse: 'Warehouse' }
export const ROLE_HINT: Record<TeamRole, string> = {
  admin: 'Everything',
  driver: 'Route screens only',
  warehouse: 'Packing, loading and returns only',
}

// Warehouse staff only see these admin screens (and the APIs behind them)
export const WAREHOUSE_PAGES = ['/admin/operations']
export const WAREHOUSE_APIS = ['/api/admin/packing', '/api/admin/returns', '/api/admin/routes']

// Where each role lands after logging in
export const HOME_FOR: Record<TeamRole, string> = { admin: '/admin', driver: '/driver', warehouse: '/admin/operations' }

const under = (path: string, prefixes: string[]) => prefixes.some(p => path === p || path.startsWith(p + '/') || path.startsWith(p + '?'))

export function canUsePage(role: TeamRole, path: string): boolean {
  if (role === 'admin') return true
  if (role === 'driver') return under(path, ['/driver'])
  return under(path, WAREHOUSE_PAGES)
}

export function canUseApi(role: TeamRole, path: string): boolean {
  if (role === 'admin') return true
  if (role === 'driver') return under(path, ['/api/driver'])
  return under(path, WAREHOUSE_APIS)
}

// Mobile numbers are stored as digits with the country code, e.g. 0501234567 → 971501234567
export function normalisePhone(raw: string): string {
  let d = (raw || '').replace(/\D/g, '')
  if (d.startsWith('00')) d = d.slice(2)
  if (d.startsWith('0')) d = '971' + d.slice(1)
  if (d.length === 9 && d.startsWith('5')) d = '971' + d
  return d
}

// Staff without email log in with their mobile; behind the scenes the login uses this hidden address (never emailed)
export const hiddenTeamEmail = (phoneDigits: string) => `t${phoneDigits}@team.curiouslibrary.ae`

// What someone types on the team login page → the email the login system knows them by
export const loginEmailFor = (typed: string) => typed.includes('@') ? typed.trim().toLowerCase() : hiddenTeamEmail(normalisePhone(typed))
