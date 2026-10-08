// A household's delivery ("Bonkers") day and order cutoff come from its delivery zone.
// The day is copied onto the household when its address is pinned (households.bonkers_day);
// the zone's own day/cutoff are used as a fallback. Books must be chosen by the cutoff time,
// 2 days before the delivery day.
//
// Query households with `zones(bonkers_day, cutoff_time)` so the zone comes along.

export function householdDeliveryDay(hh: any): { day: string | null; cutoffTime: string } {
  const zone = hh?.zones ?? null
  return {
    day: hh?.bonkers_day || zone?.bonkers_day || null,
    cutoffTime: zone?.cutoff_time || '20:00',
  }
}
