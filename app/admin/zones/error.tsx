'use client'

// If the zone editor ever crashes, show a way back instead of a blank page.
// Unsaved drawing is kept in the browser (autosave) and offered for restore after reloading.
export default function ZonesError({ error, reset }: { error: Error; reset: () => void }) {
  console.error('Zone editor crashed', error)
  return (
    <div style={{ padding: '32px', maxWidth: '520px', color: '#1a1a1a', fontFamily: 'sans-serif' }}>
      <h1 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 8px' }}>The zone editor hit a problem</h1>
      <p style={{ fontSize: '0.9rem', lineHeight: 1.5, margin: '0 0 16px', color: '#555' }}>
        Don’t worry — your unsaved drawing is kept in this browser. Reload the page and choose “Restore my drawing”.
      </p>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button onClick={() => window.location.reload()} style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid #1a1a1a', background: '#1a1a1a', color: '#fff', cursor: 'pointer' }}>Reload</button>
        <button onClick={reset} style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid #ccc', background: '#fff', cursor: 'pointer' }}>Try again</button>
      </div>
    </div>
  )
}
