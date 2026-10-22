import { Suspense } from 'react'
import ViewingAsBanner from '@/components/ViewingAsBanner'
import { FullDeliveryHost } from '@/components/FullDeliverySheet'
import MembershipGate from '@/components/MembershipGate'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense fallback={null}><ViewingAsBanner /></Suspense>
      {/* a family whose membership has ended only sees Settings, Support, Messages and their readers */}
      <MembershipGate>{children}</MembershipGate>
      {/* "next delivery is full" sheet, opened from any + button */}
      <FullDeliveryHost />
    </>
  )
}
