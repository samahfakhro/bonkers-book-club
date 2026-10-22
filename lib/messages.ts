// Server-only. The wording for a message: Admin → Messages edits if there are any, otherwise the original
// from lib/message-templates.ts, with the family's details filled in.
import { supabaseAdmin } from '@/lib/supabase-admin'
import { fillPlaceholders, templateByKey } from '@/lib/message-templates'

let cache: { at: number; edits: Map<string, { title: string | null; body: string }> } | null = null

async function edits() {
  if (cache && Date.now() - cache.at < 60_000) return cache.edits
  const { data } = await supabaseAdmin.from('message_templates').select('key, title, body')
  cache = { at: Date.now(), edits: new Map((data || []).map(r => [r.key, { title: r.title, body: r.body }])) }
  return cache.edits
}
export const clearMessageCache = () => { cache = null }

export async function renderMessage(key: string, vars: Record<string, string | number> = {}) {
  const t = templateByKey(key)
  if (!t) throw new Error(`Unknown message: ${key}`)
  const edit = (await edits().catch(() => new Map())).get(key)
  const title = edit?.title ?? t.title ?? ''
  const body = edit?.body ?? t.body
  return { title: fillPlaceholders(title, vars), body: fillPlaceholders(body, vars) }
}
