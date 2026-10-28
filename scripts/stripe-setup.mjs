// One-off: create a Stripe product + monthly AED price for each plan that doesn't have one yet,
// and save the price id on subscription_plans.stripe_price_id.
// Run from the project folder:  node scripts/stripe-setup.mjs
// Uses STRIPE_SECRET_KEY from .env.local — a sk_test_ key creates them in the Stripe sandbox, sk_live_ for real.
import fs from 'fs'

const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split(/\r?\n/).filter(l => l.includes('='))
  .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^"|"$/g, '')]))
const { NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: service, STRIPE_SECRET_KEY: stripeKey } = env
if (!stripeKey) throw new Error('STRIPE_SECRET_KEY is missing from .env.local')
console.log(`Stripe ${stripeKey.startsWith('sk_live_') ? 'LIVE' : 'sandbox (test)'} mode`)

const db = { apikey: service, Authorization: `Bearer ${service}`, 'Content-Type': 'application/json' }
async function stripe(path, params) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: 'POST', headers: { Authorization: `Bearer ${stripeKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json?.error?.message || `Stripe error ${res.status}`)
  return json
}

const plans = await (await fetch(`${url}/rest/v1/subscription_plans?select=id,name,book_count,price_monthly,stripe_price_id&is_active=eq.true`, { headers: db })).json()
for (const p of plans) {
  if (p.stripe_price_id) { console.log(`${p.name}: already has ${p.stripe_price_id}`); continue }
  const product = await stripe('products', { name: `The Curious Library: ${p.name}`, description: `${p.book_count} books at a time, delivered on your Curious Day`, 'metadata[plan_id]': p.id })
  const price = await stripe('prices', { product: product.id, currency: 'aed', unit_amount: String(Math.round(Number(p.price_monthly) * 100)), 'recurring[interval]': 'month', 'metadata[plan_id]': p.id })
  const saved = await fetch(`${url}/rest/v1/subscription_plans?id=eq.${p.id}`, { method: 'PATCH', headers: db, body: JSON.stringify({ stripe_price_id: price.id }) })
  if (!saved.ok) throw new Error(`Saving ${p.name} failed: ${await saved.text()}`)
  console.log(`${p.name}: ${p.price_monthly} AED/month → ${price.id}`)
}
