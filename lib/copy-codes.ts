// Copy codes: every physical book has one, printed as a barcode label (CUR-0001, CUR-0002…).
// It's what gets scanned at packing, by the driver and at returns.

export const copyCode = (n: number) => `CUR-${String(n).padStart(4, '0')}`

// a scanned or typed copy label → "CUR-0042" (or null if it isn't one)
export function normaliseCopyLabel(raw: string): string | null {
  const m = raw.trim().toUpperCase().match(/^CUR-?(\d{1,5})$/)
  return m ? copyCode(parseInt(m[1], 10)) : null
}
