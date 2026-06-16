import type { MetadataRoute } from 'next'

const SITE_URL = 'https://www.bill4shared.site'

// Allow crawling of public pages; keep per-session URLs out of the index since
// they are private bills, not content meant to rank.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/new'],
      disallow: ['/session/', '/share/'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
