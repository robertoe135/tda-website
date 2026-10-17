import config from '@payload-config'
import { getPayload } from 'payload'

import { toSlug } from '@/fields/slug'

import type { Firm, Location, Media, Photographer, Project, Typology } from '@/payload-types'

/**
 * Data for the public projects pages. Every query runs with access control on
 * (overrideAccess: false), so pages only ever see what an anonymous visitor may see:
 * published projects, and no client on confidential ones.
 */

export const getPayloadClient = async () => getPayload({ config })

export type ProjectCard = {
  id: number
  name: string
  slug: string
  year?: number | null
  status?: Project['status']
  featured?: boolean | null
  location?: Pick<Location, 'displayName' | 'slug' | 'worldRegion'>
  typologies: Pick<Typology, 'name' | 'slug'>[]
  architects: Pick<Firm, 'name' | 'slug'>[]
  /** The main image, card-sized with larger sizes in srcSet, when one has been uploaded. */
  image?: { src: string; srcSet?: string; alt: string }
  /** Slugs of firms in the credits list and of clients, for the collaborator/client filters. */
  collaboratorSlugs: string[]
  clientSlugs: string[]
}

const isObject = <T>(value: unknown): value is T => typeof value === 'object' && value !== null

export const cardImage = (m: Media) => {
  const sizes = [m.sizes?.card, m.sizes?.gallery].filter((x): x is { url: string; width: number } => Boolean(x?.url && x?.width))
  return { src: m.sizes?.card?.url ?? m.url!, srcSet: sizes.map((x) => `${x.url} ${x.width}w`).join(', ') || undefined, alt: m.alt }
}

/** All published projects, newest first, with only the fields cards and filters need. */
export async function getPublishedProjects(): Promise<ProjectCard[]> {
  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'projects',
    overrideAccess: false,
    pagination: false,
    depth: 1,
    sort: ['-year', 'name'],
    select: {
      name: true,
      slug: true,
      year: true,
      status: true,
      featured: true,
      location: true,
      typologies: true,
      architects: true,
      credits: true,
      clients: true,
      heroImage: true,
    },
    populate: {
      media: { url: true, alt: true, sizes: true },
      locations: { displayName: true, slug: true, worldRegion: true },
      typologies: { name: true, slug: true, order: true },
      firms: { name: true, slug: true },
    },
  })
  return result.docs.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug ?? String(p.id),
    year: p.year,
    status: p.status,
    featured: p.featured,
    location: isObject<Location>(p.location) ? p.location : undefined,
    typologies: (p.typologies ?? []).filter(isObject<Typology>),
    architects: (p.architects ?? []).filter(isObject<Firm>),
    image: isObject<Media>(p.heroImage) && p.heroImage.url ? cardImage(p.heroImage) : undefined,
    collaboratorSlugs: (p.credits ?? []).flatMap((c) =>
      c.firms.filter(isObject<Firm>).map((f) => f.slug ?? ''),
    ),
    // Empty for confidential projects: field access removes clients from public reads.
    clientSlugs: (p.clients ?? []).filter(isObject<Firm>).map((f) => f.slug ?? ''),
  }))
}

export async function getTypologies(): Promise<Pick<Typology, 'name' | 'slug'>[]> {
  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'typologies',
    overrideAccess: false,
    pagination: false,
    sort: ['order', 'name'],
    select: { name: true, slug: true },
  })
  return result.docs.map((t) => ({ name: t.name, slug: t.slug }))
}

// ── filters ──────────────────────────────────────────────────────────────────

// Wording from tillotsondesign.com: "on the boards" is TDA's term for work in progress.
export const STATUS_OPTIONS = [
  { value: 'featured', label: 'Featured' },
  { value: 'completed', label: 'Completed' },
  { value: 'in-progress', label: 'On the Boards' },
] as const

export const REGION_OPTIONS = [
  { value: 'north-america', label: 'North America' },
  { value: 'south-america', label: 'South America' },
  { value: 'europe', label: 'Europe' },
  { value: 'middle-east', label: 'Middle East' },
  { value: 'africa', label: 'Africa' },
  { value: 'asia-pacific', label: 'Asia + Pacific' },
] as const

/** URL parameters. Several values in one group mean "any of"; different groups mean "all of". */
export const FILTER_KEYS = ['status', 'typology', 'region', 'location', 'architect', 'collaborator', 'client'] as const
/** Reached from labels on project pages rather than offered as checkboxes. */
export const LINK_ONLY_KEYS = ['location', 'collaborator', 'client'] as const
export type FilterKey = (typeof FILTER_KEYS)[number]
export type Filters = Record<FilterKey, string[]>

export function parseFilters(searchParams: Record<string, string | string[] | undefined>): Filters {
  const read = (key: FilterKey) => {
    const raw = searchParams[key]
    const values = Array.isArray(raw) ? raw : raw ? [raw] : []
    return [...new Set(values.flatMap((v) => v.split(',')).map((v) => v.trim()).filter(Boolean))]
  }
  return Object.fromEntries(FILTER_KEYS.map((k) => [k, read(k)])) as Filters
}

