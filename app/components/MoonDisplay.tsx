'use client'

import { usePathname } from 'next/navigation'

export default function MoonDisplay() {
  const pathname = usePathname()
  if (pathname.startsWith('/dashboard/library/')) return null
  if (pathname === '/landing') return null
  return (
    <img src="/moon.png" alt="" style={{ position: 'absolute', top: '52px', left: '40px', width: '52px', height: 'auto', zIndex: 50, pointerEvents: 'none' }} />
  )
}
