// One-off (27 Oct 2026): remove the 14 test books from before the real catalogue, with their copies
// (COPY-… / BNK-… codes) and everything that points at them, so real books start clean at CUR-0001.
// Test families stay; only their records about these books go.
import fs from 'fs'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)
  .filter(l => l.includes('=') && !l.startsWith('#')).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

const { data: books } = await sb.from('books').select('id, title, cover_image_url, series_id, created_at')
// safety: only books created before the real catalogue work started, and no CUR copies
const { data: curCopies } = await sb.from('book_copies').select('book_id').like('internal_id', 'CUR-%')
const hasCur = new Set((curCopies || []).map(c => c.book_id))
const test = (books || []).filter(b => b.created_at < '2026-10-01' && !hasCur.has(b.id))
if (test.length !== 14) { console.log(`Expected 14 test books, found ${test.length} — stopping.`); process.exit(1) }
const bookIds = test.map(b => b.id)
const { data: copies } = await sb.from('book_copies').select('id').in('book_id', bookIds)
const copyIds = (copies || []).map(c => c.id)
const { data: loans } = copyIds.length ? await sb.from('loans').select('id').in('book_copy_id', copyIds) : { data: [] }
const loanIds = (loans || []).map(l => l.id)

const report = []
async function del(table, column, ids) {
  if (!ids.length) return
  const { error, count } = await sb.from(table).delete({ count: 'exact' }).in(column, ids)
  if (error && !/does not exist|schema cache/i.test(error.message)) report.push(`✗ ${table}.${column}: ${error.message}`)
  else if (count) report.push(`✓ ${table}: ${count}`)
}

// things about loans
await del('damage_charges', 'loan_id', loanIds)
await del('payment_requests', 'loan_id', loanIds)
// things about copies
await del('return_inspections', 'book_copy_id', copyIds)
await del('loans', 'id', loanIds)
await sb.from('swap_request_items').update({ packed_copy_id: null }).in('packed_copy_id', copyIds)
// things about books
for (const t of ['swap_request_items', 'wishlists', 'child_wishlist_items', 'book_reviews', 'book_availability_notifications', 'book_reservations', 'book_reading_levels', 'book_categories', 'buy_list', 'book_purchases'])
  await del(t, 'book_id', bookIds)
await sb.from('book_requests').update({ fulfilled_book_id: null }).in('fulfilled_book_id', bookIds).then(() => {}, () => {})
await del('book_copies', 'id', copyIds)
await del('books', 'id', bookIds)

// covers in storage, and series left empty
const paths = test.map(b => b.cover_image_url?.split('/book-covers/')[1]).filter(Boolean)
if (paths.length) { const { error } = await sb.storage.from('book-covers').remove(paths); report.push(error ? `✗ covers: ${error.message}` : `✓ covers removed: ${paths.length}`) }
for (const sid of new Set(test.map(b => b.series_id).filter(Boolean))) {
  const { count } = await sb.from('books').select('id', { count: 'exact', head: true }).eq('series_id', sid)
  if (count === 0) { await sb.from('series').delete().eq('parent_series_id', sid); await sb.from('series').delete().eq('id', sid); report.push('✓ empty series removed') }
}

const { count: left } = await sb.from('books').select('id', { count: 'exact', head: true })
console.log(report.join('\n'))
console.log(`Books left in the library: ${left}`)
