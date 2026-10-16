import type { Firm, Media, Person } from '@/payload-types'

import { getPayloadClient, getPublishedProjects, type ProjectCard } from './projects'

/**
 * Data for the homepage, timeline, About and contact pages. Everything is read as an
 * anonymous visitor (overrideAccess: false): published content only.
 */

const isObject = <T>(value: unknown): value is T => typeof value === 'object' && value !== null

export async function getSettings() {
  return (await getPayloadClient()).findGlobal({ slug: 'siteSettings', overrideAccess: false })
}

export async function getAbout() {
  return (await getPayloadClient()).findGlobal({ slug: 'about', overrideAccess: false, depth: 1 })
}

export type HomeItem =
  | { kind: 'quote'; id?: string | null; text: string; attribution: string }
  | { kind: 'project'; id?: string | null; project: ProjectCard }

/** Homepage items in order; projects that are not published are left out. */
export async function getHomeItems(): Promise<HomeItem[]> {
  const [home, projects] = await Promise.all([
    (await getPayloadClient()).findGlobal({ slug: 'home', overrideAccess: false, depth: 0 }),
    getPublishedProjects(),
  ])
  const byId = new Map(projects.map((p) => [p.id, p]))
  return (home.items ?? []).flatMap((item): HomeItem[] => {
    if (item.blockType === 'quote') return [{ kind: 'quote', id: item.id, text: item.text, attribution: item.attribution }]
    const id = typeof item.project === 'object' ? item.project.id : item.project
    const project = byId.get(id)
    return project ? [{ kind: 'project', id: item.id, project }] : []
  })
}

/** Completed published projects grouped by completion year, newest first. */
export async function getTimeline() {
  const projects = (await getPublishedProjects()).filter((p) => p.year && p.status !== 'in-progress')
  const years = new Map<number, typeof projects>()
  for (const p of projects) years.set(p.year!, [...(years.get(p.year!) ?? []), p])
  return [...years].sort(([a], [b]) => b - a).map(([year, list]) => ({ year, projects: list }))
}

export const TEAM_GROUPS = [
  { value: 'leadership', label: 'Leadership' },
  { value: 'design', label: 'Design Team' },
  { value: 'administration', label: 'Administration' },
] as const

/** Current staff who may be shown, by team page section and position. */
export async function getTeam() {
  const payload = await getPayloadClient()
  const people = await payload.find({
    collection: 'people',
    overrideAccess: false, // published, "Show on site" on
    where: { isCurrent: { equals: true } },
    pagination: false,
    sort: ['order', 'name'],
    depth: 1,
    select: { name: true, slug: true, title: true, group: true, headshot: true },
  })
  const docs = people.docs as Pick<Person, 'id' | 'name' | 'slug' | 'title' | 'group' | 'headshot'>[]
  return TEAM_GROUPS.map((g) => ({
    ...g,
    people: docs
      .filter((p) => (p.group ?? 'design') === g.value)
      .map((p) => ({
        ...p,
        headshot: isObject<Media>(p.headshot) && p.headshot.url ? { src: p.headshot.sizes?.card?.url ?? p.headshot.url, alt: p.headshot.alt } : undefined,
      })),
  })).filter((g) => g.people.length)
}

/**
 * Collaborators: architects credited on published projects, A to Z, grouped by first
 * letter. Computed, so the list never names a firm without projects to show.
 */
export async function getCollaborators() {
  const firms = new Map<string, Pick<Firm, 'name' | 'slug'> & { count: number }>()
  for (const p of await getPublishedProjects()) {
    for (const a of p.architects) {
      if (!a.slug) continue
      const entry = firms.get(a.slug) ?? { ...a, count: 0 }
      entry.count++
      firms.set(a.slug, entry)
    }
  }
  const sorted = [...firms.values()].sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }))
  const groups = new Map<string, typeof sorted>()
  for (const f of sorted) {
    const first = f.name.normalize('NFKD').charAt(0).toUpperCase()
    const letter = /[A-Z]/.test(first) ? first : '#'
    groups.set(letter, [...(groups.get(letter) ?? []), f])
  }
  return [...groups].map(([letter, list]) => ({ letter, firms: list }))
}

/** "40 Worth Street, Ste. 703, New York, NY 10013" and a directions link built from it. */
export function formatAddress(address: NonNullable<Awaited<ReturnType<typeof getSettings>>['address']>) {
  const line1 = [address.street, address.suite].filter(Boolean).join(' ')
  const line2 = [address.city, [address.region, address.postalCode].filter(Boolean).join(' ')].filter(Boolean).join(', ')
  const query = [address.street, line2].filter(Boolean).join(', ')
  return {
    lines: [line1, line2].filter(Boolean),
    directions: query ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}` : undefined,
  }
}
