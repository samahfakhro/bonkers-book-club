// Server-only. Runs once a day (see app/api/cron/noon):
//  • a cancelling membership ends on its cancel date
//  • a booked downgrade happens on the billing date if the family fits the smaller plan — otherwise the current plan
//    carries on another month and we try again next billing date (never a refund, hold or penalty)
//  • a reminder goes out before the family's last Curious Day ahead of the change, if they still have extra books
//  • billing dates roll forward each month (Stripe takes this over once it's connected)
import { supabaseAdmin } from '@/lib/supabase-admin'
import { notifyHousehold } from '@/lib/notify'
import { addMonths, applyDowngradeAtRenewal, booksCountingTowardPlan, today } from '@/lib/membership/plan'
import { renderMessage } from '@/lib/messages'

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const shift = (iso: string, n: number) => new Date(new Date(iso + 'T00:00:00Z').getTime() + n * 86400000).toISOString().slice(0, 10)
const nice = (iso: string) => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })

// the family's last Curious Day strictly before a date
function lastCuriousDayBefore(dayName: string | null, before: string): string | null {
  const idx = dayName ? DAYS.indexOf(dayName.toLowerCase()) : -1
  if (idx < 0) return null
  for (let d = shift(before, -1), i = 0; i < 7; d = shift(d, -1), i++) if (new Date(d + 'T00:00:00Z').getUTCDay() === idx) return d
  return null
}

export async function runBillingDay() {
  const now = today()
  const log: string[] = []

  // 1. memberships that were cancelled end on their cancel date
  const { data: ending } = await supabaseAdmin.from('subscriptions').select('id, household_id').eq('status', 'cancelling').lte('cancel_at', now)
  for (const s of ending || []) {
    await supabaseAdmin.from('subscriptions').update({ status: 'cancelled', cancelled_at: new Date().toISOString() }).eq('id', s.id)
    log.push(`ended ${s.id}`)
  }

  // 2. booked downgrades: remind, then decide the day before the billing date
  const { data: downgrades } = await supabaseAdmin.from('subscriptions')
    .select('id, household_id, next_billing_date, scheduled_plan_id, downgrade_reminded_for, downgrade_checked_for, stripe_subscription_id, households ( bonkers_day, zones ( bonkers_day ) )')
    .eq('status', 'active').not('scheduled_plan_id', 'is', null).not('next_billing_date', 'is', null)
  const { data: allPlans } = await supabaseAdmin.from('subscription_plans').select('id, name, book_count, stripe_price_id')
  for (const s of (downgrades || []) as any[]) {
    const target = (allPlans || []).find(p => p.id === s.scheduled_plan_id), billing = s.next_billing_date as string
    if (!target) continue
    const counting = await booksCountingTowardPlan(s.household_id)
    const extra = Math.max(0, counting - target.book_count)

    if (now >= shift(billing, -1) && s.downgrade_checked_for !== billing) {
      if (extra === 0) {
        const billed = await applyDowngradeAtRenewal(s.stripe_subscription_id, target.stripe_price_id)
        if (!billed.ok) { log.push(`downgrade billing failed ${s.id}: ${billed.error}`); continue }
        await supabaseAdmin.from('subscriptions').update({ plan_id: s.scheduled_plan_id, scheduled_plan_id: null, downgrade_checked_for: billing }).eq('id', s.id)
        const done = await renderMessage('downgrade_done', { plan_name: target.name, plan_books: target.book_count, date: nice(billing) })
        await notifyHousehold({ householdId: s.household_id, type: 'general', title: done.title, message: done.body, link: '/dashboard/settings' }).catch(() => {})
        log.push(`downgraded ${s.id}`)
      } else {
        await supabaseAdmin.from('subscriptions').update({ downgrade_checked_for: billing }).eq('id', s.id)
        const later = await renderMessage('downgrade_postponed', { plan_name: target.name, extra_books: `${extra} ${extra === 1 ? 'book' : 'books'}` })
        await notifyHousehold({ householdId: s.household_id, type: 'general', title: later.title, message: later.body, link: '/dashboard' }).catch(() => {})
        log.push(`downgrade postponed ${s.id}`)
      }
      continue
    }

    // reminder from 2 days before their last Curious Day ahead of the change
    const lastDay = lastCuriousDayBefore(s.households?.bonkers_day || s.households?.zones?.bonkers_day || null, billing)
    const remindFrom = lastDay ? shift(lastDay, -2) : shift(billing, -7)
    if (extra > 0 && now >= remindFrom && now < shift(billing, -1) && s.downgrade_reminded_for !== billing) {
      const remind = await renderMessage('downgrade_reminder', { plan_name: target.name, date: nice(billing), extra_books: `${extra} ${extra === 1 ? 'book' : 'books'}`, last_curious_day: lastDay ? nice(lastDay) : 'your next Curious Day' })
      await notifyHousehold({ householdId: s.household_id, type: 'general', title: remind.title, message: remind.body, link: '/dashboard' }).catch(() => {})
      await supabaseAdmin.from('subscriptions').update({ downgrade_reminded_for: billing }).eq('id', s.id)
      log.push(`reminded ${s.id}`)
    }
  }

  // 3. roll billing dates forward for memberships Stripe doesn't bill (free codes, or Stripe off);
  //    Stripe-billed ones are kept in step by the webhook
  {
    const { data: due } = await supabaseAdmin.from('subscriptions').select('id, next_billing_date').eq('status', 'active').is('stripe_subscription_id', null).lte('next_billing_date', now)
    for (const s of due || []) {
      let next = s.next_billing_date as string
      while (next <= now) next = addMonths(next, 1)
      await supabaseAdmin.from('subscriptions').update({ next_billing_date: next }).eq('id', s.id)
      log.push(`billing date ${s.id} → ${next}`)
    }
  }
  return log
}
