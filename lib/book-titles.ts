// Google titles often carry shop marketing: "Dog Man: From the Creator of Captain Underpants (Dog Man #1), 1" → "Dog Man"
export function cleanTitle(t: string): string {
  return t
    .replace(/\s*\([^)]*#\s*\d+[^)]*\)/g, '')                 // (Dog Man #1)
    .replace(/:\s*(?:a graphic novel|from the creator of [^:(]*|the [a-z ]*bestseller[^:(]*)/gi, '')
    .replace(/,\s*\d+\s*$/, '')                               // trailing ", 1"
    .replace(/\s+/g, ' ').replace(/[\s:,]+$/, '').trim()
}

// for comparing titles: "Dog Man: The Scarlet Shedder" and "Dog Man The Scarlet Shedder" are the same
export const titleKey = (t: string) => cleanTitle(t || '').toLowerCase().replace(/[^a-z0-9]/g, '')

// New books in a series are titled "Series Number: Book name", e.g. "Dog Man 5: Lord of the Fleas".
// names: the series names that may already be at the start of the title (sub-series first, then main series).
// No number yet → "Dog Man: Lord of the Fleas". Book named like the series (Dog Man book 1) → "Dog Man 1".
export function seriesTitle(rawTitle: string, displayName: string, number: number | null, names: string[]): string {
  const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  let name = cleanTitle(rawTitle || '').trim()
  for (const n of names.filter(Boolean)) {
    const m = name.match(new RegExp('^' + esc(n.trim()) + '(?:\\s*(?:(?:#|no\\.?|book|vol\\.?)\\s*)?#?\\s*\\d{1,3})?', 'i'))
    if (!m) continue
    const rest = name.slice(m[0].length)
    // strip only when the series name stands apart ("Dog Man: …", "Dog Man 5 …", "Dog Man Unleashed"),
    // not when it runs into the title ("Harry Potter and the Chamber of Secrets" stays whole)
    if (rest === '' || /^\s*[:,;–—-]/.test(rest) || /^\s+[A-Z0-9]/.test(rest)) name = rest.replace(/^\s*[:,;–—-]?\s*/, '').trim()
  }
  const head = number ? `${displayName} ${number}` : displayName
  return name && name.toLowerCase() !== displayName.toLowerCase() ? `${head}: ${name}` : head
}
