// Server-only. The look of every email to families: logo, cream background, navy text, one button, a tidy footer.
// Built with tables and inline styles so it looks the same in Gmail, Outlook and Apple Mail.

// the main artwork logo, with the eye blinking (an animated GIF — shows still in the few apps that don't animate, e.g. Outlook on Windows)
const LOGO = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/brand/logo-eye.gif`
const NAVY = '#1a2f51', CREAM = '#fefaf2'
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export function emailHtml(opts: {
  greeting: string                       // e.g. "Hi Sarah,"
  title?: string                         // headline under the logo
  paragraphs: string[]
  button?: { label: string; url: string }
  extraLink?: { label: string; url: string } | null
  settingsUrl: string                    // "manage your messages" link in the footer
}) {
  const p = (text: string) => `<p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:${NAVY};">${esc(text).replace(/\n/g, '<br>')}</p>`
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${CREAM};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CREAM};">
    <tr><td align="center" style="padding:28px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
        <tr><td align="center" style="padding:0 0 16px;">
          <img src="${LOGO}" width="280" alt="The Curious Library" style="display:block;width:280px;max-width:100%;height:auto;border:0;">
        </td></tr>
        <tr><td style="background:#ffffff;border-radius:18px;padding:30px 28px;border:1px solid #efe6d4;">
          ${opts.title ? `<h1 style="margin:0 0 18px;font-family:Georgia,'Times New Roman',serif;font-size:26px;line-height:1.25;color:${NAVY};font-weight:bold;">${esc(opts.title)}</h1>` : ''}
          ${p(opts.greeting)}
          ${opts.paragraphs.map(p).join('')}
          ${opts.button ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 6px;"><tr><td style="background:${NAVY};border-radius:999px;">
            <a href="${opts.button.url}" style="display:inline-block;padding:14px 30px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;letter-spacing:1px;color:#ffffff;text-decoration:none;">${esc(opts.button.label)}</a>
          </td></tr></table>` : ''}
          ${p('The Curious Library team').replace('margin:0 0 16px', 'margin:22px 0 0')}
        </td></tr>
        <tr><td align="center" style="padding:20px 10px 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:${NAVY};">
          Dubai · <a href="mailto:hello@curiouslibrary.ae" style="color:${NAVY};">hello@curiouslibrary.ae</a><br>
          ${opts.extraLink ? `<a href="${opts.extraLink.url}" style="color:${NAVY};">${esc(opts.extraLink.label)}</a> · ` : ''}<a href="${opts.settingsUrl}" style="color:${NAVY};">Manage your messages</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}
