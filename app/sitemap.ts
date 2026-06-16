import type { MetadataRoute } from 'next'

const SITE_URL = 'https://www.bill4shared.site'

// Only the public, indexable pages. Session pages are private and excluded.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/new`, changeFrequency: 'monthly', priority: 0.8 },
  ]
}
