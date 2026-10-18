import { ROW_HEIGHTS, type RowLayout } from '@/globals/Home'
import type { Media, Person, Video } from '@/payload-types'

import { filterHref, getPayloadClient, getPublishedProjects, type ProjectCard } from './projects'

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

export type HomeMedia = { src: string; srcSet?: string; alt: string }
export type HomeVideo = { src: string; type: string; poster?: string }
/** `share`: the item's part of the row's width in its layout (a third, 13/22…), kept when others drop out. */
export type HomeTile = {
  kind: 'project'
  id?: string | null
  share: number
  project: ProjectCard
  image?: HomeMedia
  video?: HomeVideo
}
export type HomeQuote = {
  kind: 'quote'
  id?: string | null
  share: number
  text: string
  attribution: string
}
/** `height`: photo height on larger screens as a share of the row's width (Homepage → row Height). */
export type HomeRowData = {
  id?: string | null
  layout: RowLayout
  columns: number
  height?: number
  items: (HomeTile | HomeQuote)[]
}

/** Each place's share of the row's width, by layout: the old homepage's 24-column grid (13 + 9). */
const SHARES: Record<RowLayout, number[]> = {
  one: [1],
  two: [1 / 2, 1 / 2],
  three: [1 / 3, 1 / 3, 1 / 3],
  'wide-narrow': [13 / 22, 9 / 22],
  'narrow-wide': [9 / 22, 13 / 22],
}

const imageOf = (m: unknown): HomeMedia | undefined => {
  if (!isObject<Media>(m) || !m.url) return undefined
  const sizes = [m.sizes?.card, m.sizes?.gallery, m.sizes?.hero].filter(
    (x): x is { url: string; width: number } => Boolean(x?.url && x?.width),
  )
  return {
    src: m.sizes?.gallery?.url ?? m.url,
    srcSet: sizes.map((x) => `${x.url} ${x.width}w`).join(', ') || undefined,
    alt: m.alt,
  }
}

/**
 * Homepage rows in order. Tiles whose project is not published are left out; a row left
 * empty is dropped, and a row that lost items keeps a layout that fits what is left.
 */
export async function getHomeRows(): Promise<HomeRowData[]> {
  const [home, projects] = await Promise.all([
    (await getPayloadClient()).findGlobal({
      slug: 'home',
      overrideAccess: false,
      depth: 2,
      populate: { projects: { slug: true } },
    }),
    getPublishedProjects(),
  ])
  const byId = new Map(projects.map((p) => [p.id, p]))
  return (home.rows ?? []).flatMap((row): HomeRowData[] => {
    const shares = SHARES[row.layout] ?? SHARES.three
    const items = (row.items ?? []).flatMap((item, i): (HomeTile | HomeQuote)[] => {
      const share = shares[i] ?? shares[shares.length - 1]
      if (item.blockType === 'quote')
        return [
          { kind: 'quote', id: item.id, share, text: item.text, attribution: item.attribution },
        ]
      const id = typeof item.project === 'object' ? item.project.id : item.project
      const project = byId.get(id)
      if (!project) return []
      const video =
        isObject<Video>(item.video) && item.video.url
          ? {
              src: item.video.url,
              type: item.video.mimeType ?? 'video/mp4',
              poster: imageOf(item.video.poster)?.src,
            }
          : undefined
      return [
        {
          kind: 'project',
          id: item.id,
          share,
          project,
          image: imageOf(item.image) ?? project.image,
          video,
        },
      ]
    })
    if (!items.length) return []
    // A row whose project is unpublished keeps its layout: the others stay their size, centred,
    // rather than stretching across the page.
    return [
      {
        id: row.id,
        layout: row.layout,
        columns: shares.length,
        height: row.height ? ROW_HEIGHTS[row.height]?.share : undefined,
        items,
      },
    ]
  })
}

/** Completed published projects grouped by completion year, newest first. */
export async function getTimeline() {
  const projects = (await getPublishedProjects()).filter(
    (p) => p.year && p.status !== 'in-progress',
  )
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
  const docs = people.docs as Pick<
    Person,
    'id' | 'name' | 'slug' | 'title' | 'group' | 'headshot'
  >[]
  return TEAM_GROUPS.map((g) => ({
    ...g,
    people: docs
      .filter((p) => (p.group ?? 'design') === g.value)
      .map((p) => ({
        ...p,
        headshot:
          isObject<Media>(p.headshot) && p.headshot.url
            ? { src: p.headshot.sizes?.card?.url ?? p.headshot.url, alt: p.headshot.alt }
            : undefined,
      })),
  })).filter((g) => g.people.length)
}

/**
 * Collaborators: the firms marked "Show on Collaborators page" in the admin, A to Z, grouped by
 * first letter. A firm with published projects links to them in the portfolio (as architect, or
 * as a credited firm); one without has nothing to show yet, so its name is not a link.
 */
export async function getCollaborators() {
  const payload = await getPayloadClient()
  const [listed, projects] = await Promise.all([
    payload.find({
      collection: 'firms',
      overrideAccess: false,
      pagination: false,
      depth: 0,
      where: { listAsCollaborator: { equals: true } },
      select: { name: true, slug: true },
    }),
    getPublishedProjects(),
  ])
  const asArchitect = new Set(projects.flatMap((p) => p.architects.map((a) => a.slug)))
  const credited = new Set(projects.flatMap((p) => p.collaboratorSlugs))
  const firms = listed.docs
    .map((f) => ({
      name: f.name,
      slug: f.slug ?? '',
      href:
        f.slug && asArchitect.has(f.slug)
          ? filterHref('architect', f.slug)
          : f.slug && credited.has(f.slug)
            ? filterHref('collaborator', f.slug)
            : undefined,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }))
  const groups = new Map<string, typeof firms>()
  for (const f of firms) {
    const first = f.name.normalize('NFKD').charAt(0).toUpperCase()
    const letter = /[A-Z]/.test(first) ? first : '#'
    groups.set(letter, [...(groups.get(letter) ?? []), f])
  }
  return [...groups].map(([letter, list]) => ({ letter, firms: list }))
}

/** "40 Worth Street, Ste. 703, New York, NY 10013" and a directions link built from it. */
export function formatAddress(
  address: NonNullable<Awaited<ReturnType<typeof getSettings>>['address']>,
) {
  const line1 = [address.street, address.suite].filter(Boolean).join(' ')
  const line2 = [address.city, [address.region, address.postalCode].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(', ')
  const query = [address.street, line2].filter(Boolean).join(', ')
  return {
    lines: [line1, line2].filter(Boolean),
    directions: query
      ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}`
      : undefined,
    /** Google's keyless embed of the address, for the Contact page map. */
    mapEmbed: query
      ? `https://maps.google.com/maps?q=${encodeURIComponent(query)}&z=15&output=embed`
      : undefined,
  }
}

/** tel: link for a US number as written ("212-675-7760"). */
export const telHref = (phone: string) =>
  `tel:+1${phone.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '')}`
