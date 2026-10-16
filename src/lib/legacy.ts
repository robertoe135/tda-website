import { getPayloadClient } from './projects'

/**
 * Where an address from the old Squarespace site lives now. Project and "full project credits"
 * addresses are stored on each project (Projects → legacyUrls), so redirects follow the data:
 * no list to maintain. Category pages open the filtered portfolio.
 */
const FIXED: Record<string, string> = {
  '/on-the-boards': '/projects?status=in-progress',
  // The sitemap's top page; review-notes.csv asks marketing to confirm it was the homepage.
  '/sereno-sofia-parazi-photography': '/',
}

// Top-level copies of a project page on the old site (review-notes.csv), resolved through the
// project's main old address so a renamed slug still works. /loyola-chapel is left out: two
// Loyola projects exist and marketing has to say which one it was.
export const ALIASES: Record<string, string> = {
  '/holt-renfrew': '/retail/holt-renfrew',
  '/foundation-in-the-midwest': '/corporate/foundation-in-the-midwest',
}

export async function resolveLegacyPath(raw: string): Promise<string | undefined> {
  const trimmed = raw.replace(/\/+$/, '') || '/'
  if (FIXED[trimmed.toLowerCase()]) return FIXED[trimmed.toLowerCase()]
  const path = ALIASES[trimmed.toLowerCase()] ?? trimmed
  const lower = path.toLowerCase()

  const payload = await getPayloadClient()
  const project = await payload.find({
    collection: 'projects',
    overrideAccess: false, // published projects only: never redirect to a page that 404s
    where: { or: [{ 'legacyUrls.path': { equals: path } }, { 'legacyUrls.path': { equals: lower } }] },
    limit: 1,
    depth: 0,
    select: { slug: true },
  })
  if (project.docs[0]?.slug) return `/projects/${project.docs[0].slug}`

  const segment = lower.match(/^\/([a-z0-9-]+)$/)?.[1]
  if (segment) {
    const typology = await payload.find({
      collection: 'typologies',
      overrideAccess: false,
      where: { slug: { equals: segment } },
      limit: 1,
      depth: 0,
      select: { slug: true },
    })
    if (typology.docs[0]) return `/projects?typology=${segment}`
  }
  return undefined
}
