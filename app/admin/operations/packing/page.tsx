'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// ─── Types ─────────────────────────────────────────────────────────────────

type PackingBook = {
  itemId: string
  bookId: string
  title: string
  author: string | null
  coverUrl: string | null
  shelfLocation: string | null
  scannedCopyId: string | null
  scannedInternalId: string | null
}

type PackingChild = {
  childId: string
  requestId: string
  name: string
  lastName: string
  books: PackingBook[]
}

type AddressLine = { label: string; value: string }

type PackingHousehold = {
  householdId: string
  displayName: string
  address: string
  addressLines: AddressLine[]
  propertyType: string
  phone: string
  swapDay: string | null
  children: PackingChild[]
  packed: boolean
}

// ─── Shared styles ──────────────────────────────────────────────────────────

const font: React.CSSProperties = {
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
}

const inp: React.CSSProperties = {
  padding: '7px 10px', borderRadius: '6px',
  backgroundColor: '#fff', border: '1px solid #d4d4d4',
  color: '#1a1a1a', fontSize: '13px', outline: 'none',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
}

const secHead: React.CSSProperties = {
  fontSize: '11px', fontWeight: 700, color: '#9b9b9b',
  letterSpacing: '0.08em', textTransform: 'uppercase' as const,
  margin: '0 0 8px',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
}

function Btn({ variant = 'primary', disabled, onClick, children, style }: {
  variant?: 'primary' | 'secondary' | 'success'
  disabled?: boolean
  onClick?: () => void
  children: React.ReactNode
  style?: React.CSSProperties
}) {
  const bg = variant === 'primary' ? '#1a1a1a' : variant === 'success' ? '#16a34a' : '#f0f0f0'
  const color = variant === 'secondary' ? '#1a1a1a' : '#ffffff'
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: '7px 14px', borderRadius: '6px', border: 'none',
      cursor: disabled ? 'default' : 'pointer', fontSize: '13px', fontWeight: 600,
      backgroundColor: bg, color, opacity: disabled ? 0.5 : 1,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      ...style,
    }}>
      {children}
    </button>
  )
}

// ─── Label printing ─────────────────────────────────────────────────────────

