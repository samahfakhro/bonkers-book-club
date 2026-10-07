'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

// ─── Types ───────────────────────────────────────────────────────────────────

type Child = {
  id: string
  name: string
  nickname: string | null
  date_of_birth: string | null
  book_slot_allocation: number | null
  swap_permission: string | null
  books_read_count: number | null
}

type Subscription = {
  id: string
  status: string
  start_date: string | null
  plan_id: string | null
}

type Household = {
  id: string
  user_id: string
  first_name: string | null
  last_name: string | null
  mobile_phone: string | null
  whatsapp_number: string | null
  property_type: string | null
  building: string | null
  floor: string | null
  street: string | null
  sub_community: string | null
  area: string | null
  delivery_preference: string | null
  delivery_notes: string | null
  account_status: string | null
  swap_day: string | null
  created_at: string
  communities: { id: string; name: string } | null
  subscriptions: Subscription[]
  child_profiles: Child[]
  notify_whatsapp: boolean | null
  notify_email: boolean | null
  agreed_to_marketing: boolean | null
}

type Plan = { id: string; name: string; book_count: number; price_monthly: number }
type Community = { id: string; name: string; swap_days: string[] }

// ─── Styles ──────────────────────────────────────────────────────────────────

const inp: React.CSSProperties = {
  width: '100%', padding: '6px 10px', borderRadius: '6px',
  border: '1px solid #d4d4d4', fontSize: '13px', color: '#1a1a1a',
  backgroundColor: '#fff', boxSizing: 'border-box', outline: 'none',
}
const lbl: React.CSSProperties = {
  fontSize: '11px', fontWeight: 600, color: '#6b6b6b',
  textTransform: 'uppercase', letterSpacing: '0.05em',
  display: 'block', marginBottom: '3px',
}
const secHead: React.CSSProperties = {
  fontSize: '11px', fontWeight: 700, color: '#1a1a1a',
  letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 10px',
  paddingBottom: '6px', borderBottom: '1px solid #e5e5e5',
}

function CollapsibleSection({ title, children, defaultOpen = false }: {
  title: string; children: React.ReactNode; defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ borderTop: '1px solid #e5e5e5', marginTop: '4px' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '12px 0', background: 'none', border: 'none', cursor: 'pointer',
          fontSize: '11px', fontWeight: 700, color: '#1a1a1a',
          textTransform: 'uppercase', letterSpacing: '0.08em',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
      >
        {title}
        <span style={{ fontSize: '14px', color: '#9b9b9b', fontWeight: 400, lineHeight: 1 }}>
          {open ? '▲' : '▼'}
        </span>
      </button>
      {open && <div style={{ paddingBottom: '20px' }}>{children}</div>}
    </div>
  )
}

function Btn({ onClick, children, variant = 'primary', disabled, style }: {
  onClick?: () => void; children: React.ReactNode
  variant?: 'primary' | 'secondary' | 'danger'
  disabled?: boolean; style?: React.CSSProperties
}) {
  const bg = variant === 'primary' ? '#1a1a1a' : variant === 'danger' ? '#dc2626' : '#f0f0f0'
  const fg = variant === 'secondary' ? '#1a1a1a' : '#fff'
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: '6px 14px', borderRadius: '6px', border: 'none',
      cursor: disabled ? 'default' : 'pointer', fontSize: '13px', fontWeight: 600,
      backgroundColor: bg, color: fg, opacity: disabled ? 0.5 : 1, ...style,
    }}>{children}</button>
  )
}

const STATUS_COLORS: Record<string, string> = {
  active: '#16a34a',
  paused: '#d97706',
  pause_requested_pending_return: '#d97706',
  cancelled: '#9b9b9b',
  cancellation_requested_pending_return: '#9b9b9b',
  downgrade_scheduled: '#7c3aed',
  downgrade_pending_resolution: '#7c3aed',
  deleted_anonymised: '#dc2626',
}

function StatusBadge({ status }: { status: string | null }) {
  const color = STATUS_COLORS[status ?? ''] ?? '#9b9b9b'
  const label = (status ?? 'unknown').replace(/_/g, ' ')
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: '999px',
      fontSize: '11px', fontWeight: 600, textTransform: 'capitalize',
      backgroundColor: color + '18', color,
    }}>{label}</span>
  )
}

