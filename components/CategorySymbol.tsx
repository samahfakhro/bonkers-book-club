import { getCategorySymbol } from '@/lib/category-blobs'

// The little symbol that sits in the middle of a category blob (put it inside a position: relative box with the blob).
export default function CategorySymbol({ name }: { name: string }) {
  const s = getCategorySymbol(name)
  if (!s) return null
  return <img src={s.src} alt="" style={{ position: 'absolute', inset: 0, width: s.size, height: s.size, objectFit: 'contain', pointerEvents: 'none', margin: 'auto', filter: s.tint ? 'brightness(0)' : undefined, transform: s.nudge }} />
}
