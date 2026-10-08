// Codes printed on labels and scanned by the driver. Shared by packing and the driver app so they always agree.
//
//  Family barcode   4F7A2C9E1B3D      permanent, identifies the household (first 12 characters of its id)
//  Envelope code    4F7A2C9E1B3D-2    family barcode + the child's number in the family (1, 2, 3… by when they were added)
//  Stop number      Z3-001            this route only — printed big for boxes and the van
//  Visit reference  D-10425           permanent, one per family visit — printed small

export function familyCode(householdId: string): string {
  return householdId.replace(/-/g, '').slice(0, 12).toUpperCase()
}

export function envelopeCode(householdId: string, childNumber: number): string {
  return `${familyCode(householdId)}-${childNumber}`
}

// Reads a scanned code back into its parts. A bare family code (no child number) is also accepted.
export function parseScannedCode(raw: string): { family: string; childNumber: number | null } | null {
  const m = raw.trim().toUpperCase().match(/^([0-9A-F]{12})(?:-(\d{1,2}))?$/)
  if (!m) return null
  return { family: m[1], childNumber: m[2] ? Number(m[2]) : null }
}
