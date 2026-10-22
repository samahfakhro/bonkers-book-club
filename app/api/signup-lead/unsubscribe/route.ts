import { NextRequest, NextResponse } from 'next/server'
import { unsubscribeLead } from '@/lib/signup-leads'

// "Don't send me reminders" from the sign-up reminder email (works without logging in)
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token') || ''
  if (/^[0-9a-f-]{36}$/i.test(token)) await unsubscribeLead(token)
  return new NextResponse(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>The Curious Library</title></head>
<body style="margin:0;background:#fefaf2;font-family:Arial,Helvetica,sans-serif;color:#1a2f51;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;padding:24px;box-sizing:border-box">
<div><h1 style="font-family:Georgia,serif;font-size:26px;margin:0 0 10px">You won’t get any more reminders</h1>
<p style="font-size:16px;line-height:1.6;margin:0">If you change your mind, you can join The Curious Library any time.</p></div></body></html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}
