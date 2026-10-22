import type { MetadataRoute } from 'next'

// While the site is locked (pre-launch) search engines are asked to stay away; at launch the public pages open up.
export default function robots(): MetadataRoute.Robots {
  if (process.env.SITE_PASSWORD) return { rules: { userAgent: '*', disallow: '/' } }
  return { rules: { userAgent: '*', allow: '/', disallow: ['/admin', '/driver', '/dashboard', '/api', '/team', '/m'] } }
}
