'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

// Settings → Plan: see your plan, change it, pause / resume, or cancel. No refunds, ever.
type PlanOpt = { id: string; name: string; books: number; price: number }
type Membership = {
  status: 'active' | 'paused' | 'cancelling' | 'cancelled'
  plan: PlanOpt | null; nextBillingDate: string | null; paidDaysLeft: number; savedDays: number; pausedSince: string | null; cancelAt: string | null
  scheduled: (PlanOpt & { extraBooks: number }) | null
  booksOut: number; booksNotBooked: number; deliveryOnItsWay: boolean
  owed: { items: { id: string; kind: string; title: string; amount: number }[]; total: number }
}
type Confirm = { kind: 'upgrade' | 'downgrade' | 'pause' | 'resume' | 'cancel' | 'rejoin' | 'delete_account'; plan?: PlanOpt } | null

const font = 'var(--font-montserrat), sans-serif'
const navy = '#1a2f51'
const nice = (iso: string | null) => iso ? new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' }) : '—'
const plusDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }

async function call(method: 'GET' | 'POST', body?: object) {
  const { data } = await supabase.auth.getSession()
  const res = await fetch('/api/plan', { method, headers: { 'Content-Type': 'application/json', ...(data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {}) }, body: body ? JSON.stringify(body) : undefined })
  return { ok: res.ok, body: await res.json().catch(() => ({})) }
}

