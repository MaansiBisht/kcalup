import type { MetadataRoute } from 'next'

// Only the signed-out surface is worth indexing; everything else needs a session.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: ['/', '/login'], disallow: ['/day/', '/meal/', '/history', '/account', '/onboarding', '/api/', '/auth/'] }],
    sitemap: 'https://kcalup.maansi.fyi/sitemap.xml',
  }
}
