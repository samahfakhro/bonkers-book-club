import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendEmail, appUrl } from '@/lib/messaging'

// Server-only — the one place that sends a message to a family.
// Always: in-app (envelope on the dashboard). Also email, if the family has email switched on in Settings
// (sends nothing until RESEND_API_KEY is set — see lib/messaging.ts). WhatsApp later.

export type NotificationType = 'notify_me' | 'damage_charge' | 'waitlist_invite' | 'swap_reminder' | 'missed_visit' | 'general'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export async function notifyHousehold(n: {
  householdId: string
  type: NotificationType
  title: string
  message: string
  link?: string | null        // where tapping the message goes, e.g. /dashboard/library/<bookId>?from=parent
  childId?: string | null
  extraLink?: { label: string; url: string } | null  // e.g. a one-tap "Stop alerts for this book" (email only)
}) {
  const { error } = await supabaseAdmin.from('notifications').insert({
    household_id: n.householdId,
    child_id: n.childId ?? null,
    type: n.type,
    title: n.title,
    message: n.message,
    action_link: n.link ?? null,
    channel: 'in_app',
    status: 'sent',
    sent_at: new Date().toISOString(),
  })
  if (error) console.error('notifyHousehold failed:', error)

  await emailHousehold(n).catch(e => console.error('notifyHousehold email failed:', e))
  return !error
}

async function emailHousehold(n: { householdId: string; title: string; message: string; link?: string | null; extraLink?: { label: string; url: string } | null }) {
  const { data: hh } = await supabaseAdmin.from('households').select('first_name, user_id, notify_email').eq('id', n.householdId).single()
  if (!hh || hh.notify_email === false || !hh.user_id) return
  const { data } = await supabaseAdmin.auth.admin.getUserById(hh.user_id)
  const to = data?.user?.email
  if (!to) return

  const link = n.link ? (n.link.startsWith('http') ? n.link : `${appUrl()}${n.link}`) : `${appUrl()}/dashboard/notifications`
  const hi = `Hi ${hh.first_name || 'there'},`
  const extraText = n.extraLink ? `\n\n${n.extraLink.label}: ${n.extraLink.url}` : ''
  const text = `${hi}\n\n${n.message}\n\n${link}${extraText}\n\nThe Bonkers team`
  const html = `<div style="font-family:Arial,sans-serif;color:#1a2f51;font-size:16px;line-height:1.5;max-width:480px">
    <p>${esc(hi)}</p><p>${esc(n.message)}</p>
    <p><a href="${link}" style="display:inline-block;background:#1a2f51;color:#fff;text-decoration:none;padding:14px 26px;border-radius:999px;font-weight:bold">Open Bonkers</a></p>
    ${n.extraLink ? `<p style="font-size:13px"><a href="${n.extraLink.url}" style="color:#888">${esc(n.extraLink.label)}</a></p>` : ''}
    <p style="color:#888;font-size:13px">The Bonkers team</p></div>`
  const r = await sendEmail(to, n.title, text, html)
  if (r.status === 'failed') console.error('notifyHousehold email:', r.detail)
}
