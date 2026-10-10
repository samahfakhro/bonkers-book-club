'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { recordFirstTouch } from '@/lib/first-touch'

// Records where a visitor first came from (see lib/first-touch.ts). Skips the team's own pages.
export default function FirstTouchTracker() {
  const pathname = usePathname()
  useEffect(() => {
    if (/^\/(admin|driver)(\/|$)/.test(pathname)) return
    recordFirstTouch()
  }, [pathname])
  return null
}
