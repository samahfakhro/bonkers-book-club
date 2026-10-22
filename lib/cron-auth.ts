import { NextRequest } from 'next/server'

// Scheduled jobs (vercel.json) — Vercel Cron sends "Authorization: Bearer <CRON_SECRET>"; anyone else is turned away.
export const cronAllowed = (req: NextRequest) => {
  const secret = process.env.CRON_SECRET
  return !!secret && req.headers.get('authorization') === `Bearer ${secret}`
}
