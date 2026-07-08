'use client'

import { usePathname } from 'next/navigation'

const BIRD_PAGES = ['/dashboard', '/dashboard/children/new']

export default function BonkyFlying() {
  const pathname = usePathname()
  const show = BIRD_PAGES.some(p => pathname === p || pathname.startsWith('/dashboard/children/'))
  if (!show) return null
  return (
    <img src="/bonky_flying.png" alt="" style={{ position: 'absolute', top: '116px', left: '66px', transform: 'translate(-50%, -50%)', width: '120px', height: 'auto', zIndex: 51, pointerEvents: 'none' }} />
  )
}
