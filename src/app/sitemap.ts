import type { MetadataRoute } from 'next'

import { getPayloadClient, getPublishedProjects } from '@/lib/projects'
import { siteUrl } from '@/lib/seo'

// Built on each request, so a project appears as soon as it is published.
export const dynamic = 'force-dynamic'

/** Every public page: the menu pages, published projects and current team members. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl()
  const payload = await getPayloadClient()
  const [projects, projectDates, people] = await Promise.all([
    getPublishedProjects(),
    payload.find({ collection: 'projects', overrideAccess: false, pagination: false, depth: 0, select: { slug: true, updatedAt: true } }),
    payload.find({
      collection: 'people',
      overrideAccess: false,
      where: { isCurrent: { equals: true } },
      pagination: false,
      depth: 0,
      select: { slug: true, updatedAt: true },
    }),
  ])
  const updated = new Map(projectDates.docs.map((p) => [p.slug, p.updatedAt]))
  const pages = ['/', '/projects', '/timeline', '/about', '/about/team', '/about/collaborators', '/contact', '/careers']
  return [
    ...pages.map((path) => ({ url: `${base}${path === '/' ? '' : path}` })),
    ...projects.map((p) => ({ url: `${base}/projects/${p.slug}`, lastModified: updated.get(p.slug) ?? undefined })),
    ...people.docs.filter((p) => p.slug).map((p) => ({ url: `${base}/about/team/${p.slug}`, lastModified: p.updatedAt })),
  ]
}
