import type { CardKey } from '@/collections/YearsOfLight'
import type { Firm, Media, Person, Project, User, YearsOfLight } from '@/payload-types'

import { filterHref, getPayloadClient, getPublishedProject, getPublishedProjects, type ProjectCard, projectPhotographers, projectSlides } from './projects'

/**
 * Year of Light: the year in review as a run of cards (src/app/(frontend)/year-of-light).
 * Every number is counted here from what the public site shows (published projects and their
 * awards), never typed in, so the story and the portfolio can't disagree. The cards run from
 * warm to daylight: each has a colour temperature, from 2700 K on the first to 6500 K on the last.
 */

export type Link = { label: string; href: string }

export type LightImage = { src: string; srcSet?: string; alt: string; position?: string }

type CardBody =
  | { kind: 'cover'; year: number; intro?: string }
  | { kind: 'completed'; year: number; count: number; href: string; projects: Link[] }
  | { kind: 'where'; count: number; places: (Link & { count: number })[]; note?: string }
  | { kind: 'awards'; count: number; projectCount: number; awards: { name: string; issuer?: string; project: Link }[] }
  | { kind: 'collaborators'; tie: boolean; picked: boolean; firms: (Link & { projects: Link[] })[] }
  | { kind: 'studio'; numbers: { value: string; label: string }[] }
  | {
      kind: 'light'
      project: Link
      details: Link[]
      image?: LightImage
      credit: string[]
      quote?: string
      quoteBy?: Link | { label: string; href?: undefined }
    }
  | { kind: 'closing'; year: number; thanks?: string; years: Link[] }
export type Card = CardBody & { kelvin: number; color: string }
export type CardKind = Card['kind']

export type StoryAward = { name: string; issuer?: string | null; project: number }
export type StoryFirm = Pick<Firm, 'name' | 'slug'>
export type StoryLight = {
  project: ProjectCard
  image?: LightImage
  credit: string[]
}

export type StoryInput = {
  edition: Pick<YearsOfLight, 'year' | 'intro' | 'hiddenCards' | 'whereNote' | 'studio' | 'thanks'> & {
    quote?: string | null
    quoteBy?: Pick<Person, 'name' | 'slug'> | null
  }
  /** Every published project (the portfolio). */
  projects: ProjectCard[]
  /** Awards dated this year. Awards of projects that aren't published are left out here. */
  awards: StoryAward[]
  /** Firms credited on projects, by slug (ProjectCard only carries their slugs). */
  credited: Map<string, string>
  /** Firms marketing chose to feature; empty to pick the most awarded. */
  picked: StoryFirm[]
  light?: StoryLight
  /** Other published years, for the last card. */
  years: number[]
}

const WARMEST = 2700
const COOLEST = 6500

/** The colour of a light at a colour temperature, as #rrggbb (Tanner Helland's fit to the Planckian locus). */
export function kelvinToHex(kelvin: number): string {
  const t = kelvin / 100
  const clamp = (v: number) => Math.round(Math.min(255, Math.max(0, v)))
  const r = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592)
  const g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * Math.pow(t - 60, -0.0755148492)
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307
  return `#${[r, g, b].map((v) => clamp(v).toString(16).padStart(2, '0')).join('')}`
}

const projectLink = (p: Pick<ProjectCard, 'name' | 'slug'>): Link => ({ label: p.name, href: `/projects/${p.slug}` })

/**
 * The firms behind the most awarded projects of the year: architects and credited firms (never
 * clients, which confidential projects hide), counted once per project. Only a firm on two or
 * more awarded projects stands out; up to three tied firms are shown together, more is no story.
 */
export function mostAwardedFirms(input: Pick<StoryInput, 'projects' | 'awards' | 'credited'>) {
  const awarded = new Set(input.awards.map((a) => a.project))
  const firms = new Map<string, { name: string; projects: ProjectCard[] }>()
  for (const p of input.projects.filter((p) => awarded.has(p.id))) {
    const onProject = new Map<string, string>([
      ...p.architects.filter((a) => a.slug).map((a) => [a.slug!, a.name] as [string, string]),
      ...p.collaboratorSlugs.filter((s) => input.credited.has(s)).map((s) => [s, input.credited.get(s)!] as [string, string]),
    ])
    for (const [slug, name] of onProject) {
      const f = firms.get(slug) ?? { name, projects: [] }
      f.projects.push(p)
      firms.set(slug, f)
    }
  }
  const best = Math.max(0, ...[...firms.values()].map((f) => f.projects.length))
  const top = [...firms].filter(([, f]) => f.projects.length === best).map(([slug, f]) => ({ slug, ...f }))
  if (best < 2 || top.length > 3) return []
  return top.sort((a, b) => a.name.localeCompare(b.name))
}

