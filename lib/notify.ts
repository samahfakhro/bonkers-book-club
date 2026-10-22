import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendEmail, appUrl } from '@/lib/messaging'
import { emailHtml } from '@/lib/email-layout'

// Server-only — the one place that sends a message to a family.
// Always: in-app (envelope on the dashboard). Also email, if the family has email switched on in Settings
// (sends nothing until RESEND_API_KEY is set — see lib/messaging.ts). WhatsApp later.

export type NotificationType = 'notify_me' | 'damage_charge' | 'waitlist_invite' | 'swap_reminder' | 'missed_visit' | 'general'

// Messages that only make sense while choosing books is possible — skipped while a membership is paused, ending or ended.
// (Payment requests and anything else still go out.) Any new automated reminder about choosing, cutoffs or collections
// should use one of these types so it's skipped automatically.
const NEEDS_ACTIVE_MEMBERSHIP: NotificationType[] = ['notify_me', 'swap_reminder']

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
  if (NEEDS_ACTIVE_MEMBERSHIP.includes(n.type)) {
    const { data: inactive } = await supabaseAdmin.rpc('membership_inactive', { p_household: n.householdId })
    if (inactive) return
  }
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
  const text = `${hi}\n\n${n.message}\n\n${link}${extraText}\n\nThe Curious Library team`
  const html = emailHtml({ greeting: hi, title: n.title, paragraphs: [n.message], button: { label: 'Open the app', url: link }, extraLink: n.extraLink, settingsUrl: `${appUrl()}/dashboard/settings` })
  const r = await sendEmail(to, n.title, text, html)
  if (r.status === 'failed') console.error('notifyHousehold email:', r.detail)
}
