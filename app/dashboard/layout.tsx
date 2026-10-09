import { Suspense } from 'react'
import ViewingAsBanner from '@/components/ViewingAsBanner'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense fallback={null}><ViewingAsBanner /></Suspense>
      {children}
    </>
  )
}