/** A firm's link: its projects in the portfolio, as architect where it is one, else as a credited firm. */
const firmHref = (slug: string, projects: ProjectCard[]) =>
  filterHref(projects.some((p) => p.architects.some((a) => a.slug === slug)) ? 'architect' : 'collaborator', slug)

/** The cards to show, in order, each with its colour temperature. Cards with nothing to show are left out. */
export function buildStory(input: StoryInput): Card[] {
  const { edition, projects } = input
  const year = edition.year
  const hidden = new Set<CardKey>((edition.hiddenCards ?? []) as CardKey[])
  const cards: CardBody[] = [{ kind: 'cover', year, intro: edition.intro || undefined }]
  const show = (key: CardKey) => !hidden.has(key)

  const completed = projects.filter((p) => p.year === year && p.status === 'completed').sort((a, b) => a.name.localeCompare(b.name))
  if (show('completed') && completed.length)
    cards.push({ kind: 'completed', year, count: completed.length, href: `/timeline#year-${year}`, projects: completed.map(projectLink) })

  const places = new Map<string, Link & { count: number }>()
  for (const p of completed) {
    if (!p.location?.slug || !p.location.displayName) continue
    const place = places.get(p.location.slug) ?? { label: p.location.displayName, href: filterHref('location', p.location.slug), count: 0 }
    place.count++
    places.set(p.location.slug, place)
  }
  if (show('where') && places.size)
    cards.push({
      kind: 'where',
      count: [...places.values()].reduce((n, p) => n + p.count, 0),
      places: [...places.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
      note: edition.whereNote || undefined,
    })

  const byId = new Map(projects.map((p) => [p.id, p]))
  const awards = input.awards
    .filter((a) => byId.has(a.project))
    .map((a) => ({ name: a.name, issuer: a.issuer || undefined, project: projectLink(byId.get(a.project)!) }))
    .sort((a, b) => a.project.label.localeCompare(b.project.label) || a.name.localeCompare(b.name))
  if (show('awards') && awards.length)
    cards.push({ kind: 'awards', count: awards.length, projectCount: new Set(awards.map((a) => a.project.href)).size, awards })

  if (show('collaborators')) {
    const awardedIds = new Set(input.awards.map((a) => a.project))
    const inYear = (p: ProjectCard) => awardedIds.has(p.id) || (p.year === year && p.status === 'completed')
    const withFirm = (slug: string) =>
      projects.filter((p) => inYear(p) && (p.architects.some((a) => a.slug === slug) || p.collaboratorSlugs.includes(slug)))
    const firms = input.picked.length
      ? input.picked.filter((f) => f.slug).map((f) => ({ slug: f.slug!, name: f.name, projects: withFirm(f.slug!) }))
      : mostAwardedFirms(input).map((f) => ({ ...f, projects: f.projects }))
    if (firms.length)
      cards.push({
        kind: 'collaborators',
        tie: !input.picked.length && firms.length > 1,
        picked: input.picked.length > 0,
        firms: firms.map((f) => ({
          label: f.name,
          href: firmHref(f.slug, projects),
          projects: f.projects.sort((a, b) => a.name.localeCompare(b.name)).map(projectLink),
        })),
      })
  }

  const numbers = (edition.studio ?? []).filter((s) => s.value && s.label).map((s) => ({ value: s.value, label: s.label }))
  if (show('studio') && numbers.length) cards.push({ kind: 'studio', numbers })

  if (show('light') && input.light) {
    const { project: p, image, credit } = input.light
    const quoteBy = edition.quoteBy
    cards.push({
      kind: 'light',
      project: projectLink(p),
      details: [
        ...p.typologies.filter((t) => t.slug).map((t) => ({ label: t.name, href: filterHref('typology', t.slug!) })),
        ...(p.location?.slug && p.location.displayName ? [{ label: p.location.displayName, href: filterHref('location', p.location.slug) }] : []),
      ],
      image,
      credit,
      quote: edition.quote || undefined,
      quoteBy: quoteBy ? (quoteBy.slug ? { label: quoteBy.name, href: `/about/team/${quoteBy.slug}` } : { label: quoteBy.name }) : undefined,
    })
  }

  cards.push({
    kind: 'closing',
    year,
    thanks: edition.thanks || undefined,
    years: input.years.filter((y) => y !== year).sort((a, b) => b - a).map((y) => ({ label: String(y), href: `/year-of-light/${y}` })),
  })

  // Warm to daylight, evenly over the cards that are shown.
  return cards.map((c, i) => {
    const kelvin = Math.round((WARMEST + ((COOLEST - WARMEST) * i) / Math.max(1, cards.length - 1)) / 100) * 100
    return { ...c, kelvin, color: kelvinToHex(kelvin) } as Card
  })
}

// ── loading ──────────────────────────────────────────────────────────────────

const isObject = <T>(value: unknown): value is T => typeof value === 'object' && value !== null

/** Published years, newest first. */
export async function getStoryYears(): Promise<number[]> {
  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'years-of-light',
    overrideAccess: false,
    pagination: false,
    depth: 0,
    sort: '-year',
    select: { year: true },
  })
  return result.docs.map((d) => d.year)
}

