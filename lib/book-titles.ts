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

// The line shown under a book's title: "Dog Man · Book 5", "Goosebumps HorrorLand · Book 4", or just "Horrid Henry".
// s: the book's series (with its parent for a sub-series).
export function seriesLine(s: { name: string | null; series_number?: number | null; parent_series_id?: string | null; parent?: { name: string } | null } | null | undefined, bookNumber: number | null | undefined): string | null {
  if (!s) return null
  const name = s.name || (s.parent ? `${s.parent.name} · Series ${s.series_number ?? '?'}` : '')
  if (!name) return null
  return bookNumber ? `${name} · Book ${bookNumber}` : name
}

// for matching series names: "Mr Men", "Mr. Men", "The Mr. Men Series" and "Cat and Cat" / "Cat & Cat" are the same
export const seriesKey = (n: string) => (n || '').toLowerCase().replace(/&/g, ' and ').replace(/^the\s+/, '')
  .replace(/\s+(?:series|books|collection)$/, '').replace(/[^a-z0-9]/g, '')

// A book's own name, without the series in front: the series and number are shown on their own line under the title.
// "Dog Man 5: Lord of the Fleas" → "Lord of the Fleas"; "Goosebumps: Monster Blood" → "Monster Blood";
// "Bunny Vs Monkey 1" → "Bunny vs Monkey"; "Harry Potter and the Chamber of Secrets" stays whole.
export function ownTitle(rawTitle: string, names: string[]): string {
  const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const loose = (n: string) => esc(n.trim()).replace(/\\\./g, '\\.?').replace(/\s+/g, '\\s+').replace(/&|\band\b/gi, '(?:&|and)')
  const t = cleanTitle(rawTitle || '').replace(/\s+/g, ' ').trim()
  for (const n of names.filter(Boolean)) {
    const only = t.match(new RegExp('^' + loose(n) + '!?\\s*(?:#|book\\s*|vol\\.?\\s*)?\\d{0,3}$', 'i'))
    if (only) return n.trim()
    const m = t.match(new RegExp('^' + loose(n) + '!?(?:,?\\s*(?:vol\\.?|volume|book|#)?\\s*#?\\d{1,3})?\\s*(?::|\\s[-–—]\\s)\\s*', 'i'))
      ?? t.match(new RegExp('^' + loose(n) + '!?\\s*#?\\d{1,3}\\s+(?=[A-Z])', 'i'))   // "Dog Man 5 Lord of the Fleas"
    if (m && t.length > m[0].length) {
      const rest = t.slice(m[0].length).replace(/:\s*book \d+$/i, '').trim()
      return rest.charAt(0).toUpperCase() + rest.slice(1)
    }
  }
  return t
}

// (older) "Series Number: Book name" titles, e.g. "Dog Man 5: Lord of the Fleas".
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
