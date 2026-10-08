'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { navy, cream, yellow, Big, Card, Screen } from './ui'

// Driver Home — today's routes (Dubai date). Other days can be picked for testing / planning.
const dubaiToday = () => new Date(Date.now() + 4 * 3600_000).toISOString().slice(0, 10)
const prettyDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })

type DriverRoute = { id: string; route_date: string; status: string; zones: { code: string; name: string } | null; stops: number; done: number }

export default function DriverHome() {
  const router = useRouter()
  const [date, setDate] = useState(dubaiToday())
  const [routes, setRoutes] = useState<DriverRoute[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setRoutes(null)
    fetch(`/api/driver/routes?date=${date}`).then(r => r.json()).then(b => {
      if (b.error) { setError(b.error); setRoutes([]) } else { setError(null); setRoutes(b.routes) }
    }).catch(() => { setError('No connection — check your signal and try again.'); setRoutes([]) })
  }, [date])

  return (
    <Screen>
      <p style={{ margin: 0, fontFamily: 'var(--font-amatic)', fontSize: '2.6rem', fontWeight: 700, color: navy, lineHeight: 1 }}>BONKERS</p>
      <p style={{ margin: '2px 0 22px', fontSize: '12px', fontWeight: 700, letterSpacing: '0.16em', color: navy, opacity: 0.7 }}>DRIVER</p>

      <h1 style={{ margin: '0 0 4px', fontSize: '26px', color: navy }}>{date === dubaiToday() ? 'Today' : 'Routes'}</h1>
      <p style={{ margin: '0 0 18px', color: navy, opacity: 0.75 }}>{prettyDate(date)}</p>

      {error && <Card style={{ background: '#fdecea', color: '#b3261e', fontWeight: 600 }}>{error}</Card>}
      {routes === null && <p style={{ color: navy, opacity: 0.6 }}>Loading…</p>}
      {routes && routes.length === 0 && !error && (
        <Card><p style={{ margin: 0, fontSize: '17px', color: navy }}>No routes ready for this day.</p>
          <p style={{ margin: '6px 0 0', fontSize: '14px', color: navy, opacity: 0.7 }}>Routes appear here once they’re locked in the office.</p></Card>
      )}
      {routes?.map(r => {
        const complete = r.status === 'completed' || (r.stops > 0 && r.done === r.stops)
        return (
          <Card key={r.id} style={{ padding: '18px' }}>
            <p style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: navy }}>{r.zones?.code} {r.zones?.name}</p>
            <p style={{ margin: '4px 0 12px', fontSize: '16px', color: navy, opacity: 0.8 }}>{r.done} of {r.stops} stops done</p>
            <div style={{ height: '10px', background: '#ece4d6', borderRadius: '999px', overflow: 'hidden', marginBottom: '14px' }}>
              <div style={{ height: '100%', width: `${r.stops ? (r.done / r.stops) * 100 : 0}%`, background: complete ? '#2e7d32' : navy }} />
            </div>
            <Big onClick={() => router.push(`/driver/route/${r.id}`)} style={complete ? { background: cream, color: navy, border: `2px solid ${navy}` } : undefined}>
              {complete ? 'View finished route' : r.done ? 'Continue route' : 'Start route'}
            </Big>
          </Card>
        )
      })}

      <div style={{ marginTop: '26px', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ color: navy, opacity: 0.7, fontSize: '14px' }}>Another day:</span>
        <input type="date" value={date} onChange={e => e.target.value && setDate(e.target.value)}
          style={{ padding: '10px', borderRadius: '10px', border: `1px solid #ddd6cc`, fontSize: '15px', background: '#fff' }} />
        {date !== dubaiToday() && <button onClick={() => setDate(dubaiToday())} style={{ background: yellow, border: 'none', borderRadius: '999px', padding: '10px 16px', fontWeight: 700, color: navy }}>Today</button>}
      </div>
    </Screen>
  )
}
