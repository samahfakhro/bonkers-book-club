/**
 * Resolves a child's display name for reviews.
 *
 * review_display = 'first_name'  → "Layla, Age 8"
 * review_display = 'anonymous'   → "Bonkers reader, Age 8"
 *
 * Pass date_of_birth as an ISO string (YYYY-MM-DD) to include age.
 */
export function getReviewDisplayName(
  name: string,
  reviewDisplay: string | null | undefined,
  dateOfBirth: string | null | undefined
): string {
  const age =
    dateOfBirth
      ? Math.floor((Date.now() - new Date(dateOfBirth).getTime()) / (1000 * 60 * 60 * 24 * 365.25))
      : null

  const ageSuffix = age !== null && !isNaN(age) ? `, Age ${age}` : ''

  if (reviewDisplay === 'anonymous') {
    return `Bonkers reader${ageSuffix}`
  }

  return `${name}${ageSuffix}`
}