/**
 * One year's story as the public may see it. With `preview` (a logged-in editor, from the
 * admin's live preview), the latest draft of the year's own fields is used; the numbers still
 * come from published projects only.
 */
export async function getStory(year: number, preview?: { user: User }) {
  const payload = await getPayloadClient()
  const found = await payload.find({
    collection: 'years-of-light',
    overrideAccess: false,
    ...(preview ? { draft: true, user: preview.user } : {}),
    where: { year: { equals: year } },
    limit: 1,
    depth: 1,
  })
  const edition = found.docs[0]
  if (!edition) return undefined

  const [projects, awardDocs, years] = await Promise.all([
    getPublishedProjects(),
    payload.find({
      collection: 'awards',
      overrideAccess: false,
      pagination: false,
      depth: 0,
      where: { year: { equals: year } },
      select: { name: true, issuer: true, project: true },
    }),
    getStoryYears(),
  ])
  const awards = awardDocs.docs.flatMap((a) => {
    const id = isObject<{ id: number }>(a.project) ? a.project.id : a.project
    return typeof id === 'number' ? [{ name: a.name, issuer: a.issuer, project: id }] : []
  })

  const slugs = [...new Set(projects.flatMap((p) => p.collaboratorSlugs))].filter(Boolean)
  const firms = slugs.length
    ? await payload.find({
        collection: 'firms',
        overrideAccess: false,
        pagination: false,
        depth: 0,
        where: { slug: { in: slugs } },
        select: { name: true, slug: true },
      })
    : { docs: [] }
  const credited = new Map(firms.docs.filter((f) => f.slug).map((f) => [f.slug!, f.name]))

  // The light of the year: only a published project; the chosen photo, else the project's main one.
  const lightId = isObject<Project>(edition.light?.project) ? edition.light.project.id : edition.light?.project
  const lightCard = projects.find((p) => p.id === lightId)
  let light: StoryLight | undefined
  if (lightCard) {
    const full = await getPublishedProject(lightCard.slug)
    const chosen = isObject<Media>(edition.light?.image) && edition.light.image.url ? edition.light.image : undefined
    const slide = full ? projectSlides(full)[0] : undefined
    const fromChosen = chosen
      ? (() => {
          const sizes = [chosen.sizes?.card, chosen.sizes?.gallery, chosen.sizes?.hero].filter((s): s is { url: string; width: number } => Boolean(s?.url && s.width))
          return {
            src: chosen.sizes?.hero?.url ?? chosen.url!,
            srcSet: sizes.map((s) => `${s.url} ${s.width}w`).join(', ') || undefined,
            alt: chosen.alt,
            position: chosen.focalX != null && chosen.focalY != null ? `${chosen.focalX}% ${chosen.focalY}%` : undefined,
          }
        })()
      : undefined
    const chosenCredit = chosen ? (isObject<{ name: string }>(chosen.photographer) ? chosen.photographer.name : chosen.credit) : undefined
    light = {
      project: lightCard,
      image: fromChosen ?? (slide ? { src: slide.src, srcSet: slide.srcSet, alt: slide.alt, position: slide.position } : undefined),
      credit: chosenCredit ? [chosenCredit] : full ? projectPhotographers(full) : [],
    }
  }

  const quoteBy = isObject<Person>(edition.light?.quoteBy) ? edition.light.quoteBy : undefined
  const cards = buildStory({
    edition: { ...edition, quote: edition.light?.quote, quoteBy },
    projects,
    awards,
    credited,
    picked: (edition.collaborators ?? []).filter(isObject<Firm>),
    light,
    years,
  })
  // The share preview: the light of the year, else a photo of a project completed that year.
  const completedPhoto = projects.find((p) => p.year === year && p.status === 'completed' && p.image)?.image
  const share = light?.image ?? (completedPhoto ? { src: completedPhoto.src, alt: completedPhoto.alt } : undefined)
  return { year, cards, share }
}

/** "4 projects completed, 8 awards for 6 projects", for search results and share previews. */
export function describeStory(year: number, cards: Card[]): string {
  const parts = cards.flatMap((c) =>
    c.kind === 'completed'
      ? [`${c.count} ${c.count === 1 ? 'project' : 'projects'} completed`]
      : c.kind === 'awards'
        ? [`${c.count} ${c.count === 1 ? 'award' : 'awards'} for ${c.projectCount} ${c.projectCount === 1 ? 'project' : 'projects'}`]
        : [],
  )
  return `${year} at Tillotson Design Associates, from the first warm light to full daylight${parts.length ? `: ${parts.join(', ')}` : ''}.`
}
