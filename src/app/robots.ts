import type { MetadataRoute } from 'next'

import { getSettings } from '@/lib/site'
import { AI_CRAWLERS, indexingAllowed, siteUrl } from '@/lib/seo'

// Read the setting on each request, so the switch in the admin applies at once.
export const dynamic = 'force-dynamic'

export default async function robots(): Promise<MetadataRoute.Robots> {
  // Before launch pages carry noindex (layout.tsx); crawlers must be allowed to read them to
  // see it, so nothing is disallowed here and no sitemap is offered.
  if (!indexingAllowed()) return { rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/api'] }] }
  const settings = await getSettings()
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: ['/admin', '/api'] },
      ...(settings.blockAICrawlers ? [{ userAgent: AI_CRAWLERS, disallow: '/' }] : []),
    ],
    sitemap: `${siteUrl()}/sitemap.xml`,
  }
}
