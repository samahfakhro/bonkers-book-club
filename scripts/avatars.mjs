// Turns Samah's avatar pictures into small round app images and lists them in the database.
// Drop new PNGs into public/avatars, then run:  node scripts/avatars.mjs
// Re-running is safe: existing avatars are updated, new ones are added.
import fs from 'fs'
import path from 'path'
import sharp from 'sharp'
import { createClient } from '@supabase/supabase-js'

const SRC = 'public/avatars'
const OUT = 'public/avatars/app'
const SIZE = 256
// order of the rows in the picker (Samah's choice): youngest appeal at the top, older kids further down.
// A style not listed here goes at the end.
const STYLE_ORDER = ['style10', 'style1', 'style9', 'style6', 'style4', 'style3', 'style8', 'style5', 'style2']
const styleRank = f => { const i = STYLE_ORDER.indexOf(f.split('_')[0].toLowerCase()); return i === -1 ? STYLE_ORDER.length : i }
// within a row: children and characters first, then animals, then things (rocket, ship…)
const PEOPLE = ['boy', 'girl', 'wizard', 'wizardess', 'fairy', 'gnome', 'astronaut', 'ballerina', 'knight', 'mermaid', 'pirate', 'princess', 'superhero']
const THINGS = ['rocket', 'ship', 'star', 'truck', 'book']
const kindRank = f => { const w = f.toLowerCase().replace(/\.[^.]+$/, '').split('_').slice(1).join('_').replace(/\d+$/, ''); return PEOPLE.includes(w) ? 0 : THINGS.includes(w) ? 2 : 1 }

const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)
  .filter(l => l.includes('=') && !l.startsWith('#')).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]))
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

fs.mkdirSync(OUT, { recursive: true })
const files = fs.readdirSync(SRC).filter(f => /\.(png|jpe?g|webp)$/i.test(f)).sort((a, b) => styleRank(a) - styleRank(b) || kindRank(a) - kindRank(b) || a.localeCompare(b, undefined, { numeric: true }))
const mask = Buffer.from(`<svg width="${SIZE}" height="${SIZE}"><circle cx="${SIZE / 2}" cy="${SIZE / 2}" r="${SIZE / 2}"/></svg>`)

const { data: existing } = await supabase.from('avatars').select('id, name')
const byName = new Map((existing || []).map(a => [a.name, a.id]))

for (const [i, file] of files.entries()) {
  const name = path.parse(file).name.toLowerCase().replace(/[^a-z0-9_-]+/g, '_')
  // trim the empty edges, fill a square, cut to a circle
  const trimmed = await sharp(path.join(SRC, file)).trim({ threshold: 10 }).toBuffer()
  await sharp(trimmed).resize(SIZE, SIZE, { fit: 'cover' }).composite([{ input: mask, blend: 'dest-in' }])
    .webp({ quality: 85 }).toFile(path.join(OUT, `${name}.webp`))
  const row = { name, image_url: `/avatars/app/${name}.webp`, display_order: i, is_active: true }
  const { error } = byName.has(name)
    ? await supabase.from('avatars').update(row).eq('id', byName.get(name))
    : await supabase.from('avatars').insert(row)
  console.log(error ? `✗ ${name}: ${error.message}` : `✓ ${name}`)
}