export default function PlanSettings() {
  const [m, setM] = useState<Membership | null>(null)
  const [plans, setPlans] = useState<PlanOpt[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState<Confirm>(null)
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null)

  const load = useCallback(async () => {
    const { ok, body } = await call('GET')
    if (ok) { setM(body.membership); setPlans(body.plans || []) }
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  async function act(action: string, planId?: string) {
    setBusy(true); setMsg(null)
    const { ok, body } = await call('POST', { action, planId })
    setBusy(false); setConfirm(null)
    if (ok && action === 'delete_account') { await supabase.auth.signOut(); window.location.href = '/'; return }
    setMsg(ok ? { text: body.message } : { text: body.error || 'Something went wrong — please try again.', bad: true })
    load()
  }

  const card: React.CSSProperties = { borderRadius: '16px', padding: '18px', backgroundColor: '#fffef9', border: '2px solid #e8e0d4' }
  const h: React.CSSProperties = { fontFamily: font, fontWeight: 700, fontSize: '0.8rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: navy, margin: '0 0 8px' }
  const p: React.CSSProperties = { fontFamily: font, fontSize: '0.92rem', color: navy, lineHeight: 1.55, margin: '0 0 12px' }
  const primary = (disabled = false): React.CSSProperties => ({ width: '100%', fontFamily: font, fontWeight: 600, fontSize: '0.8rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#fff', backgroundColor: navy, border: 'none', borderRadius: '999px', padding: '14px', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.4 : 1 })
  const secondary: React.CSSProperties = { width: '100%', fontFamily: font, fontWeight: 600, fontSize: '0.8rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: navy, backgroundColor: 'transparent', border: `2px solid ${navy}`, borderRadius: '999px', padding: '12px', cursor: 'pointer' }

  if (loading) return <p style={p}>Loading your plan…</p>
  if (!m || !m.plan) return <p style={p}>We couldn’t find your membership. Please get in touch and we’ll sort it out.</p>

  const stopBlocked = m.deliveryOnItsWay || m.booksOut > 0
  const statusChip = { active: ['Active', '#e6f0e6', '#2e5c3a'], paused: ['Paused', '#fff4d6', '#7a5a00'], cancelling: ['Ending', '#fdecea', '#b3261e'], cancelled: ['Ended', '#f0f0f0', navy] }[m.status]

  // what a confirm box says before anything happens
  const confirmText = (c: NonNullable<Confirm>) => {
    if (c.kind === 'upgrade' && c.plan) return <>Move up to <strong>{c.plan.name}</strong> ({c.plan.books} books at a time, AED {c.plan.price}/month) straight away. You’ll be charged the difference for the rest of this billing cycle, then AED {c.plan.price} a month from {nice(m.nextBillingDate)}.</>
    if (c.kind === 'downgrade' && c.plan) {
      const extra = Math.max(0, (m.plan?.books ?? 0) - c.plan.books)
      return <>Your plan will change to <strong>{c.plan.name}</strong> ({c.plan.books} books at a time, AED {c.plan.price}/month) on <strong>{nice(m.nextBillingDate)}</strong>. Before then, please return any extra books so you have {c.plan.books} or fewer at home — we’ll send you a reminder before your last Curious Day ahead of the change, so you don’t miss it.{extra > 0 && <> If there are still more than {c.plan.books} books at home on {nice(m.nextBillingDate)}, your {m.plan?.name} plan will carry on for another month, and we’ll try the change again on your next billing date.</>}</>
    }
    if (c.kind === 'pause') return <>You have <strong>{m.paidDaysLeft} paid {m.paidDaysLeft === 1 ? 'day' : 'days'}</strong> left. We’ll save {m.paidDaysLeft === 1 ? 'it' : 'them'} for when you come back. Pausing stops your payments and deliveries, and any books chosen for your next delivery go back to your saved books.</>
    if (c.kind === 'resume') return <>Your <strong>{m.savedDays} saved {m.savedDays === 1 ? 'day starts' : 'days start'}</strong> today, and your next payment will be on <strong>{nice(plusDays(m.savedDays))}</strong>. You can choose books straight away.</>
    if (c.kind === 'cancel') return <>Your membership will end on <strong>{nice(m.nextBillingDate)}</strong>, the end of the period you’ve already paid for. Unused days aren’t refunded. Any books chosen for your next delivery go back to your saved books. You can change your mind until then.{m.owed.total > 0 && <><br /><br />You have <strong>AED {m.owed.total}</strong> outstanding for {m.owed.items.length === 1 ? 'a lost or damaged book' : `${m.owed.items.length} lost or damaged books`}. This will be charged to your card when you cancel.</>}</>
    if (c.kind === 'rejoin') return <>Welcome back! Your <strong>{m.plan?.name}</strong> membership starts again today — your readers, saved books and reading history are all still here.</>
    if (c.kind === 'delete_account') return <>This permanently deletes your account: your details, your readers’ profiles, saved books and messages. <strong>It can’t be undone.</strong> If you’d like to come back one day, you’d need to sign up again.</>
    return null
  }
  const confirmAction = (c: NonNullable<Confirm>) => c.kind === 'upgrade' || c.kind === 'downgrade' ? act('change_plan', c.plan!.id) : act(c.kind)
  const confirmLabel = { upgrade: 'Upgrade now', downgrade: 'Book the change', pause: 'Pause membership', resume: 'Resume membership', cancel: 'Cancel membership', rejoin: 'Rejoin', delete_account: 'Yes, delete my account' }

  // under a greyed-out Pause / Cancel button: what needs to happen first, and the free collection button
  const ReturnFirst = ({ what }: { what: 'pause' | 'cancel' }) => (
    <div style={{ marginTop: '10px', padding: '12px 14px', borderRadius: '12px', backgroundColor: '#fff', border: '1px solid #e8e0d4' }}>
      <p style={{ ...p, margin: m.booksNotBooked > 0 || m.booksOut > 0 ? '0 0 10px' : 0 }}>
        Once all the books at home come back to us, you’ll be able to {what} your membership.
        {m.deliveryOnItsWay && ' Books in a delivery that’s on its way will need to come back too.'}
      </p>
      {m.booksNotBooked > 0
        ? <button disabled={busy} onClick={() => act('book_collection')} style={secondary}>Book a free collection</button>
        : m.booksOut > 0 && <>
            <p style={{ ...p, margin: '0 0 10px', fontWeight: 600 }}>✓ Collection booked — {m.booksOut} {m.booksOut === 1 ? 'book' : 'books'} still to come back.</p>
            <button disabled={busy} onClick={() => act('cancel_collection')} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: font, fontSize: '0.88rem', color: navy, textDecoration: 'underline', textUnderlineOffset: '3px' }}>Changed your mind? Cancel the collection</button>
          </>}
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* your plan */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
          <div>
            <p style={{ fontFamily: 'var(--font-cormorant), serif', color: navy, fontSize: '1.5rem', fontWeight: 700, margin: '0 0 2px' }}>{m.plan.name}</p>
            <p style={{ ...p, margin: 0 }}>{m.plan.books} books at a time · AED {m.plan.price}/month</p>
          </div>
          <span style={{ fontFamily: font, fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '4px 12px', borderRadius: '999px', backgroundColor: statusChip[1], color: statusChip[2], whiteSpace: 'nowrap' }}>{statusChip[0]}</span>
        </div>
        <p style={{ ...p, margin: '12px 0 0' }}>
          {m.status === 'active' && <>Next payment: <strong>{nice(m.nextBillingDate)}</strong></>}
          {m.status === 'paused' && <>Paused since {nice(m.pausedSince)} · <strong>{m.savedDays} paid {m.savedDays === 1 ? 'day' : 'days'} saved</strong></>}
          {m.status === 'cancelling' && <>Your membership ends on <strong>{nice(m.cancelAt)}</strong>.</>}
          {m.status === 'cancelled' && <>Your membership has ended. We’d love to have you back — just get in touch.</>}
        </p>
      </div>

      {msg && <p style={{ ...p, margin: 0, padding: '12px 14px', borderRadius: '12px', backgroundColor: msg.bad ? '#fdecea' : '#e6f0e6', color: msg.bad ? '#b3261e' : '#2e5c3a', fontWeight: 600 }}>{msg.text}</p>}

      {confirm ? (
        <div style={{ ...card, borderColor: '#fee297' }}>
          <p style={p}>{confirmText(confirm)}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button disabled={busy} onClick={() => confirmAction(confirm)} style={primary(busy)}>{busy ? 'One moment…' : confirmLabel[confirm.kind]}</button>
            <button disabled={busy} onClick={() => setConfirm(null)} style={secondary}>Go back</button>
          </div>
        </div>
      ) : (
        <>
          {m.status === 'active' && (
            <>
              {/* change plan */}
              <div style={card}>
                <p style={h}>Change plan</p>
                {m.scheduled && (
                  <div style={{ marginBottom: '12px', padding: '12px 14px', borderRadius: '12px', backgroundColor: '#fff', border: '1px solid #e8e0d4' }}>
                    <p style={{ ...p, margin: '0 0 10px' }}>
                      Your plan will change to <strong>{m.scheduled.name}</strong> on <strong>{nice(m.nextBillingDate)}</strong>.
                      {m.scheduled.extraBooks > 0 && <> Before then, please return your {m.scheduled.extraBooks} extra {m.scheduled.extraBooks === 1 ? 'book' : 'books'} — we’ll remind you before your last Curious Day.</>}
                    </p>
                    <button disabled={busy} onClick={() => act('change_plan', m.plan!.id)} style={secondary}>Keep {m.plan.name} instead</button>
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {plans.filter(o => o.id !== m.plan!.id && o.id !== m.scheduled?.id).map(o => {
                    const up = o.books > m.plan!.books
                    return (
                      <button key={o.id} onClick={() => setConfirm({ kind: up ? 'upgrade' : 'downgrade', plan: o })}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', textAlign: 'left', padding: '14px 16px', borderRadius: '14px', border: '2px solid #e8e0d4', backgroundColor: '#fff', cursor: 'pointer' }}>
                        <span>
                          <span style={{ display: 'block', fontFamily: 'var(--font-cormorant), serif', fontWeight: 700, fontSize: '1.2rem', color: navy }}>{o.name}</span>
                          <span style={{ fontFamily: font, fontSize: '0.85rem', color: navy }}>{o.books} books at a time · AED {o.price}/month</span>
                        </span>
                        <span style={{ fontFamily: font, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: navy, whiteSpace: 'nowrap' }}>{up ? 'Upgrade' : 'Downgrade'} →</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* pause */}
              <div style={card}>
                <p style={h}>Pause membership</p>
                <p style={p}>Going away or taking a break? Pause your membership and your remaining paid days are saved for when you come back.</p>
                <button disabled={stopBlocked} onClick={() => setConfirm({ kind: 'pause' })} style={primary(stopBlocked)}>Pause membership</button>
                {stopBlocked && <ReturnFirst what="pause" />}
              </div>

              {/* cancel */}
              <div style={card}>
                <p style={h}>Cancel membership</p>
                <p style={p}>Your membership ends at the end of the period you’ve already paid for.</p>
                <button disabled={stopBlocked} onClick={() => setConfirm({ kind: 'cancel' })} style={{ ...secondary, opacity: stopBlocked ? 0.4 : 1, cursor: stopBlocked ? 'default' : 'pointer' }}>Cancel membership</button>
                {stopBlocked && <ReturnFirst what="cancel" />}
              </div>
            </>
          )}

          {m.status === 'paused' && (
            <div style={card}>
              <p style={h}>Resume membership</p>
              <p style={p}>Ready for more books? Your {m.savedDays} saved {m.savedDays === 1 ? 'day carries' : 'days carry'} on from where you left off.</p>
              <button onClick={() => setConfirm({ kind: 'resume' })} style={primary()}>Resume membership</button>
            </div>
          )}

          {m.status === 'cancelled' && (
            <>
              {m.owed.total > 0 && (
                <div style={{ ...card, borderColor: '#f3c7c2' }}>
                  <p style={h}>Still to pay</p>
                  {m.owed.items.map(c => <p key={c.id} style={{ ...p, margin: '0 0 6px' }}>{c.title} ({c.kind}) — <strong>AED {c.amount}</strong></p>)}
                  <p style={{ ...p, margin: '8px 0 0' }}>Please get in touch to settle this. Once it’s paid, you can rejoin or delete your account.</p>
                </div>
              )}
              <div style={card}>
                <p style={h}>Come back any time</p>
                <p style={p}>Your readers’ worlds, saved books and reading history are kept safe for when you’re ready.</p>
                <button disabled={m.owed.total > 0} onClick={() => setConfirm({ kind: 'rejoin' })} style={primary(m.owed.total > 0)}>Rejoin</button>
              </div>
              <div style={card}>
                <p style={h}>Delete my account</p>
                <p style={p}>Permanently remove your details and your readers’ profiles.</p>
                <button disabled={m.owed.total > 0 || m.booksOut > 0} onClick={() => setConfirm({ kind: 'delete_account' })} style={{ ...secondary, opacity: m.owed.total > 0 || m.booksOut > 0 ? 0.4 : 1 }}>Delete my account</button>
              </div>
            </>
          )}

          {m.status === 'cancelling' && (
            <div style={card}>
              <p style={h}>Changed your mind?</p>
              <p style={p}>You can keep your membership any time before {nice(m.cancelAt)}.</p>
              <button disabled={busy} onClick={() => act('keep')} style={primary(busy)}>Keep my membership</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
