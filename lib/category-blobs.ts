// Each library category has its own coloured blob and a little symbol that sits on it.

export function getCategoryBlob(name: string): string | null {
  const n = name.toLowerCase()
  if (n.includes('adventure')) return '/blob_adventure.png'
  if (n.includes('magic') || n.includes('mayhem')) return '/blob_magic.png'
  if (n.includes('heart')) return '/blob_heart.png'
  if (n.includes('laugh')) return '/blob_laugh.png'
  if (n.includes('weird')) return '/blob_weird.png'
  if (n.includes('true') || n.includes('bonkers')) return '/blob_true.png'
  if (n.includes('hero') || n.includes('legend')) return '/blob_hero.png'
  if (n.includes('mystery') || n.includes('mischief')) return '/blob_mystery.png'
  if (n.includes('spooky') || n.includes('scary')) return '/blob_spooky.png'
  return null
}

export function getCategorySymbol(name: string): { src: string; size: string } | null {
  const n = name.toLowerCase()
  const src = n.includes('adventure') ? '/symbol_rocket.png'
    : (n.includes('spooky') || n.includes('scary')) ? '/symbol_spooky1.png'
    : (n.includes('hero') || n.includes('legend')) ? '/symbol_hero.png'
    : (n.includes('mystery') || n.includes('mischief')) ? '/symbol_mystery.png'
    : (n.includes('true') || n.includes('bonkers')) ? '/symbol_true.png'
    : n.includes('laugh') ? '/symbol_laugh.png'
    : n.includes('weird') ? '/symbol_weird.png'
    : n.includes('heart') ? '/symbol_heart.png'
    : (n.includes('magic') || n.includes('mayhem')) ? '/symbol_magichat.png'
    : null
  if (!src) return null
  const size = (n.includes('magic') || n.includes('mayhem')) ? '75%' : (n.includes('true') || n.includes('bonkers')) ? '48%' : n.includes('heart') ? '45%' : '60%'
  return { src, size }
}
