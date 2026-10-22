'use client'

import BlobRating from '@/components/BlobRating'

// The pop-up where a child reviews a book they've read: stars, optional category ratings, and a few words.
type Props = {
  book: { title: string; author?: string | null; cover_url?: string | null }
  stars: number; setStars: (n: number) => void
  cats: { id: string; label: string; name: string }[]
  catRatings: Record<string, number>; setCatRatings: (fn: (prev: Record<string, number>) => Record<string, number>) => void
  text: string; setText: (t: string) => void
  saving: boolean; onSave: () => void; onClose: () => void
}

export default function ReviewSheet({ book, stars, setStars, cats, catRatings, setCatRatings, text, setText, saving, onSave, onClose }: Props) {
  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(26,47,81,0.55)', zIndex: 60, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={() => onClose()}>
      <div onClick={e => e.stopPropagation()} style={{ backgroundColor: '#fefaf2', borderRadius: '24px 24px 0 0', border: 'none', boxShadow: '0 -8px 32px rgba(26,47,81,0.2)', width: '100%', maxWidth: '576px', maxHeight: '88vh', overflowY: 'auto', padding: '24px 20px 40px', position: 'relative' }}>

        {/* X button */}
        <button onClick={() => onClose()} style={{ position: 'absolute', top: '16px', right: '16px', background: 'rgba(26,47,81,0.08)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#1a2f51', fontSize: '1rem' }}>✕</button>

        {/* Book header */}
        <div style={{ display: 'flex', gap: '14px', marginBottom: '22px', paddingRight: '36px' }}>
          {book.cover_url && (
            <img src={book.cover_url} alt="" style={{ width: '64px', height: '86px', objectFit: 'cover', borderRadius: '8px', flexShrink: 0 }} />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontFamily: 'var(--font-cormorant), serif', fontWeight: 700, fontSize: '1.3rem', color: '#1a2f51', margin: '0 0 3px', lineHeight: 1.25 }}>{book.title}</p>
            {book.author && <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.85rem', color: '#1a2f51', margin: '0 0 8px' }}>{book.author}</p>}
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: '#5a8a5a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.72rem', fontWeight: 700, color: '#1a2f51', margin: 0, letterSpacing: '0.08em' }}>READ</p>
            </div>
          </div>
        </div>

        {/* What did you think */}
        <p style={{ fontFamily: 'var(--font-patrick-hand)', fontWeight: 400, fontSize: '1.7rem', color: '#1a2f51', margin: '0 0 12px', letterSpacing: '0.02em' }}>What did you think?</p>

        {/* Overall stars */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '22px' }}>
          {[1,2,3,4,5].map(s => (
            <button key={s} onClick={() => setStars(s)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill={s <= stars ? '#f9d174' : 'none'} stroke={s <= stars ? '#e0a800' : '#1a2f51'} strokeWidth="1.6"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            </button>
          ))}
        </div>

        {/* Category ratings (optional) */}
        {cats.length > 0 && <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.85rem', color: '#1a2f51', margin: '0 0 10px' }}>Rate the book’s categories too, if you like:</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '22px' }}>
          {cats.map(cat => (
            <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <p style={{ fontFamily: 'var(--font-patrick-hand)', fontSize: '1.1rem', color: '#1a2f51', letterSpacing: '0.02em', width: '118px', flexShrink: 0, margin: 0, lineHeight: 1.1 }}>{cat.label}</p>
              <BlobRating name={cat.name} rating={catRatings[cat.id] ?? 0} size={30} onRate={v => setCatRatings(prev => ({ ...prev, [cat.id]: v }))} />
            </div>
          ))}
        </div>

        {/* Text box */}
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Anything else you want to say about this book? (optional)"
          style={{ width: '100%', minHeight: '80px', backgroundColor: '#fff', border: '1px solid #ddd6cc', borderRadius: '12px', padding: '12px', fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.95rem', color: '#1a2744', resize: 'none', outline: 'none', boxSizing: 'border-box', marginBottom: '16px' }}
        />

        {text.trim() && <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.85rem', color: '#1a2f51', margin: '-6px 0 14px' }}>Your written review will appear on the book page once approved.</p>}

        {/* Save button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '12px' }}>
          {!stars && <p style={{ fontFamily: 'var(--font-montserrat), sans-serif', fontSize: '0.85rem', color: '#1a2f51', margin: 0 }}>Tap a star to rate it first</p>}
          <button onClick={onSave} disabled={saving || !stars} style={{ backgroundColor: '#1a2f51', color: '#fff', fontFamily: 'var(--font-montserrat), sans-serif', fontWeight: 700, fontSize: '0.8rem', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '10px 22px', borderRadius: '20px', border: 'none', cursor: 'pointer', opacity: !stars ? 0.45 : saving ? 0.6 : 1 }}>
            {saving ? 'Saving…' : 'Save Review'}
          </button>
        </div>

      </div>
    </div>
  )
}
