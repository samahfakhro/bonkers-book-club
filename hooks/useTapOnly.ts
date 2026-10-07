import { useRef } from 'react'

export function useTapOnly(action: () => void) {
  const startPos = useRef<{ x: number; y: number } | null>(null)

  return {
    onPointerDown: (e: React.PointerEvent) => {
      startPos.current = { x: e.clientX, y: e.clientY }
    },
    onPointerUp: (e: React.PointerEvent) => {
      if (!startPos.current) return
      const dx = Math.abs(e.clientX - startPos.current.x)
      const dy = Math.abs(e.clientY - startPos.current.y)
      if (dx < 8 && dy < 8) action()
      startPos.current = null
    },
  }
}
