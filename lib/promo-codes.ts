// Server-only. Promo codes typed at sign-up (managed in Admin → Finance).
// 'free'     → membership with no card and no payment (e.g. the trial families' CURIOUSFRIENDS)
// 'discount' → % off the monthly payment for the first N months, taken off on Stripe's payment page
import { supabaseAdmin } from '@/lib/supabase-admin'

export type PromoCode = {
  id: string; code: string; kind: 'free' | 'discount'; percent_off: number | null; duration_months: number | null
  stripe_coupon_id: string | null; max_uses: number | null; times_used: number; expires_on: string | null; active: boolean; note: string | null
}

export const cleanCode = (raw: unknown) => String(raw ?? '').trim().toUpperCase().replace(/\s+/g, '')

// What the family is told the code gives them
export function describeCode(p: Pick<PromoCode, 'kind' | 'percent_off' | 'duration_months'>) {
  if (p.kind === 'free') return 'Free membership. No card needed.'
  const months = p.duration_months || 1
  const what = p.percent_off === 100 ? 'free' : `${p.percent_off}% off`
  return months === 1 ? `Your first month ${what}.` : `Your first ${months} months ${what}.`
}

// A code that can be used right now, or the reason it can't
export async function usableCode(raw: unknown): Promise<{ ok: true; promo: PromoCode } | { ok: false; error: string }> {
  const code = cleanCode(raw)
  if (!code) return { ok: false, error: 'Please type a code.' }
  const { data } = await supabaseAdmin.from('promo_codes').select('*').eq('code', code).maybeSingle()
  const p = data as PromoCode | null
  const today = new Date().toISOString().slice(0, 10)
  if (!p || !p.active) return { ok: false, error: 'That code isn’t valid.' }
  if (p.expires_on && p.expires_on < today) return { ok: false, error: 'That code has expired.' }
  if (p.max_uses && p.times_used >= p.max_uses) return { ok: false, error: 'That code has been used up.' }
  if (p.kind === 'discount' && !p.stripe_coupon_id) return { ok: false, error: 'That code isn’t valid.' }
  return { ok: true, promo: p }
}

export async function markCodeUsed(code: string | null | undefined) {
  if (!code) return
  const { data } = await supabaseAdmin.from('promo_codes').select('id, times_used').eq('code', cleanCode(code)).maybeSingle()
  if (data) await supabaseAdmin.from('promo_codes').update({ times_used: (data.times_used || 0) + 1 }).eq('id', data.id)
}
