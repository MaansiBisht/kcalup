import type { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: 'https://kcalup.maansi.fyi', lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: 'https://kcalup.maansi.fyi/login', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
  ]
}
