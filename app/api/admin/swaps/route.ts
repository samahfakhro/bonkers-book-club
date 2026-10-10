import { NextRequest, NextResponse } from 'next/server'
import { adminFromRequest } from '@/lib/admin-auth'
import { householdSwaps, searchBooksForFamily, adminAddBook, adminRemoveBook } from '@/lib/admin-swaps'

// GET ?householdId=…            → each child's Coming next books + how many slots are left
// GET ?householdId=…&q=title    → book search with free copies for this family
export async function GET(req: NextRequest) {
  const hh = req.nextUrl.searchParams.get('householdId') || ''
  if (!/^[0-9a-f-]{36}$/.test(hh)) return NextResponse.json({ error: 'Choose a family' }, { status: 400 })
  const q = req.nextUrl.searchParams.get('q')
  return NextResponse.json(q != null ? { books: await searchBooksForFamily(hh, q) } : await householdSwaps(hh))
}

// POST { action: 'add', householdId, childId, bookId } | { action: 'remove', householdId, itemId }
export async function POST(req: NextRequest) {
  const admin = (await adminFromRequest(req)) || 'admin'
  const b = await req.json().catch(() => ({}))
  const result = b.action === 'add' ? await adminAddBook(admin, String(b.householdId), String(b.childId), String(b.bookId))
    : b.action === 'remove' ? await adminRemoveBook(admin, String(b.householdId), String(b.itemId))
    : { error: 'Unknown action' }
  return NextResponse.json(result, { status: 'error' in result ? 400 : 200 })
}
