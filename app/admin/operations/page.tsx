'use client'

import { useRouter } from 'next/navigation'

export default function OperationsPage() {
  const router = useRouter()
  return (
    <div style={{ padding: '32px', maxWidth: '600px' }}>
      <h1 style={{ fontSize: '15px', fontWeight: 700, color: '#1a1a1a', margin: '0 0 24px' }}>Operations</h1>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <button onClick={() => router.push('/admin/operations/routes')}
          style={{ padding: '24px', borderRadius: '10px', border: '1px solid #e5e5e5', backgroundColor: '#fff', cursor: 'pointer', textAlign: 'left' }}>
          <p style={{ margin: '0 0 6px', fontSize: '14px', fontWeight: 700, color: '#1a1a1a' }}>🗺️ Routes</p>
          <p style={{ margin: 0, fontSize: '12px', color: '#9b9b9b' }}>Build, review and lock each zone’s delivery route</p>
        </button>
        <button onClick={() => router.push('/admin/operations/packing')}
          style={{ padding: '24px', borderRadius: '10px', border: '1px solid #e5e5e5', backgroundColor: '#fff', cursor: 'pointer', textAlign: 'left' }}>
          <p style={{ margin: '0 0 6px', fontSize: '14px', fontWeight: 700, color: '#1a1a1a' }}>📦 Packing</p>
          <p style={{ margin: 0, fontSize: '12px', color: '#9b9b9b' }}>Scan and confirm books for locked swap requests</p>
        </button>
        <button onClick={() => router.push('/admin/operations/returns')}
          style={{ padding: '24px', borderRadius: '10px', border: '1px solid #e5e5e5', backgroundColor: '#fff', cursor: 'pointer', textAlign: 'left' }}>
          <p style={{ margin: '0 0 6px', fontSize: '14px', fontWeight: 700, color: '#1a1a1a' }}>↩️ Returns</p>
          <p style={{ margin: 0, fontSize: '12px', color: '#9b9b9b' }}>Scan returned books and reconcile loans</p>
        </button>
      </div>
    </div>
  )
}
