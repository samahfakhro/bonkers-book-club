'use client'

import { getCategoryBlob, getCategorySymbol } from '@/lib/category-blobs'

// Five category blobs that fill in for a rating (e.g. 3 of 5 laugh blobs).
// Shown on the book page; tappable in the review pop-up when `onRate` is given (tap the same blob again to clear).
export default function BlobRating({ name, rating, size = 18, onRate, className }: {
  name: string; rating: number; size?: number; onRate?: (value: number) => void; className?: string
}) {
  const blob = getCategoryBlob(name)
  if (!blob) return null
  const symbol = getCategorySymbol(name)
  return (
    <div className={className} style={{ display: 'flex', alignItems: 'center', gap: onRate ? '6px' : '3px' }}>
      {[1, 2, 3, 4, 5].map(i => {
        const filled = rating >= i
        const half = !filled && rating >= i - 0.5
        const blobBox = (
          <div className={onRate ? undefined : 'review-blob-item'} style={{ width: `${size}px`, height: `${size}px`, position: 'relative', flexShrink: 0, transform: onRate && filled ? 'scale(1.06)' : 'none', transition: 'transform 0.15s' }}>
            {/* faded base blob */}
            <img src={blob} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', opacity: 0.25 }} />
            {/* filled blob (clipped for a half) */}
            {(filled || half) && (
              <div style={{ position: 'absolute', inset: 0, width: half ? '50%' : '100%', overflow: 'hidden' }}>
                <img src={blob} alt="" style={{ width: `${size}px`, height: `${size}px`, objectFit: 'contain' }} />
              </div>
            )}
            {symbol && <img src={symbol.src} alt="" style={{ position: 'absolute', inset: 0, width: symbol.size, height: symbol.size, objectFit: 'contain', margin: 'auto', filter: 'brightness(0)', opacity: filled ? 1 : half ? 0.6 : 0.25 }} />}
          </div>
        )
        return onRate ? (
          <button key={i} type="button" aria-label={`${i} of 5`} onClick={() => onRate(rating === i ? 0 : i)}
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
            {blobBox}
          </button>
        ) : <div key={i}>{blobBox}</div>
      })}
    </div>
  )
}
