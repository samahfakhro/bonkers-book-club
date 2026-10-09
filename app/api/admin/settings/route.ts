import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { SETTING_GROUPS, getSettingValues, getPlans, parseHowOptions } from '@/lib/settings'

export async function GET() {
  const [values, plans] = await Promise.all([getSettingValues(), getPlans()])
  return NextResponse.json({ groups: SETTING_GROUPS, values, howHeard: parseHowOptions(values.how_heard_options), plans })
}

// POST { values?: {key: value}, howHeard?: [...], plans?: [{ id?, name, book_count, price_monthly, is_active }] }
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}))
  try {
    const known = new Set(SETTING_GROUPS.flatMap(g => g.fields.map(f => f.key)))
    const rows = Object.entries(b.values || {}).filter(([k]) => known.has(k)).map(([key, value]) => ({ key, value: String(value), updated_at: new Date().toISOString() }))
    if (Array.isArray(b.howHeard)) {
      const opts = b.howHeard.filter((o: any) => o?.label?.trim()).map((o: any) => ({
        value: (o.value || o.label).toString().trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''),
        label: o.label.trim(), followUp: o.followUp?.trim() || null,
      }))
      rows.push({ key: 'how_heard_options', value: JSON.stringify(opts), updated_at: new Date().toISOString() })
    }
    if (rows.length) {
      const { error } = await supabaseAdmin.from('system_settings').upsert(rows, { onConflict: 'key' })
      if (error) throw error
    }
    for (const p of Array.isArray(b.plans) ? b.plans : []) {
      const row = { name: String(p.name || '').trim(), book_count: Number(p.book_count), price_monthly: Number(p.price_monthly), is_active: !!p.is_active }
      if (!row.name || !(row.book_count > 0) || !(row.price_monthly >= 0)) return NextResponse.json({ error: 'Each plan needs a name, books and a price' }, { status: 400 })
      const { error } = p.id
        ? await supabaseAdmin.from('subscription_plans').update(row).eq('id', p.id)
        : await supabaseAdmin.from('subscription_plans').insert(row)
      if (error) throw error
    }
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Not saved' }, { status: 500 })
  }
}
