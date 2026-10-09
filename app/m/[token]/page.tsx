'use client'

import { useParams } from 'next/navigation'
import ManageDelivery from '@/components/ManageDelivery'

// No-login Manage Delivery page, opened from the WhatsApp / email link after a missed visit
export default function ManageDeliveryLink() {
  const { token } = useParams<{ token: string }>()
  return <ManageDelivery apiPath={`/api/m/${token}`} />
}
