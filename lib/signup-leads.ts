// Server-only. Half-finished sign-ups: details saved after "About you", ONE reminder email about 24 hours later.
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendEmail, appUrl } from '@/lib/messaging'
import { renderMessage } from '@/lib/messages'
import { emailHtml } from '@/lib/email-layout'

const clean = (v: unknown, max = 120) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)

export async function saveLead(input: { email?: unknown; firstName?: unknown; lastName?: unknown; phone?: unknown; planId?: unknown }) {
  const email = clean(input.email, 200)?.toLowerCase()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Please enter a valid email' }
  const fields = { first_name: clean(input.firstName), last_name: clean(input.lastName), phone: clean(input.phone, 30), plan_id: clean(input.planId, 40), updated_at: new Date().toISOString() }
  const { data: existing } = await supabaseAdmin.from('signup_leads').select('id, token, completed_at').ilike('email', email).maybeSingle()
  if (existing) {
    if (!existing.completed_at) await supabaseAdmin.from('signup_leads').update(fields).eq('id', existing.id)
    return { token: existing.token as string }
  }
  const { data, error } = await supabaseAdmin.from('signup_leads').insert({ email, ...fields }).select('token').single()
  if (error) return { error: error.message }
  return { token: data.token as string }
}

// details to fill the sign-up form back in from the reminder link
export async function leadByToken(token: string) {
  const { data } = await supabaseAdmin.from('signup_leads').select('email, first_name, last_name, phone, plan_id, completed_at').eq('token', token).maybeSingle()
  if (!data || data.completed_at) return null
  return { email: data.email, firstName: data.first_name, lastName: data.last_name, phone: data.phone, planId: data.plan_id }
}

export const markLeadCompleted = (email: string) =>
  supabaseAdmin.from('signup_leads').update({ completed_at: new Date().toISOString() }).ilike('email', email).is('completed_at', null)

export const unsubscribeLead = (token: string) =>
  supabaseAdmin.from('signup_leads').update({ unsubscribed_at: new Date().toISOString() }).eq('token', token)

// once, for anyone who started 1–7 days ago and still hasn't joined
export async function sendSignupReminders() {
  const now = Date.now()
  const { data: leads } = await supabaseAdmin.from('signup_leads').select('id, email, first_name, token, created_at')
    .is('completed_at', null).is('reminded_at', null).is('unsubscribed_at', null)
    .lte('created_at', new Date(now - 24 * 3600_000).toISOString()).gte('created_at', new Date(now - 7 * 86400_000).toISOString())
  const sent: string[] = []
  for (const lead of leads || []) {
    const m = await renderMessage('signup_reminder', { parent_name: lead.first_name || 'there' })
    const resume = `${appUrl()}/signup?resume=${lead.token}`
    const unsubscribe = `${appUrl()}/api/signup-lead/unsubscribe?token=${lead.token}`
    const html = emailHtml({ greeting: `Hi ${lead.first_name || 'there'},`, title: m.title, paragraphs: [m.body], button: { label: 'Finish joining', url: resume }, extraLink: { label: 'Don’t send me reminders', url: unsubscribe }, settingsUrl: unsubscribe })
    const r = await sendEmail(lead.email, m.title, `Hi ${lead.first_name || 'there'},\n\n${m.body}\n\nFinish joining: ${resume}\n\nDon’t want reminders? ${unsubscribe}\n\nThe Curious Library team`, html)
    // only counts once it has really gone (if email isn't set up yet, it's tried again tomorrow)
    if (r.status === 'sent') {
      await supabaseAdmin.from('signup_leads').update({ reminded_at: new Date().toISOString() }).eq('id', lead.id)
      sent.push(lead.id)
    }
  }
  return sent
}
