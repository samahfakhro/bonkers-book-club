import { supabaseAdmin } from '@/lib/supabase-admin'

// Server-only — the one place that sends a message to a family.
// Today: in-app (envelope on the dashboard). Email is added here next; WhatsApp later.

export type NotificationType = 'notify_me' | 'damage_charge' | 'waitlist_invite' | 'swap_reminder' | 'missed_visit' | 'general'

export async function notifyHousehold(n: {
  householdId: string
  type: NotificationType
  title: string
  message: string
  link?: string | null        // where tapping the message goes, e.g. /dashboard/library/<bookId>?from=parent
  childId?: string | null
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
  return !error
}
