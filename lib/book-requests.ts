// Book requests: families ask for books or series we don't have yet.
// Requests for the same title are grouped by a simple key so Admin sees "Dog Man — 9 families".

export const REQUEST_STATUSES = ['new', 'ordered', 'added', 'not_adding'] as const
export type RequestStatus = typeof REQUEST_STATUSES[number]
export const STATUS_LABEL: Record<RequestStatus, string> = { new: 'New', ordered: 'Ordered', added: 'Added', not_adding: 'Not adding' }

// "The Dog Man Series!" → "dog man"  (case, punctuation, a leading "the" and words like series/books ignored)
export function titleKey(title: string): string {
  return title.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(series|books?|collection|set)\b/g, ' ')
    .replace(/^\s*the\s+/, '')
    .replace(/\s+/g, ' ')
    .trim()
}