export function matches(project: ProjectCard, filters: Filters): boolean {
  const any = (wanted: string[], have: (string | null | undefined)[]) =>
    wanted.length === 0 || wanted.some((w) => have.includes(w))
  const statusFlags = [
    project.featured ? 'featured' : undefined,
    project.status ?? undefined,
  ]
  return (
    any(filters.status, statusFlags) &&
    any(filters.typology, project.typologies.map((t) => t.slug)) &&
    any(filters.region, [project.location?.worldRegion]) &&
    any(filters.location, [project.location?.slug]) &&
    any(filters.architect, project.architects.map((a) => a.slug)) &&
    any(filters.collaborator, project.collaboratorSlugs) &&
    any(filters.client, project.clientSlugs)
  )
}

/** Link to the projects index filtered by exactly one value: what every label on the site points to. */
export const filterHref = (key: FilterKey, value: string) =>
  `/projects?${new URLSearchParams({ [key]: value }).toString()}`

/** Link that adds or removes one value from the current filters. */
const FIRM_KEYS = ['architect', 'collaborator', 'client'] as const

/**
 * Firm filters written with another name of a firm (an alias, e.g. an old link to
 * ?architect=skidmore-owings-merrill) rewritten to the main firm. Returns the canonical
 * portfolio address when anything changed, so the page can redirect to it.
 */
export async function canonicalFirmFilters(filters: Filters): Promise<string | undefined> {
  if (!FIRM_KEYS.some((k) => filters[k].length)) return undefined
  const payload = await getPayloadClient()
  const firms = await payload.find({
    collection: 'firms',
    overrideAccess: false,
    pagination: false,
    depth: 0,
    where: { 'aliases.name': { exists: true } },
    select: { slug: true, aliases: true },
  })
  const main = new Map<string, string>()
  for (const f of firms.docs) for (const a of f.aliases ?? []) if (f.slug && toSlug(a.name)) main.set(toSlug(a.name)!, f.slug)
  let changed = false
  const next = { ...filters }
  for (const k of FIRM_KEYS) {
    next[k] = [...new Set(filters[k].map((v) => (main.has(v) ? ((changed = true), main.get(v)!) : v)))]
  }
  if (!changed) return undefined
  const params = new URLSearchParams()
  for (const k of FILTER_KEYS) for (const v of next[k]) params.append(k, v)
  return `/projects?${params.toString()}`
}

export function toggleHref(filters: Filters, key: FilterKey, value: string): string {
  const params = new URLSearchParams()
  for (const k of FILTER_KEYS) {
    const current = filters[k]
    const next =
      k === key ? (current.includes(value) ? current.filter((v) => v !== value) : [...current, value]) : current
    for (const v of next) params.append(k, v)
  }
  const query = params.toString()
  return query ? `/projects?${query}` : '/projects'
}

/** The portfolio address with some filter groups replaced and the rest kept: a category link. */
export function setHref(filters: Filters, changes: Partial<Filters>): string {
  const params = new URLSearchParams()
  for (const k of FILTER_KEYS) for (const v of changes[k] ?? filters[k]) params.append(k, v)
  const query = params.toString()
  return query ? `/projects?${query}` : '/projects'
}

export const SQ_FT_TO_M2 = 0.09290304

/** One published project with its relationships, as an anonymous visitor may see it. */
export async function getPublishedProject(slug: string) {
  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'projects',
    overrideAccess: false, // published only; confidential owners removed by field access
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 2,
  })
  return result.docs[0]
}

/** The summary, or the start of the description, for search results and share previews. */
export function describeProject(project: Project): string | undefined {
  if (project.summary) return project.summary
  const first = (project.description?.root?.children?.[0] as { children?: { text?: string }[] } | undefined)
    ?.children?.map((c) => c.text ?? '')
    .join('')
  return first ? (first.length > 160 ? `${first.slice(0, 157).trimEnd()}…` : first) : undefined
}

/** Slideshow slides from the hero image and gallery, in that order, using Payload's sizes. */
export function projectSlides(project: Project) {
  const images: { media: Media; caption?: string | null }[] = [
    ...(isObject<Media>(project.heroImage) ? [{ media: project.heroImage }] : []),
    ...(project.gallery ?? []).flatMap((g) => (isObject<Media>(g.image) ? [{ media: g.image, caption: g.caption }] : [])),
  ]
  return images
    .filter(({ media }) => media.url)
    .map(({ media, caption }) => {
      const sizes = [media.sizes?.card, media.sizes?.gallery, media.sizes?.hero].filter(
        (s): s is { url: string; width: number } => Boolean(s?.url && s.width),
      )
      return {
        src: media.sizes?.hero?.url ?? media.url!,
        srcSet: sizes.map((s) => `${s.url} ${s.width}w`).join(', ') || undefined,
        width: media.sizes?.hero?.width ?? media.width ?? undefined,
        height: media.sizes?.hero?.height ?? media.height ?? undefined,
        alt: media.alt,
        caption: caption ?? undefined, // only a caption someone wrote; alt text is not a caption
      }
    })
}

/**
 * The project's Photography credit: the photographers set on the project, then any credited
 * on a single image that are not already listed. In order, without repeats.
 */
export function projectPhotographers(project: Project): string[] {
  const onProject = (project.photographers ?? []).filter(isObject<Photographer>).map((p) => p.name)
  const media = [project.heroImage, ...(project.gallery ?? []).map((g) => g.image)].filter(isObject<Media>)
  const onImages = media.map((m) => (isObject<Photographer>(m.photographer) ? m.photographer.name : m.credit)).filter(
    (n): n is string => Boolean(n),
  )
  return [...new Set([...onProject, ...onImages])]
}
