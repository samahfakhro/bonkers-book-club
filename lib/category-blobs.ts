// Each library category has its own coloured blob and a little symbol that sits on it.
// One list for the whole app (library, book page, landing page, review ratings), matched by the category's name.
// Symbols are drawn black on the blob (tint), except the colourful rocket.

type Art = { words: string[]; blob: string; symbol: string | null; size: string; tint: boolean }

const ART: Art[] = [
  { words: ['adventure'],               blob: '/blob_adventure.png', symbol: '/symbol_rocket.png',   size: '60%', tint: false },
  { words: ['magic'],                   blob: '/blob_magic.png',     symbol: '/symbol_magichat.png', size: '75%', tint: true },
  { words: ['friendship', 'heart'],     blob: '/blob_heart.png',     symbol: '/symbol_heart.png',    size: '45%', tint: true },
  { words: ['funny', 'laugh'],          blob: '/blob_laugh.png',     symbol: '/symbol_laugh.png',    size: '52%', tint: true },
  { words: ['science'],                 blob: '/blob_weird.png',     symbol: '/symbol_science.png',  size: '55%', tint: true },
  { words: ['facts', 'true'],           blob: '/blob_true.png',      symbol: '/symbol_true.png',     size: '48%', tint: true },
  { words: ['mystery'],                 blob: '/blob_mystery.png',   symbol: '/symbol_mystery.png',  size: '52%', tint: true },
  { words: ['animal'],                  blob: '/blob_hero.png',      symbol: '/symbol_animals.png',  size: '54%', tint: true },
  { words: ['spooky', 'scary'],         blob: '/blob_spooky.png',    symbol: '/symbol_spooky1.png',  size: '60%', tint: true },
]

const artFor = (name: string) => { const n = name.toLowerCase(); return ART.find(a => a.words.some(w => n.includes(w))) ?? null }

export function getCategoryBlob(name: string): string | null {
  return artFor(name)?.blob ?? null
}

// tint = drawn in black on the blob (every symbol except the colourful rocket)
export function getCategorySymbol(name: string): { src: string; size: string; tint: boolean } | null {
  const a = artFor(name)
  return a?.symbol ? { src: a.symbol, size: a.size, tint: a.tint } : null
}
