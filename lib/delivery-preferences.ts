// Delivery & collection options. Families rank as many as suit them; the driver tries #1 first, then #2…
// Books are dropped off and picked up at the same visit, so one list covers both.
// households.delivery_preferences holds the ordered list; delivery_preference keeps #1 for older code.

export const DELIVERY_OPTIONS = [
  { value: 'leave_at_door', label: 'At the door', sub: 'Contactless' },
  { value: 'leave_safe_spot', label: 'Safe spot', sub: 'Contactless' },
  { value: 'ring_bell', label: 'Ring bell', sub: "Someone's home" },
  { value: 'call_no_bell', label: 'Call me', sub: "Don't ring bell" },
  { value: 'leave_with_reception', label: 'Reception', sub: 'Concierge' },
] as const

export const PREFERENCE_LABEL: Record<string, string> = {
  leave_at_door: 'Leave at the door (contactless)',
  leave_safe_spot: 'Leave in their safe spot',
  ring_bell: 'Ring the bell — someone is home',
  call_no_bell: 'Call them — don’t ring the bell',
  leave_with_reception: 'Leave with reception / concierge',
}

// Tap to add to the end of the list; tap again to remove (the rest move up).
export const togglePreference = (list: string[], value: string) =>
  list.includes(value) ? list.filter(v => v !== value) : [...list, value]

// The ordered list for a household, falling back to the single older field.
export const preferencesOf = (h: { delivery_preferences?: string[] | null; delivery_preference?: string | null } | null | undefined): string[] =>
  h?.delivery_preferences?.length ? h.delivery_preferences : h?.delivery_preference ? [h.delivery_preference] : []

// Columns to save for a ranked list. Ranking safe spot or reception also gives the driver permission to use them.
export const preferenceColumns = (list: string[]) => ({
  delivery_preferences: list,
  delivery_preference: list[0] ?? null,
  backup_safe_drop: list.includes('leave_safe_spot') || list.includes('leave_at_door'),
  backup_concierge: list.includes('leave_with_reception'),
})
