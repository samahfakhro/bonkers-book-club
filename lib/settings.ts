import { supabaseAdmin } from '@/lib/supabase-admin'

// Server-only. Admin-editable settings (system_settings key/value) and the plans list.

export type HowOption = { value: string; label: string; followUp: string | null }
export type Plan = { id: string; name: string; book_count: number; price_monthly: number; is_active: boolean }

export const SETTING_GROUPS: { title: string; fields: { key: string; label: string; type: 'number' | 'text' | 'boolean'; hint?: string }[] }[] = [
  { title: 'Choosing books', fields: [
    { key: 'cutoff_days_before', label: 'Days before the Bonkers Day that choices close', type: 'number', hint: 'The time is set per zone (Zones page).' },
  ] },
  { title: 'Contact details shown to parents', fields: [
    { key: 'contact_whatsapp', label: 'WhatsApp number', type: 'text', hint: 'e.g. 0501234567' },
    { key: 'contact_email', label: 'Email', type: 'text' },
  ] },
  { title: 'Returns and charges', fields: [
    { key: 'default_replacement_aed', label: 'Default replacement price (AED)', type: 'number', hint: 'Used when a copy has no price of its own.' },
    { key: 'lost_charge_percent', label: 'Lost book — % of replacement price', type: 'number' },
    { key: 'damage_charge_percent', label: 'Damaged book — % of replacement price', type: 'number' },
    { key: 'damage_warning_level', label: 'Damaged books before a ⚠ flag', type: 'number' },
    { key: 'on_hold_needs_action_weeks', label: 'Weeks on hold before “Needs action” (mark lost / charge)', type: 'number' },
  ] },
  { title: 'New families', fields: [
    { key: 'default_notify_whatsapp', label: 'WhatsApp messages on by default', type: 'boolean' },
    { key: 'default_notify_email', label: 'Email messages on by default', type: 'boolean' },
  ] },
]
const ALL_KEYS = [...SETTING_GROUPS.flatMap(g => g.fields.map(f => f.key)), 'how_heard_options']

export async function getSettingValues(keys = ALL_KEYS): Promise<Record<string, string>> {
  const { data } = await supabaseAdmin.from('system_settings').select('key, value').in('key', keys)
  return Object.fromEntries((data || []).map(r => [r.key, r.value ?? '']))
}

export async function getPlans(activeOnly = false): Promise<Plan[]> {
  let q = supabaseAdmin.from('subscription_plans').select('id, name, book_count, price_monthly, is_active').order('price_monthly')
  if (activeOnly) q = q.eq('is_active', true)
  const { data } = await q
  return (data || []).map(p => ({ ...p, book_count: Number(p.book_count), price_monthly: Number(p.price_monthly) })) as Plan[]
}

export function parseHowOptions(raw: string | undefined): HowOption[] {
  try { const v = JSON.parse(raw || '[]'); return Array.isArray(v) ? v : [] } catch { return [] }
}

// What parents' pages need (no secrets)
export async function publicSettings() {
  const [s, plans] = await Promise.all([getSettingValues(), getPlans(true)])
  return {
    cutoffDaysBefore: Number(s.cutoff_days_before) || 2,
    contactWhatsapp: s.contact_whatsapp || '',
    contactEmail: s.contact_email || 'hello@bonkers.ae',
    howHeard: parseHowOptions(s.how_heard_options),
    defaultNotifyWhatsapp: s.default_notify_whatsapp !== 'false',
    defaultNotifyEmail: s.default_notify_email !== 'false',
    plans: plans.map(p => ({ id: p.id, name: p.name, books: p.book_count, price: p.price_monthly })),
  }
}
