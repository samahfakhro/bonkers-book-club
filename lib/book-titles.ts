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
