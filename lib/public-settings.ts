// Browser side: settings from the admin Settings page that parents' pages use. Fetched once per page load.
export type PublicSettings = {
  cutoffDaysBefore: number
  contactWhatsapp: string
  contactEmail: string
  howHeard: { value: string; label: string; followUp: string | null }[]
  defaultNotifyWhatsapp: boolean
  defaultNotifyEmail: boolean
  plans: { id: string; name: string; books: number; price: number }[]
}

// Days before the Curious Day that choices close. Updated once settings load (2 until then).
export let cutoffDaysBefore = 2

let cache: Promise<PublicSettings> | null = null
export function getPublicSettings(): Promise<PublicSettings> {
  cache ??= fetch('/api/settings/public').then(r => r.json()).then((s: PublicSettings) => {
    cutoffDaysBefore = s.cutoffDaysBefore || 2
    return s
  }).catch(() => { cache = null; throw new Error('Could not load settings') })
  return cache
}

// Weekday index (0 = Sunday) on which choices close for a Curious Day weekday index
export const cutoffWeekday = (bonkersDayIdx: number) => ((bonkersDayIdx - (cutoffDaysBefore % 7)) % 7 + 7) % 7
