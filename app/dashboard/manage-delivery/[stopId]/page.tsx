'use client'

import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import ManageDelivery from '@/components/ManageDelivery'

// Signed-in version of Manage Delivery (the WhatsApp/email link uses /m/<token> and needs no login)
export default function ManageDeliveryPage() {
  const { stopId } = useParams<{ stopId: string }>()
  const router = useRouter()
  return (
    <ManageDelivery
      apiPath={`/api/manage-delivery/${stopId}`}
      headers={async (): Promise<Record<string, string>> => {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) { router.push('/login'); return {} }
        return { Authorization: `Bearer ${session.access_token}` }
      }}
      footer={<button onClick={() => router.push('/dashboard')} style={{ marginTop: '28px', background: 'none', border: 'none', padding: 0, fontFamily: 'var(--font-montserrat), sans-serif', color: '#1a2f51', opacity: 0.7, cursor: 'pointer' }}>← Back to dashboard</button>}
    />
  )
}
