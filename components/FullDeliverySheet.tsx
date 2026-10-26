'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import KeepReturnToggle from '@/components/KeepReturnToggle'
import { ACTIVE_REQUEST_STATUSES, FULL_DELIVERY_EVENT, addToNextDelivery, nextDeliverySpace, type FullDeliveryRequest, returnsNeededMessage } from '@/lib/next-delivery'

// "Your next delivery is full!" — shown when someone taps + with no free space.
// Ways to make room: mark a finished book as Returning, or swap with a book already chosen. Or save the new one for later.
type Shelf = { id: string; childId: string; childName: string; book: { id: string; title: string; cover: string | null } }

export function FullDeliveryHost() {
  const [req, setReq] = useState<FullDeliveryRequest | null>(null)
  useEffect(() => {
    const open = (e: Event) => setReq((e as CustomEvent<FullDeliveryRequest>).detail)
    window.addEventListener(FULL_DELIVERY_EVENT, open)
    return () => window.removeEventListener(FULL_DELIVERY_EVENT, open)
  }, [])
  return req ? <FullDeliverySheet req={req} onClose={() => setReq(null)} /> : null
}

function FullDeliverySheet({ req, onClose }: { req: FullDeliveryRequest; onClose: () => void }) {
  const [childName, setChildName] = useState('')
  const [householdId, setHouseholdId] = useState<string | null>(null)
  const [atHome, setAtHome] = useState<(Shelf & { returning: boolean })[]>([])
  const [chosen, setChosen] = useState<Shelf[]>([])
  const [space, setSpace] = useState(0)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<'added' | 'saved' | null>(null)
  const [error, setError] = useState('')
  const [inactive, setInactive] = useState<string | null>(null)   // paused / ending membership → no new books

  const load = useCallback(async () => {
    const { data: child } = await supabase.from('child_profiles').select('id, name, nickname, household_id, book_slot_allocation').eq('id', req.childId).single()
    if (!child) return
    setChildName(child.nickname || child.name)
    setHouseholdId(child.household_id)
    const { data: subs } = await supabase.from('subscriptions').select('status').eq('household_id', child.household_id)
    if (subs?.length && !subs.some(x => x.status === 'active')) { setInactive(subs.find(x => x.status !== 'active')?.status || 'paused'); return }
    // a child with their own slots only frees space with their own books; children sharing the plan share it
    let pool = [{ id: child.id, name: child.nickname || child.name }]
    if (!child.book_slot_allocation) {
      const { data: sibs } = await supabase.from('child_profiles').select('id, name, nickname, book_slot_allocation').eq('household_id', child.household_id)
      pool = (sibs || []).filter(s => !s.book_slot_allocation).map(s => ({ id: s.id, name: s.nickname || s.name }))
    }
    const nameOf = (id: string) => pool.find(p => p.id === id)?.name || ''
    const ids = pool.map(p => p.id)
    const [{ data: loans }, { data: items }] = await Promise.all([
      supabase.from('loans').select('id, child_id, return_requested, book_copies ( books ( id, title, cover_image_url ) )').in('child_id', ids).eq('status', 'checked_out'),
      supabase.from('swap_request_items').select('id, child_id, books ( id, title, cover_image_url ), swap_requests!inner ( status )').in('child_id', ids).in('swap_requests.status', ACTIVE_REQUEST_STATUSES),
    ])
    setAtHome((loans || []).flatMap((l: any) => l.book_copies?.books ? [{ id: l.id, childId: l.child_id, childName: nameOf(l.child_id), returning: !!l.return_requested, book: { id: l.book_copies.books.id, title: l.book_copies.books.title, cover: l.book_copies.books.cover_image_url } }] : []))
    setChosen((items || []).flatMap((i: any) => i.books ? [{ id: i.id, childId: i.child_id, childName: nameOf(i.child_id), book: { id: i.books.id, title: i.books.title, cover: i.books.cover_image_url } }] : []))
    setSpace(await nextDeliverySpace(req.childId))
  }, [req.childId])
  useEffect(() => { load() }, [load])

  async function toggleReturning(loanId: string, now: boolean) {
    setAtHome(list => list.map(l => l.id === loanId ? { ...l, returning: now } : l))
    const { error: upErr } = await supabase.from('loans').update({ return_requested: now }).eq('id', loanId)
    const blocked = returnsNeededMessage(upErr, req.forChild)
    if (blocked) { setAtHome(list => list.map(l => l.id === loanId ? { ...l, returning: true } : l)); setError(blocked); return }
    setSpace(await nextDeliverySpace(req.childId))
  }

  async function add() {
    if (!householdId) return
    setBusy(true); setError('')
    const r = await addToNextDelivery(householdId, req.childId, req.book.id)
    setBusy(false)
    if (r.ok) { setDone('added'); req.onAdded?.(); return }
    setError(r.reason === 'full' ? 'There’s still no free space — mark a book as Returning or swap one out.' : r.reason === 'on_hold' ? 'New books are on hold until the extra books at home go back.' : 'Something went wrong — please try again.')
    setSpace(await nextDeliverySpace(req.childId))
  }

  // swap: the chosen book goes back to the saved hearts, the new book takes its place
  async function swap(item: Shelf) {
    if (!householdId) return
    setBusy(true); setError('')
    await supabase.from('swap_request_items').delete().eq('id', item.id)
    await supabase.from('wishlists').insert({ book_id: item.book.id, child_id: item.childId }).then(() => {}, () => {})
    const r = await addToNextDelivery(householdId, req.childId, req.book.id)
    setBusy(false)
    if (r.ok) { setDone('added'); req.onAdded?.(); return }
    setError('Something went wrong — please try again.')
    load()
  }

  async function saveForLater() {
    setBusy(true)
    await supabase.from('wishlists').insert({ book_id: req.book.id, child_id: req.childId }).then(() => {}, () => {})
    setBusy(false); setDone('saved')
  }

  const font = 'var(--font-montserrat), sans-serif'
  const kid = !!req.forChild
  const keptAtHome = atHome.filter(l => !l.returning).length
  const primary: React.CSSProperties = { width: '100%', fontFamily: font, fontWeight: 600, fontSize: '0.82rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#fff', backgroundColor: '#1a2f51', border: 'none', borderRadius: '999px', padding: '15px', cursor: 'pointer' }
  const sectionTitle: React.CSSProperties = { fontFamily: font, fontWeight: 700, fontSize: '0.8rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#1a2f51', margin: '0 0 10px' }
  const Cover = ({ src }: { src: string | null }) => src
    ? <img src={src} alt="" style={{ width: '100%', aspectRatio: '2/3', objectFit: 'cover', borderRadius: '8px', display: 'block' }} />
    : <div style={{ width: '100%', aspectRatio: '2/3', borderRadius: '8px', backgroundColor: 'rgba(26,47,81,0.08)' }} />

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 110, backgroundColor: 'rgba(26,47,81,0.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: '576px', maxHeight: '90vh', overflowY: 'auto', backgroundColor: '#fefaf2', borderRadius: '24px 24px 0 0', padding: '26px 20px 34px', boxShadow: '0 -8px 32px rgba(26,47,81,0.2)', position: 'relative' }}>
        <button onClick={onClose} aria-label="Close" style={{ position: 'absolute', top: '16px', right: '16px', background: 'rgba(26,47,81,0.08)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', color: '#1a2f51', fontSize: '1rem' }}>✕</button>

        {inactive ? (
          <div style={{ textAlign: 'center', padding: '10px 4px 0' }}>
            <p style={{ fontFamily: 'var(--font-patrick-hand)', fontSize: '1.7rem', color: '#1a2f51', margin: '0 0 8px' }}>{inactive === 'paused' ? (kid ? 'Your library is on a break' : 'Your membership is paused') : 'Your membership is ending'}</p>
            <p style={{ fontFamily: font, fontSize: '0.95rem', color: '#1a2f51', margin: '0 0 20px', lineHeight: 1.55 }}>
              {kid ? 'Ask a grown-up to start it again, then you can choose new books!' : inactive === 'paused' ? 'Resume your membership in Settings → Plan whenever you’re ready, and you can choose new books straight away.' : 'New books can’t be chosen while your membership is ending. You can keep your membership in Settings → Plan.'}
            </p>
            {!kid && <button onClick={() => { onClose(); window.location.href = '/dashboard/settings' }} style={{ ...primary, marginBottom: '10px' }}>Go to Settings</button>}
            <button onClick={onClose} style={{ width: '100%', fontFamily: font, fontWeight: 600, fontSize: '0.82rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#1a2f51', backgroundColor: 'transparent', border: '2px solid #1a2f51', borderRadius: '999px', padding: '13px', cursor: 'pointer' }}>Close</button>
          </div>
        ) : done ? (
          <div style={{ textAlign: 'center', padding: '10px 4px 0' }}>
            <img src="/sparklestar_yellow.png" alt="" style={{ width: '46px', height: '46px', marginBottom: '8px' }} />
            <p style={{ fontFamily: 'var(--font-patrick-hand)', fontSize: '1.7rem', color: '#1a2f51', margin: '0 0 6px' }}>{done === 'added' ? 'Added!' : 'Saved for later!'}</p>
            <p style={{ fontFamily: font, fontSize: '0.95rem', color: '#1a2f51', margin: '0 0 20px', lineHeight: 1.5 }}>
              {done === 'added' ? <><strong>{req.book.title}</strong> is in {kid ? 'your' : `${childName}’s`} next delivery.</> : <><strong>{req.book.title}</strong> is in {kid ? 'your' : `${childName}’s`} saved books ❤</>}
            </p>
            <button onClick={onClose} style={primary}>Done</button>
          </div>
        ) : (
          <>
            <p style={{ fontFamily: 'var(--font-patrick-hand)', fontSize: '1.8rem', color: '#1a2f51', margin: '0 40px 4px 0', lineHeight: 1.15 }}>
              {kid ? 'Your next delivery is full!' : `${childName ? childName + '’s' : 'The'} next delivery is full!`}
            </p>
            <p style={{ fontFamily: font, fontSize: '0.95rem', color: '#1a2f51', lineHeight: 1.55, margin: '0 0 20px' }}>
              To add <strong>{req.book.title}</strong>, {kid ? 'you need' : 'there needs to be'} a free space.
              {keptAtHome > 0 && (kid ? ' Finished a book? Tell us you’re sending it back to make room for a new one!' : ' New books can be added when finished books at home are marked as Returning.')}
            </p>

            {atHome.length > 0 && (
              <section style={{ marginBottom: '22px' }}>
                <p style={sectionTitle}>{kid ? 'Your books at home' : 'Books at home'}</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(92px, 1fr))', gap: '12px' }}>
                  {atHome.map(l => (
                    <div key={l.id}>
                      <Cover src={l.book.cover} />
                      {!kid && new Set(atHome.map(x => x.childId)).size > 1 && <p style={{ fontFamily: font, fontSize: '0.72rem', color: '#1a2f51', margin: '4px 0 0' }}>{l.childName}</p>}
                      <KeepReturnToggle returning={l.returning} onChange={now => toggleReturning(l.id, now)} disabled={busy} />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {space > 0 ? (
              <button onClick={add} disabled={busy} style={{ ...primary, marginBottom: '20px', opacity: busy ? 0.6 : 1 }}>
                {busy ? 'Adding…' : `Add ${req.book.title.length > 26 ? 'it' : req.book.title} to the next delivery`}
              </button>
            ) : chosen.length > 0 && (
              <section style={{ marginBottom: '22px' }}>
                <p style={sectionTitle}>{kid ? 'Or swap it for one you picked' : 'Or swap it for a book already chosen'}</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(92px, 1fr))', gap: '12px' }}>
                  {chosen.map(c => (
                    <div key={c.id}>
                      <Cover src={c.book.cover} />
                      <button onClick={() => swap(c)} disabled={busy}
                        style={{ marginTop: '6px', width: '100%', fontFamily: font, fontWeight: 700, fontSize: '0.68rem', letterSpacing: '0.06em', textTransform: 'uppercase', borderRadius: '999px', padding: '7px 4px', cursor: 'pointer', border: 'none', color: '#fff', backgroundColor: '#1a2f51' }}>
                        Swap
                      </button>
                    </div>
                  ))}
                </div>
                <p style={{ fontFamily: font, fontSize: '0.85rem', color: '#1a2f51', margin: '10px 0 0' }}>The book you swap out goes to {kid ? 'your' : 'the'} saved books ❤, so it isn’t lost.</p>
              </section>
            )}

            {error && <p style={{ fontFamily: font, color: '#e05c3a', fontSize: '0.9rem', margin: '0 0 14px' }}>{error}</p>}
            <button onClick={saveForLater} disabled={busy}
              style={{ width: '100%', fontFamily: font, fontWeight: 600, fontSize: '0.82rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#1a2f51', backgroundColor: 'transparent', border: '2px solid #1a2f51', borderRadius: '999px', padding: '13px', cursor: 'pointer' }}>
              Save for later ❤
            </button>
          </>
        )}
      </div>
    </div>
  )
}
