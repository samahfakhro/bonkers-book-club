// Server-only. Sends urgent messages straight to the PARENT by WhatsApp and email at the same time.
// Each channel switches on by itself once its keys are added to the environment:
//
//   Email (Resend)       RESEND_API_KEY                 from "The Curious Library <hello@curiouslibrary.ae>" (curiouslibrary.ae must be verified in Resend)
//   WhatsApp (Meta)      WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, and an approved template (see WHATSAPP_TEMPLATES)
//   Links                APP_URL  e.g. https://curiouslibrary.ae  (falls back to the current Vercel address)
//
// Until then a channel is skipped and the skip is logged — nothing breaks.
import { supabaseAdmin } from '@/lib/supabase-admin'
import { renderMessage } from '@/lib/messages'
import { emailHtml } from '@/lib/email-layout'

const FROM_EMAIL = process.env.MESSAGING_FROM_EMAIL || 'The Curious Library <hello@curiouslibrary.ae>'
export const appUrl = () => (process.env.APP_URL || 'https://bonkers-book-club.vercel.app').replace(/\/$/, '')

// Template names + languages as approved in Meta's WhatsApp Manager
export const WHATSAPP_TEMPLATES = {
  missed_delivery: { name: 'missed_delivery', language: 'en' },     // {{1}} parent first name, {{2}} children, {{3}} link
  missed_collection: { name: 'missed_collection', language: 'en' }, // {{1}} parent first name, {{2}} link
} as const

export type SendResult = { channel: 'email' | 'whatsapp'; status: 'sent' | 'skipped' | 'failed'; detail?: string }

export async function sendEmail(to: string, subject: string, text: string, html: string): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY
  if (!key) return { channel: 'email', status: 'skipped', detail: 'email not set up yet (RESEND_API_KEY)' }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, text, html }),
    })
    if (!res.ok) return { channel: 'email', status: 'failed', detail: `${res.status} ${(await res.text()).slice(0, 200)}` }
    return { channel: 'email', status: 'sent' }
  } catch (e: any) {
    return { channel: 'email', status: 'failed', detail: e?.message }
  }
}

// UAE numbers saved as 05XXXXXXXX or +9715XXXXXXXX → 9715XXXXXXXX (what WhatsApp expects)
export function whatsappNumber(raw: string | null | undefined): string | null {
  const d = (raw || '').replace(/\D/g, '')
  if (!d) return null
  if (d.startsWith('00')) return d.slice(2)
  if (d.startsWith('0')) return `971${d.slice(1)}`
  return d
}

export async function sendWhatsAppTemplate(toRaw: string | null | undefined, template: keyof typeof WHATSAPP_TEMPLATES, params: string[]): Promise<SendResult> {
  const token = process.env.WHATSAPP_TOKEN, phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID
  if (!token || !phoneId) return { channel: 'whatsapp', status: 'skipped', detail: 'WhatsApp not set up yet (WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID)' }
  const to = whatsappNumber(toRaw)
  if (!to) return { channel: 'whatsapp', status: 'skipped', detail: 'no WhatsApp number on file' }
  const t = WHATSAPP_TEMPLATES[template]
  try {
    const res = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp', to, type: 'template',
        template: { name: t.name, language: { code: t.language }, components: [{ type: 'body', parameters: params.map(text => ({ type: 'text', text })) }] },
      }),
    })
    if (!res.ok) return { channel: 'whatsapp', status: 'failed', detail: `${res.status} ${(await res.text()).slice(0, 200)}` }
    return { channel: 'whatsapp', status: 'sent' }
  } catch (e: any) {
    return { channel: 'whatsapp', status: 'failed', detail: e?.message }
  }
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// "We missed you today" — sent the moment the driver records a missed delivery or collection.
// Goes to the parent only (never the children's envelopes), with a no-login link to Manage Delivery.
export async function sendMissedVisitMessage(stopId: string, kind: 'delivery' | 'collection' | 'no_return', childNames: string[]) {
  const { data: stop } = await supabaseAdmin
    .from('route_stops').select('id, manage_token, household_id, households(first_name, whatsapp_number, mobile_phone, user_id, notify_whatsapp, notify_email)')
    .eq('id', stopId).single()
  if (!stop) return []
  const h: any = stop.households
  const link = `${appUrl()}/m/${stop.manage_token}`
  const parent = h?.first_name || 'there'
  const kids = childNames.length ? childNames.join(' and ') : 'your'
  const kidsPossessive = childNames.length ? `${kids}’s` : 'your'

  let email: string | null = null
  if (h?.user_id) {
    const { data } = await supabaseAdmin.auth.admin.getUserById(h.user_id)
    email = data?.user?.email ?? null
  }

  const missed = await renderMessage(kind === 'delivery' ? 'missed_delivery' : kind === 'no_return' ? 'missed_no_return' : 'missed_collection', { children_possessive: kidsPossessive })
  const subject = missed.title, lead = missed.body
  const ask = (await renderMessage('missed_ask')).body
  const text = `Hi ${parent},\n\n${lead}\n\n${ask}\n\n${link}\n\nThe Curious Library team`
  const html = emailHtml({ greeting: `Hi ${parent},`, title: subject, paragraphs: [lead, ask], button: { label: 'Tell us what to do', url: link }, settingsUrl: `${appUrl()}/dashboard/settings` })

  // Follow the family's Settings choice (they must keep at least one on; if both somehow off, send both)
  let useWhatsApp = h?.notify_whatsapp !== false, useEmail = h?.notify_email !== false
  if (!useWhatsApp && !useEmail) { useWhatsApp = true; useEmail = true }
  const off = (channel: 'email' | 'whatsapp'): Promise<SendResult> => Promise.resolve({ channel, status: 'skipped', detail: 'switched off in Settings' })

  const results = await Promise.all([
    !useWhatsApp ? off('whatsapp') : sendWhatsAppTemplate(h?.whatsapp_number || h?.mobile_phone, kind === 'delivery' ? 'missed_delivery' : 'missed_collection', kind === 'delivery' ? [parent, kids, link] : [parent, link]),
    !useEmail ? off('email') : email ? sendEmail(email, subject, text, html) : Promise.resolve<SendResult>({ channel: 'email', status: 'skipped', detail: 'no email address' }),
  ])
  // keep a copy in the family's Messages in the app, with the same "tell us what to do" link
  await supabaseAdmin.from('notifications').insert({
    household_id: stop.household_id, type: 'missed_visit', title: subject, message: `${lead} ${ask}`,
    action_link: `/m/${stop.manage_token}`, channel: 'in_app', status: 'sent', sent_at: new Date().toISOString(),
  }).then(() => {}, () => {})
  // log each attempt on the visit (not in the children's message envelopes)
  await supabaseAdmin.from('delivery_events').insert(results.map(r => ({ route_stop_id: stopId, event_type: `message_${r.channel}_${r.status}`, notes: r.detail || null })))
  return results
}