function buildLabelHtml(labels: { childName: string; addressLines: AddressLine[]; phone: string; householdId: string; swapDay: string }[]) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Packing Labels</title>
  <style>
    @page { size: 4in 6in; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #fff; }
    .label {
      width: 4in; height: 6in; padding: 0.25in;
      page-break-after: always;
      display: flex; flex-direction: column;
      overflow: hidden;
    }
    .label:last-child { page-break-after: avoid; }
    .brand { font-size: 9pt; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: #888; margin-bottom: 0.2in; }
    .child-name { font-size: 26pt; font-weight: 800; line-height: 1.15; color: #111; margin-bottom: 0.15in; }
    .divider { border: none; border-top: 1px solid #ccc; margin-bottom: 0.15in; }
    .addr-table { width: 100%; border-collapse: collapse; margin-bottom: 0.1in; flex: 1; }
    .addr-table td { font-size: 10pt; line-height: 1.6; vertical-align: top; }
    .addr-label { color: #888; width: 1.1in; padding-right: 0.06in; white-space: nowrap; }
    .addr-value { color: #111; font-weight: 600; }
    .phone { font-size: 10pt; color: #333; margin-bottom: 0.1in; }
    .footer { margin-top: 0.15in; display: flex; justify-content: space-between; align-items: flex-end; }
    .swap-label { font-size: 9pt; color: #666; }
    .swap-day { font-size: 10pt; font-weight: 700; color: #111; text-transform: capitalize; }
    .barcode-block { text-align: right; }
    svg { display: block; }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
</head>
<body>
  ${labels.map((l, i) => `
  <div class="label">
    <div class="brand">Bonkers — The Children's Library</div>
    <div class="child-name">${l.childName}</div>
    <hr class="divider">
    <table class="addr-table">
      ${l.addressLines.map(row => `<tr><td class="addr-label">${row.label}</td><td class="addr-value">${row.value.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td></tr>`).join('')}
      ${l.phone ? `<tr><td class="addr-label">Phone</td><td class="addr-value">${l.phone.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td></tr>` : ''}
    </table>
    <div class="footer">
      <div>
        <div class="swap-label">Bonkers Day</div>
        <div class="swap-day">${l.swapDay || '—'}</div>
      </div>
      <div class="barcode-block">
        <svg id="bc${i}"></svg>
      </div>
    </div>
  </div>`).join('')}
  <script>
    window.addEventListener('load', function() {
      var labels = ${JSON.stringify(labels)};
      labels.forEach(function(l, i) {
        try {
          JsBarcode('#bc' + i, l.householdId.replace(/-/g, '').slice(0, 12).toUpperCase(), {
            format: 'CODE128', width: 1.5, height: 40, displayValue: true,
            fontSize: 9, margin: 0
          });
        } catch(e) {}
      });
      setTimeout(function() { window.print(); }, 300);
    });
  </script>
</body>
</html>`
}

function openLabelWindow(html: string) {
  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const win = window.open(url, '_blank')
  if (!win) { alert('Pop-up blocked — please allow pop-ups and try again.'); URL.revokeObjectURL(url); return }
  setTimeout(() => URL.revokeObjectURL(url), 60000)
  win.focus()
}

function printSingleLabel(hh: PackingHousehold, child: PackingChild) {
  const fullName = [child.name, child.lastName].filter(Boolean).join(' ')
  openLabelWindow(buildLabelHtml([{ childName: fullName, addressLines: hh.addressLines, phone: hh.phone, householdId: hh.householdId, swapDay: hh.swapDay || '' }]))
}

function printLabels(households: PackingHousehold[]) {
  const targets = households.filter(h => !h.packed)
  if (!targets.length) { alert('No unpacked households to print labels for.'); return }
  const labels = targets.flatMap(h => h.children.map(c => ({ childName: [c.name, c.lastName].filter(Boolean).join(' '), addressLines: h.addressLines, phone: h.phone, householdId: h.householdId, swapDay: h.swapDay || '' })))
  openLabelWindow(buildLabelHtml(labels))
}

// ─── Main component ─────────────────────────────────────────────────────────

export default function PackingPage() {
  const router = useRouter()
  const [households, setHouseholds] = useState<PackingHousehold[]>([])
  const [loading, setLoading] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [debugInfo, setDebugInfo] = useState<string | null>(null)

  // Per-household scan state
  const [scanInput, setScanInput] = useState<Record<string, string>>({})
  const [scanError, setScanError] = useState<Record<string, string | null>>({})
  const [scanning, setScanning] = useState<Record<string, boolean>>({})
  const [marking, setMarking] = useState<Record<string, boolean>>({})
  const scanRef = useRef<Record<string, HTMLInputElement | null>>({})

  // Load all locked requests on mount
  useEffect(() => { loadHouseholds() }, [])

  async function loadHouseholds() {
    setLoading(true)
    setHouseholds([])
    setDebugInfo(null)

    // 1. All locked swap requests
    const { data: allRequests, error: reqErr } = await supabase
      .from('swap_requests')
      .select('id, household_id, child_id, status')


    if (reqErr) { setDebugInfo(`Error: ${reqErr.message}`); setLoading(false); return }

    const requests = (allRequests || []).filter(r => r.status === 'locked')

    if (!requests.length) {
      setDebugInfo('No locked swap requests found.')
      setLoading(false)
      return
    }

    // 2. Get the relevant households
    const hhIds = [...new Set(requests.map(r => r.household_id).filter(Boolean))]
    const { data: hhRows } = await supabase
      .from('households')
      .select('*, communities(name, swap_days)')
      .in('id', hhIds)

    if (!hhRows?.length) { setDebugInfo(`Found ${requests.length} locked request(s) but couldn't load household data.`); setLoading(false); return }

    // 3. Child names
    const childIds = [...new Set(requests.map(r => r.child_id).filter(Boolean))]
    const { data: childRows } = await supabase
      .from('child_profiles')
      .select('id, name, last_name')
      .in('id', childIds)
    const childMap = new Map((childRows || []).map(c => [c.id as string, { name: c.name as string, lastName: (c.last_name as string) || '' }]))

    // 4. Items (with book info)
    const requestIds = requests.map(r => r.id)
    const { data: itemRows, error: itemErr } = await supabase
      .from('swap_request_items')
      .select('id, swap_request_id, book_id, books(id, title, author, cover_image_url)')
      .in('swap_request_id', requestIds)

    if (itemErr) { setDebugInfo(`Found ${requests.length} locked request(s) but error loading items: ${itemErr.message}`); setLoading(false); return }
    if (!itemRows?.length) { setDebugInfo(`Found ${requests.length} locked request(s) and ${hhRows.length} household(s), but no swap_request_items were found. The requests may have no books added.`); setLoading(false); return }

    // 5. Available copies for shelf location (one per book_id)
    const bookIds = [...new Set((itemRows || []).map(i => i.book_id).filter(Boolean))]
    let shelfMap = new Map<string, string>()
    if (bookIds.length > 0) {
      const { data: copyRows } = await supabase
        .from('book_copies')
        .select('book_id, shelf_location, status')
        .in('book_id', bookIds)
        .eq('status', 'available')
      for (const c of (copyRows || [])) {
        if (c.book_id && c.shelf_location && !shelfMap.has(c.book_id)) {
          shelfMap.set(c.book_id, c.shelf_location)
        }
      }
    }

    // 6. Build item map keyed by request id
    const itemsByRequest = new Map<string, typeof itemRows>()
    for (const item of (itemRows || [])) {
      if (!itemsByRequest.has(item.swap_request_id)) itemsByRequest.set(item.swap_request_id, [])
      itemsByRequest.get(item.swap_request_id)!.push(item)
    }

    // 7. Group requests by household
    const requestsByHousehold = new Map<string, typeof requests>()
    for (const req of requests) {
      if (!requestsByHousehold.has(req.household_id)) requestsByHousehold.set(req.household_id, [])
      requestsByHousehold.get(req.household_id)!.push(req)
    }

    // 8. Assemble final structure
    const result: PackingHousehold[] = []
    for (const hh of hhRows) {
      const hhRequests = requestsByHousehold.get(hh.id)
      if (!hhRequests?.length) continue

      const children: PackingChild[] = []
      for (const req of hhRequests) {
        const items = itemsByRequest.get(req.id) || []
        if (!items.length) continue
        children.push({
          childId: req.child_id,
          requestId: req.id,
          name: childMap.get(req.child_id)?.name || 'Child',
          lastName: childMap.get(req.child_id)?.lastName || '',
          books: items.map(item => ({
            itemId: item.id,
            bookId: item.book_id,
            title: (item as any).books?.title || 'Unknown',
            author: (item as any).books?.author || null,
            coverUrl: (item as any).books?.cover_image_url || null,
            shelfLocation: item.book_id ? (shelfMap.get(item.book_id) || null) : null,
            scannedCopyId: null,
            scannedInternalId: null,
          })),
        })
      }

      if (!children.length) continue
      const isApartment = hh.property_type === 'apartment'
      const communityName = (hh.communities as any)?.name || null
      const propertyTypeLabel = hh.property_type
        ? hh.property_type.charAt(0).toUpperCase() + hh.property_type.slice(1)
        : ''
      const villaFlatLabel = hh.villa_flat
        ? (isApartment ? `Flat ${hh.villa_flat}` : `Villa ${hh.villa_flat}`)
        : ''
      const addressLines: AddressLine[] = [
        { label: 'Type', value: propertyTypeLabel },
        { label: isApartment ? 'Flat' : 'Villa', value: hh.villa_flat || '' },
        ...(isApartment && hh.building ? [{ label: 'Building', value: hh.building }] : []),
        { label: 'Street', value: hh.street || '' },
        { label: 'Sub-Community', value: hh.sub_community || '' },
        { label: 'Community', value: communityName || '' },
        { label: 'Area', value: hh.area || '' },
        { label: 'City', value: 'Dubai' },
      ].filter(l => l.value)

      // flat string for the list view subtitle
      const line1Parts = [villaFlatLabel, isApartment && hh.building ? hh.building : null].filter(Boolean)
      const addressParts = [line1Parts.join(', '), hh.street, hh.sub_community, communityName, hh.area, 'Dubai'].filter(Boolean)
      const composedAddress = addressParts.length > 0 ? addressParts.join('\n') : (hh.address || '')

      const communitySwapDays = (hh.communities as any)?.swap_days

      const swapDay = hh.swap_day || (Array.isArray(communitySwapDays) ? communitySwapDays[0] : communitySwapDays) || null

      result.push({
        householdId: hh.id,
        displayName: hh.name || (hh.first_name ? `${hh.first_name}'s household` : 'Household'),
        address: composedAddress,
        addressLines,
        propertyType: propertyTypeLabel,
        phone: hh.mobile_phone || '',
        swapDay,
        children,
        packed: false,
      })
    }

    setHouseholds(result)
    setLoading(false)
  }

  // Scan a barcode for a specific household
  async function handleScan(householdId: string) {
    const value = (scanInput[householdId] || '').trim()
    if (!value) return

    setScanning(prev => ({ ...prev, [householdId]: true }))
    setScanError(prev => ({ ...prev, [householdId]: null }))

    const { data: copies } = await supabase
      .from('book_copies')
      .select('id, book_id, internal_id, shelf_location, status')
      .or(`internal_id.eq.${value},barcode.eq.${value}`)
      .limit(1)

    const copy = copies?.[0]
    setScanInput(prev => ({ ...prev, [householdId]: '' }))
    setScanning(prev => ({ ...prev, [householdId]: false }))

    if (!copy) {
      setScanError(prev => ({ ...prev, [householdId]: `No copy found for "${value}"` }))
      setTimeout(() => scanRef.current[householdId]?.focus(), 50)
      return
    }

    // Find a matching unscanned book in this household
    let matched = false
    setHouseholds(prev => prev.map(h => {
      if (h.householdId !== householdId) return h
      let found = false
      const updated = {
        ...h,
        children: h.children.map(c => ({
          ...c,
          books: c.books.map(b => {
            if (!found && b.bookId === copy.book_id && !b.scannedCopyId) {
              found = true
              matched = true
              return {
                ...b,
                scannedCopyId: copy.id,
                scannedInternalId: copy.internal_id,
                shelfLocation: copy.shelf_location || b.shelfLocation,
              }
            }
            return b
          }),
        })),
      }
      return updated
    }))

    if (!matched) {
      setScanError(prev => ({
        ...prev,
        [householdId]: copy.book_id
          ? `This book isn't in the requested list for this household`
          : `Copy found but has no book linked`,
      }))
    }
    setTimeout(() => scanRef.current[householdId]?.focus(), 50)
  }

  async function markPacked(householdId: string) {
    setMarking(prev => ({ ...prev, [householdId]: true }))
    const hh = households.find(h => h.householdId === householdId)
    if (!hh) return

    const scannedIds = hh.children.flatMap(c => c.books.map(b => b.scannedCopyId).filter((id): id is string => !!id))
    if (scannedIds.length > 0) {
      await supabase.from('book_copies').update({ status: 'packed' }).in('id', scannedIds)
    }

    setHouseholds(prev => prev.map(h => h.householdId === householdId ? { ...h, packed: true } : h))
    setMarking(prev => ({ ...prev, [householdId]: false }))
    setExpandedId(null)
  }

  function allScanned(hh: PackingHousehold) {
    return hh.children.every(c => c.books.every(b => !!b.scannedCopyId))
  }

  function totalBooks(hh: PackingHousehold) {
    return hh.children.reduce((n, c) => n + c.books.length, 0)
  }

  function scannedBooks(hh: PackingHousehold) {
    return hh.children.reduce((n, c) => n + c.books.filter(b => !!b.scannedCopyId).length, 0)
  }

  const pending = households.filter(h => !h.packed)
  const packed = households.filter(h => h.packed)

  return (
    <div style={{ ...font, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Top bar */}
      <div style={{ padding: '12px 24px', borderBottom: '1px solid #e5e5e5', display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0 }}>
        <button
          onClick={() => router.push('/admin/operations')}
          style={{ ...font, background: 'none', border: 'none', cursor: 'pointer', color: '#9b9b9b', fontSize: '13px', padding: 0 }}>
          ← Operations
        </button>
        <h1 style={{ ...font, margin: 0, fontSize: '15px', fontWeight: 700, color: '#1a1a1a' }}>Packing</h1>
        <div style={{ flex: 1 }} />
        {households.length > 0 && (
          <span style={{ ...font, fontSize: '13px', color: '#6b6b6b', fontWeight: 600 }}>
            {packed.length} / {households.length} packed
          </span>
        )}
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflow: 'auto', padding: '24px' }}>

        {loading && <p style={{ ...font, color: '#9b9b9b', fontSize: '13px' }}>Loading...</p>}

        {!loading && households.length === 0 && (
          <div style={{ textAlign: 'center', padding: '64px 0' }}>
            <p style={{ ...font, fontSize: '14px', color: '#9b9b9b', margin: '0 0 8px' }}>
              {debugInfo || 'No locked swap requests found.'}
            </p>
            <button onClick={loadHouseholds} style={{ ...font, background: 'none', border: 'none', cursor: 'pointer', color: '#1a1a1a', fontSize: '13px', textDecoration: 'underline', padding: 0 }}>
              Retry
            </button>
          </div>
        )}

        {/* Pending households */}
        {pending.map(hh => {
          const isOpen = expandedId === hh.householdId
          const done = allScanned(hh)
          const scanned = scannedBooks(hh)
          const total = totalBooks(hh)

          return (
            <div key={hh.householdId} style={{ marginBottom: '10px', border: '1px solid #e5e5e5', borderRadius: '8px', overflow: 'hidden' }}>

              {/* Household row */}
              <div
                onClick={() => {
                  const next = isOpen ? null : hh.householdId
                  setExpandedId(next)
                  if (next) setTimeout(() => scanRef.current[hh.householdId]?.focus(), 120)
                }}
                style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', backgroundColor: '#fafafa', userSelect: 'none' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ ...font, margin: 0, fontSize: '14px', fontWeight: 600, color: '#1a1a1a' }}>{hh.displayName}</p>
                  <p style={{ ...font, margin: '2px 0 0', fontSize: '12px', color: '#9b9b9b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{hh.address}</p>
                </div>
                <span style={{ ...font, fontSize: '11px', fontWeight: 600, color: hh.swapDay ? '#6b6b6b' : '#dc2626', backgroundColor: '#f0f0f0', padding: '3px 8px', borderRadius: '4px', textTransform: 'capitalize', flexShrink: 0 }}>
                  {hh.swapDay || 'no Bonkers Day set'}
                </span>
                <span style={{ ...font, fontSize: '12px', color: scanned > 0 ? '#16a34a' : '#9b9b9b', fontWeight: scanned > 0 ? 600 : 400, flexShrink: 0 }}>
                  {scanned}/{total} scanned
                </span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9b9b9b" strokeWidth="2"
                  style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }}>
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>

              {/* Expanded panel */}
              {isOpen && (
                <div style={{ padding: '16px 20px', borderTop: '1px solid #e5e5e5', backgroundColor: '#fff' }}>

                  {/* Scan input */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                    <input
                      ref={el => { scanRef.current[hh.householdId] = el }}
                      value={scanInput[hh.householdId] || ''}
                      onChange={e => setScanInput(prev => ({ ...prev, [hh.householdId]: e.target.value }))}
                      onKeyDown={e => { if (e.key === 'Enter') handleScan(hh.householdId) }}
                      placeholder="Scan book barcode (Enter to confirm)..."
                      disabled={scanning[hh.householdId]}
                      style={{ ...inp, width: '280px' }}
                      autoFocus
                    />
                    <Btn variant="secondary" disabled={scanning[hh.householdId]} onClick={() => handleScan(hh.householdId)}>
                      {scanning[hh.householdId] ? 'Checking...' : 'Confirm'}
                    </Btn>
                    {scanError[hh.householdId] && (
                      <span style={{ ...font, fontSize: '12px', color: '#dc2626' }}>{scanError[hh.householdId]}</span>
                    )}
                  </div>

                  {/* Children + books */}
                  {hh.children.map(child => (
                    <div key={child.childId} style={{ marginBottom: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <p style={{ ...secHead, margin: 0 }}>{child.name}{child.lastName ? ` ${child.lastName}` : ' (no last name)'}</p>
                        <button
                          onClick={() => printSingleLabel(hh, child)}
                          style={{ ...font, background: 'none', border: '1px solid #d4d4d4', borderRadius: '5px', cursor: 'pointer', fontSize: '11px', fontWeight: 600, color: '#4a4a4a', padding: '3px 10px' }}>
                          Print Label
                        </button>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {child.books.map(book => (
                          <div
                            key={book.itemId}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '12px',
                              padding: '8px 12px', borderRadius: '6px',
                              backgroundColor: book.scannedCopyId ? '#f0fdf4' : '#fafafa',
                              border: `1px solid ${book.scannedCopyId ? '#86efac' : '#e5e5e5'}`,
                            }}>
                            {/* Cover */}
                            {book.coverUrl
                              ? <img src={book.coverUrl} alt={book.title} style={{ width: '30px', height: '41px', objectFit: 'cover', borderRadius: '3px', flexShrink: 0 }} />
                              : <div style={{ width: '30px', height: '41px', backgroundColor: '#e5e5e5', borderRadius: '3px', flexShrink: 0 }} />
                            }
                            {/* Title + author */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ ...font, margin: 0, fontSize: '13px', fontWeight: 600, color: '#1a1a1a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{book.title}</p>
                              {book.author && <p style={{ ...font, margin: '2px 0 0', fontSize: '12px', color: '#9b9b9b' }}>{book.author}</p>}
                            </div>
                            {/* Shelf */}
                            {book.shelfLocation ? (
                              <span style={{ ...font, fontSize: '12px', fontWeight: 700, color: '#1a1a1a', backgroundColor: '#f4f4f5', padding: '3px 8px', borderRadius: '4px', flexShrink: 0, fontFamily: 'monospace' }}>
                                {book.shelfLocation}
                              </span>
                            ) : (
                              <span style={{ ...font, fontSize: '11px', color: '#c4c4c4', flexShrink: 0 }}>no shelf</span>
                            )}
                            {/* Scan status */}
                            {book.scannedCopyId ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5">
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                                <span style={{ ...font, fontSize: '11px', fontWeight: 600, color: '#16a34a', fontFamily: 'monospace' }}>{book.scannedInternalId}</span>
                              </div>
                            ) : (
                              <span style={{ ...font, fontSize: '11px', color: '#9b9b9b', flexShrink: 0 }}>awaiting scan</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  {/* Mark packed footer */}
                  <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid #f0f0f0', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '12px' }}>
                    {!done && (
                      <span style={{ ...font, fontSize: '12px', color: '#9b9b9b' }}>
                        {total - scanned} book{total - scanned !== 1 ? 's' : ''} still to scan
                      </span>
                    )}
                    <Btn
                      variant={done ? 'success' : 'secondary'}
                      disabled={!done || marking[hh.householdId]}
                      onClick={() => markPacked(hh.householdId)}>
                      {marking[hh.householdId] ? 'Saving...' : done ? 'Mark Packed' : 'Mark Packed'}
                    </Btn>
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {/* Packed section */}
        {packed.length > 0 && (
          <div style={{ marginTop: pending.length > 0 ? '28px' : 0 }}>
            <p style={secHead}>Packed ({packed.length})</p>
            {packed.map(hh => (
              <div key={hh.householdId} style={{
                marginBottom: '6px', padding: '10px 14px', borderRadius: '6px',
                backgroundColor: '#f0fdf4', border: '1px solid #86efac',
                display: 'flex', alignItems: 'center', gap: '10px',
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <p style={{ ...font, margin: 0, fontSize: '13px', fontWeight: 600, color: '#1a1a1a' }}>{hh.displayName}</p>
                <p style={{ ...font, margin: 0, fontSize: '12px', color: '#9b9b9b', flex: 1 }}>{hh.address}</p>
                {hh.swapDay && (
                  <span style={{ ...font, fontSize: '11px', color: '#9b9b9b', textTransform: 'capitalize' }}>{hh.swapDay}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