function age(dob: string | null) {
  if (!dob) return '—'
  const d = new Date(dob)
  const now = new Date()
  const y = now.getFullYear() - d.getFullYear()
  const m = now.getMonth() - d.getMonth()
  return `${m < 0 || (m === 0 && now.getDate() < d.getDate()) ? y - 1 : y}y`
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function MembersPage() {
  const [members, setMembers] = useState<Household[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [communities, setCommunities] = useState<Community[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [selected, setSelected] = useState<Household | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [editHH, setEditHH] = useState<Partial<Household> & { plan_id?: string; sub_id?: string; sub_status?: string; notify_whatsapp?: boolean; notify_email?: boolean; agreed_to_marketing?: boolean }>({})
  const [editChildren, setEditChildren] = useState<Child[]>([])
  const [swapHistory, setSwapHistory] = useState<any[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [historyLimit, setHistoryLimit] = useState(50)
  const [historyHasMore, setHistoryHasMore] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: hh, error: hhErr }, { data: pl }, { data: cm }] = await Promise.all([
      supabase
        .from('households')
        .select(`
          id, user_id, first_name, last_name, mobile_phone, whatsapp_number,
          property_type, building, floor, street, sub_community, area,
          delivery_preference, delivery_notes, account_status, swap_day, created_at,
          notify_whatsapp, notify_email, agreed_to_marketing,
          communities(id, name),
          subscriptions(id, status, start_date, plan_id),
          child_profiles(id, name, nickname, date_of_birth, book_slot_allocation, swap_permission, books_read_count)
        `)
        .order('created_at', { ascending: false }),
      supabase.from('subscription_plans').select('id, name, book_count, price_monthly').eq('is_active', true).order('price_monthly'),
      supabase.from('communities').select('id, name, swap_days').eq('is_active', true).order('name'),
    ])
    if (hhErr) console.error('Members query error:', hhErr)
    setMembers((hh as Household[]) ?? [])
    setPlans((pl as Plan[]) ?? [])
    setCommunities((cm as Community[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const select = async (hh: Household) => {
    setSelected(hh)
    const sub = hh.subscriptions?.[0]
    setEditHH({
      first_name: hh.first_name ?? '',
      last_name: hh.last_name ?? '',
      mobile_phone: hh.mobile_phone ?? '',
      whatsapp_number: hh.whatsapp_number ?? '',
      property_type: hh.property_type ?? '',
      building: hh.building ?? '',
      floor: hh.floor ?? '',
      street: hh.street ?? '',
      sub_community: hh.sub_community ?? '',
      area: hh.area ?? '',
      delivery_preference: hh.delivery_preference ?? '',
      delivery_notes: hh.delivery_notes ?? '',
      account_status: hh.account_status ?? 'active',
      swap_day: hh.swap_day ?? '',
      plan_id: sub?.plan_id ?? '',
      sub_id: sub?.id ?? '',
      sub_status: sub?.status ?? 'active',
      notify_whatsapp: hh.notify_whatsapp ?? true,
      notify_email: hh.notify_email ?? true,
      agreed_to_marketing: hh.agreed_to_marketing ?? false,
    })
    setEditChildren(hh.child_profiles ? [...hh.child_profiles] : [])
    setSaveMsg('')
    setSwapHistory([])
    setHistoryLimit(50)
    setHistoryHasMore(false)
    setLoadingHistory(true)
    const { data: loans } = await supabase
      .from('loans')
      .select('id, status, created_at, returned_at, child_profiles(name), book_copies(books(id, title, cover_image_url, author))')
      .eq('household_id', hh.id)
      .order('created_at', { ascending: false })
      .limit(50)
    setSwapHistory(loans ?? [])
    setHistoryHasMore((loans?.length ?? 0) === 50)
    setLoadingHistory(false)
  }

  const save = async () => {
    if (!selected) return
    setSaving(true)
    setSaveMsg('')

    const { plan_id, sub_id, sub_status, ...hhFields } = editHH

    await supabase.from('households').update(hhFields).eq('id', selected.id)

    if (sub_id) {
      const update: Record<string, string | null> = { status: sub_status ?? 'active' }
      if (plan_id) update.plan_id = plan_id
      await supabase.from('subscriptions').update(update).eq('id', sub_id)
    }

    for (const child of editChildren) {
      await supabase.from('child_profiles').update({
        book_slot_allocation: child.book_slot_allocation,
        swap_permission: child.swap_permission,
      }).eq('id', child.id)
    }

    setSaving(false)
    setSaveMsg('Saved')
    load()
  }

  const loadMoreHistory = async () => {
    if (!selected) return
    setLoadingHistory(true)
    const newLimit = historyLimit + 50
    const { data: loans } = await supabase
      .from('loans')
      .select('id, status, created_at, returned_at, child_profiles(name), book_copies(books(id, title, cover_image_url, author))')
      .eq('household_id', selected.id)
      .order('created_at', { ascending: false })
      .limit(newLimit)
    setSwapHistory(loans ?? [])
    setHistoryLimit(newLimit)
    setHistoryHasMore((loans?.length ?? 0) === newLimit)
    setLoadingHistory(false)
  }

  const filtered = members.filter(m => {
    const name = `${m.first_name ?? ''} ${m.last_name ?? ''}`.toLowerCase()
    const matchSearch = !search || name.includes(search.toLowerCase())
    const sub = m.subscriptions?.[0]
    const matchStatus = filterStatus === 'all' || (sub?.status ?? 'unknown') === filterStatus
    return matchSearch && matchStatus
  })

  const swapDaysForSelected = communities.find(c => c.id === selected?.communities?.id)?.swap_days ?? []

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>

      {/* ── List panel ── */}
      <div style={{ width: selected ? '340px' : '100%', flexShrink: 0, borderRight: '1px solid #e5e5e5', display: 'flex', flexDirection: 'column', transition: 'width 0.2s' }}>

        {/* Toolbar */}
        <div style={{ padding: '12px 14px', borderBottom: '1px solid #e5e5e5', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <input
            placeholder="Search by name…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ ...inp, flex: 1, minWidth: '140px' }}
          />
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ ...inp, width: 'auto' }}>
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {/* Count */}
        <div style={{ padding: '8px 14px', fontSize: '11px', color: '#9b9b9b', borderBottom: '1px solid #f0f0f0' }}>
          {filtered.length} member{filtered.length !== 1 ? 's' : ''}
        </div>

        {/* Rows */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: '32px', textAlign: 'center', color: '#9b9b9b', fontSize: '13px' }}>Loading…</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: '#9b9b9b', fontSize: '13px' }}>No members found.</div>
          ) : filtered.map(m => {
            const sub = m.subscriptions?.[0]
            const isActive = selected?.id === m.id
            return (
              <div
                key={m.id}
                onClick={() => select(m)}
                style={{
                  padding: '11px 14px', borderBottom: '1px solid #f0f0f0',
                  cursor: 'pointer', backgroundColor: isActive ? '#f7f7f7' : 'transparent',
                  borderLeft: isActive ? '3px solid #1a1a1a' : '3px solid transparent',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#1a1a1a' }}>
                      {m.first_name} {m.last_name}
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#9b9b9b' }}>
                      {m.communities?.name ?? '—'} · {m.child_profiles?.length ?? 0} child{(m.child_profiles?.length ?? 0) !== 1 ? 'ren' : ''}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '8px' }}>
                    <StatusBadge status={sub?.status ?? null} />
                    <p style={{ margin: '3px 0 0', fontSize: '11px', color: '#9b9b9b' }}>
                      {plans.find(p => p.id === sub?.plan_id)?.name ?? '—'}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Detail panel ── */}
      {selected && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#1a1a1a', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
                {selected.first_name} {selected.last_name}
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#9b9b9b' }}>
                Joined {new Date(selected.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {saveMsg && <span style={{ fontSize: '12px', color: '#16a34a', fontWeight: 600 }}>{saveMsg}</span>}
              <Btn onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</Btn>
              <Btn variant="secondary" onClick={() => setSelected(null)}>✕</Btn>
            </div>
          </div>

          <CollapsibleSection title="Details" defaultOpen>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', paddingTop: '4px' }}>

            {/* ── Contact ── */}
            <div>
              <p style={secHead}>Contact</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div>
                    <label style={lbl}>First name</label>
                    <input style={inp} value={editHH.first_name ?? ''} onChange={e => setEditHH(p => ({ ...p, first_name: e.target.value }))} />
                  </div>
                  <div>
                    <label style={lbl}>Last name</label>
                    <input style={inp} value={editHH.last_name ?? ''} onChange={e => setEditHH(p => ({ ...p, last_name: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label style={lbl}>Mobile</label>
                  <input style={inp} value={editHH.mobile_phone ?? ''} onChange={e => setEditHH(p => ({ ...p, mobile_phone: e.target.value }))} />
                </div>
                <div>
                  <label style={lbl}>WhatsApp</label>
                  <input style={inp} value={editHH.whatsapp_number ?? ''} onChange={e => setEditHH(p => ({ ...p, whatsapp_number: e.target.value }))} />
                </div>
              </div>
            </div>

            {/* ── Subscription ── */}
            <div>
              <p style={secHead}>Subscription</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div>
                  <label style={lbl}>Plan</label>
                  <select style={inp} value={editHH.plan_id ?? ''} onChange={e => setEditHH(p => ({ ...p, plan_id: e.target.value }))}>
                    <option value="">— no plan —</option>
                    {plans.map(pl => (
                      <option key={pl.id} value={pl.id}>{pl.name} — AED {pl.price_monthly}/mo</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Status</label>
                  <select style={inp} value={editHH.sub_status ?? 'active'} onChange={e => setEditHH(p => ({ ...p, sub_status: e.target.value }))}>
                    {['active','paused','pause_requested_pending_return','cancellation_requested_pending_return','cancelled','downgrade_scheduled','downgrade_pending_resolution'].map(s => (
                      <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Account status</label>
                  <select style={inp} value={editHH.account_status ?? 'active'} onChange={e => setEditHH(p => ({ ...p, account_status: e.target.value }))}>
                    {['active','suspended','cancelled'].map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Swap day</label>
                  <select style={inp} value={editHH.swap_day ?? ''} onChange={e => setEditHH(p => ({ ...p, swap_day: e.target.value }))}>
                    <option value="">— unassigned —</option>
                    {(swapDaysForSelected.length > 0 ? swapDaysForSelected : ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']).map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* ── Address ── */}
            <div>
              <p style={secHead}>Address</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div>
                    <label style={lbl}>Property type</label>
                    <select style={inp} value={editHH.property_type ?? ''} onChange={e => setEditHH(p => ({ ...p, property_type: e.target.value }))}>
                      <option value="">—</option>
                      <option value="villa">Villa</option>
                      <option value="apartment">Apartment</option>
                    </select>
                  </div>
                  <div>
                    <label style={lbl}>Building</label>
                    <input style={inp} value={editHH.building ?? ''} onChange={e => setEditHH(p => ({ ...p, building: e.target.value }))} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div>
                    <label style={lbl}>Street</label>
                    <input style={inp} value={editHH.street ?? ''} onChange={e => setEditHH(p => ({ ...p, street: e.target.value }))} />
                  </div>
                  <div>
                    <label style={lbl}>Sub-community</label>
                    <input style={inp} value={editHH.sub_community ?? ''} onChange={e => setEditHH(p => ({ ...p, sub_community: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label style={lbl}>Area</label>
                  <input style={inp} value={editHH.area ?? ''} onChange={e => setEditHH(p => ({ ...p, area: e.target.value }))} />
                </div>
                <div>
                  <label style={lbl}>Delivery preference</label>
                  <select style={inp} value={editHH.delivery_preference ?? ''} onChange={e => setEditHH(p => ({ ...p, delivery_preference: e.target.value }))}>
                    <option value="">—</option>
                    {['leave_at_door','leave_safe_spot','ring_bell','call_no_bell','leave_with_reception'].map(v => (
                      <option key={v} value={v}>{v.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Delivery notes</label>
                  <input style={inp} value={editHH.delivery_notes ?? ''} onChange={e => setEditHH(p => ({ ...p, delivery_notes: e.target.value }))} />
                </div>
              </div>
            </div>

            {/* ── Children ── */}
            <div>
              <p style={secHead}>Children ({editChildren.length})</p>
              {editChildren.length === 0 ? (
                <p style={{ fontSize: '13px', color: '#9b9b9b' }}>No children added yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {editChildren.map((child, i) => (
                    <div key={child.id} style={{ padding: '10px 12px', backgroundColor: '#f7f7f7', borderRadius: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <div>
                          <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#1a1a1a' }}>{child.name}</p>
                          {child.nickname && <p style={{ margin: '1px 0 0', fontSize: '11px', color: '#9b9b9b' }}>@{child.nickname} · {age(child.date_of_birth)}</p>}
                        </div>
                        <p style={{ margin: 0, fontSize: '11px', color: '#9b9b9b' }}>{child.books_read_count ?? 0} books read</p>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <div>
                          <label style={lbl}>Book slots</label>
                          <input
                            type="number" min={0} max={12}
                            style={inp}
                            value={child.book_slot_allocation ?? 0}
                            onChange={e => setEditChildren(prev => prev.map((c, j) => j === i ? { ...c, book_slot_allocation: Number(e.target.value) } : c))}
                          />
                        </div>
                        <div>
                          <label style={lbl}>Swap permission</label>
                          <select
                            style={inp}
                            value={child.swap_permission ?? ''}
                            onChange={e => setEditChildren(prev => prev.map((c, j) => j === i ? { ...c, swap_permission: e.target.value } : c))}
                          >
                            <option value="">—</option>
                            <option value="prepare_only">Needs approval</option>
                            <option value="independent_submit">Independent</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
          </CollapsibleSection>

          <CollapsibleSection title="Swap History">
            <div>
            {loadingHistory ? (
              <p style={{ fontSize: '13px', color: '#9b9b9b' }}>Loading…</p>
            ) : swapHistory.length === 0 ? (
              <p style={{ fontSize: '13px', color: '#9b9b9b' }}>No loans on record.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                {/* Header row */}
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: '12px', padding: '6px 10px', backgroundColor: '#f7f7f7', borderRadius: '6px 6px 0 0', fontSize: '11px', fontWeight: 700, color: '#9b9b9b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <span>Book</span>
                  <span>Child</span>
                  <span>Checked out</span>
                  <span>Returned</span>
                  <span>Status</span>
                </div>
                {swapHistory.map((loan: any) => {
                  const book = loan.book_copies?.books
                  const child = loan.child_profiles
                  const loanStatus: string = loan.status ?? 'unknown'
                  const statusColor = loanStatus === 'returned' ? '#9b9b9b' : loanStatus === 'active' || loanStatus === 'checked_out' ? '#16a34a' : '#6b6b6b'
                  return (
                    <div
                      key={loan.id}
                      style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: '12px', padding: '8px 10px', borderBottom: '1px solid #f0f0f0', alignItems: 'center' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {book?.cover_image_url && (
                          <img src={book.cover_image_url} alt="" style={{ width: '28px', height: '38px', objectFit: 'cover', borderRadius: '3px', flexShrink: 0 }} />
                        )}
                        <div>
                          <p style={{ margin: 0, fontSize: '13px', fontWeight: 500, color: '#1a1a1a', lineHeight: 1.3 }}>{book?.title ?? '—'}</p>
                          {book?.author && <p style={{ margin: 0, fontSize: '11px', color: '#9b9b9b' }}>{book.author}</p>}
                        </div>
                      </div>
                      <span style={{ fontSize: '13px', color: '#4a4a4a' }}>{child?.name ?? '—'}</span>
                      <span style={{ fontSize: '12px', color: '#6b6b6b' }}>
                        {loan.created_at ? new Date(loan.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                      </span>
                      <span style={{ fontSize: '12px', color: '#6b6b6b' }}>
                        {loan.returned_at ? new Date(loan.returned_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                      </span>
                      <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'capitalize', color: statusColor }}>
                        {loanStatus.replace(/_/g, ' ')}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
            {historyHasMore && (
              <div style={{ marginTop: '12px', textAlign: 'center' }}>
                <Btn variant="secondary" onClick={loadMoreHistory} disabled={loadingHistory}>
                  {loadingHistory ? 'Loading…' : `Load more (showing ${swapHistory.length})`}
                </Btn>
              </div>
            )}
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="Notifications">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {([
                { key: 'notify_whatsapp' as const, label: 'WhatsApp', sub: 'Swap confirmations, book availability alerts' },
                { key: 'notify_email' as const, label: 'Email', sub: 'Swap confirmations, book availability alerts' },
                { key: 'agreed_to_marketing' as const, label: 'Marketing', sub: 'News, book recommendations, promotions' },
              ]).map(({ key, label, sub }) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                  <div>
                    <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#1a1a1a' }}>{label}</p>
                    <p style={{ margin: '1px 0 0', fontSize: '11px', color: '#9b9b9b' }}>{sub}</p>
                  </div>
                  <button
                    onClick={() => setEditHH(p => ({ ...p, [key]: !p[key] }))}
                    style={{
                      width: '52px', height: '28px', borderRadius: '999px', flexShrink: 0,
                      backgroundColor: editHH[key] ? '#16a34a' : '#e5e5e5',
                      border: 'none', cursor: 'pointer', position: 'relative', transition: 'background-color 0.2s',
                    }}
                  >
                    <span style={{
                      position: 'absolute', top: '3px',
                      left: editHH[key] ? '26px' : '3px',
                      width: '22px', height: '22px', borderRadius: '50%',
                      backgroundColor: '#fff', transition: 'left 0.2s',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    }} />
                  </button>
                </div>
              ))}
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="Billing">
            <p style={{ fontSize: '13px', color: '#9b9b9b', margin: 0 }}>
              Billing and invoices will appear here once Stripe is connected.
            </p>
          </CollapsibleSection>

        </div>
      )}
    </div>
  )
}
