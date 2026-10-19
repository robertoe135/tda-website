/**
 * Step 4 of the Squarespace migration: write the extracted data into Payload as drafts.
 *
 *   pnpm migrate:import             # create what is missing; never overwrite existing records
 *   pnpm migrate:import --update    # also overwrite imported fields on existing projects/people
 *
 * Reads cache/www.tillotsondesign.com/extracted/ (from `pnpm migrate:extract`) and writes
 * through the Payload Local API: people, typologies, locations, firms and clients, credit
 * roles, photographers, projects, awards and press. Projects and people are drafts; a person
 * at TDA publishes each one after review. Images are not imported: originals come from TDA's
 * file server, not Squarespace's compressed copies.
 *
 * Idempotent: records are matched on their normalized name, projects on their old addresses
 * (legacyUrls) or slug, so a second run adds nothing.
 *
 * Refuses to run against a database that is not on this machine unless --confirm-backup is
 * passed (the skill: never import into production without a fresh backup).
 */
import '../env'

import { readFile } from 'fs/promises'
import path from 'path'

import { getPayload, type Payload } from 'payload'

import config from '../../src/payload.config'
import { toSlug } from '../../src/fields/slug'
import { normalizeName } from '../../src/hooks/preventNearDuplicates'
import type { Location as LocationDoc, Project } from '../../src/payload-types'

import { ARCHITECT_ROLES, FIRM_ROLES, type Role } from './credit-labels'
import type { Location, ProjectRecord } from './extract'
import { cacheDir, type ReviewRow, richText, SITE, splitCredit, writeReview } from './lib'

const extractedDir = path.join(cacheDir, new URL(SITE).host, 'extracted')
const update = process.argv.includes('--update')

// TDA's portfolio menu, in its order ("on the boards" is a status, not a typology).
const TYPOLOGIES: [slug: string, name: string][] = [
  ['academic', 'Academic'],
  ['corporate', 'Corporate'],
  ['exhibitions', 'Exhibitions'],
  ['historic', 'Historic'],
  ['hospitality', 'Hospitality'],
  ['libraries', 'Libraries'],
  ['museums', 'Museums'],
  ['places-of-worship', 'Places of Worship'],
  ['performing-arts', 'Performing Arts'],
  ['residential', 'Residential'],
  ['restaurants', 'Restaurants'],
  ['retail', 'Retail'],
  ['sitepublicrealm', 'Site | Public Realm'],
]

// Countries as written on the old site → world region. Unlisted countries are flagged.
export const WORLD_REGION: Record<string, LocationDoc['worldRegion']> = {
  'United States': 'north-america',
  Canada: 'north-america',
  China: 'asia-pacific',
  Israel: 'middle-east',
  UK: 'europe',
  England: 'europe',
}

// Display names for credit roles that have several spellings on the old site.
export const ROLE_NAMES: Partial<Record<Role, string>> = {
  designArchitect: 'Design Architect',
  architect: 'Architect',
  collaboratingArchitect: 'Collaborating Architect',
  executiveArchitect: 'Executive Architect',
  architectOfRecord: 'Architect of Record',
  associateArchitect: 'Associate Architect',
  originalArchitect: 'Original Architect',
  interiorDesigner: 'Interior Designer',
  landscapeArchitect: 'Landscape Architect',
  exhibitDesigner: 'Exhibit Designer',
  ownerRepresentative: 'Owner Representative',
}
// Architects and designers first, then owner side, then engineers and consultants.
export const ROLE_ORDER: Partial<Record<Role, number>> = {
  designArchitect: 10,
  architect: 11,
  collaboratingArchitect: 12,
  executiveArchitect: 13,
  architectOfRecord: 14,
  associateArchitect: 15,
  originalArchitect: 16,
  interiorDesigner: 20,
  landscapeArchitect: 21,
  exhibitDesigner: 22,
  ownerRepresentative: 30,
  consultant: 40,
}

// ── safety ───────────────────────────────────────────────────────────────────

function assertLocalDatabase() {
  const url = process.env.DATABASE_URL ?? ''
  const host = (() => {
    try {
      return new URL(url).hostname
    } catch {
      return ''
    }
  })()
  if (['localhost', '127.0.0.1', '::1'].includes(host) || process.argv.includes('--confirm-backup')) return
  console.error(`DATABASE_URL points at ${host || 'an unknown host'}, not this machine.`)
  console.error('Take a fresh backup of that database, then rerun with --confirm-backup.')
  process.exit(1)
}

// ── helpers ──────────────────────────────────────────────────────────────────

export function parseArea(value?: string): { areaSqFt?: number; areaNote?: string } | undefined {
  if (!value) return undefined
  const m = value.match(/^([\d,.]+)\s*(SF|sq\.?\s*ft\.?|square feet)\b\s*(?:\/\s*(.*))?$/i)
  if (!m) return undefined
  return { areaSqFt: Number(m[1].replace(/,/g, '')), areaNote: m[3]?.trim() || undefined }
}

type Certification = NonNullable<Project['certifications']>[number]
export function parseCertifications(value?: string): Certification[] | undefined {
  if (!value) return []
  const out: Certification[] = []
  for (const part of value.split(',').map((p) => p.trim())) {
    const m = part.match(/^(LEED|WELL)\s*(.*?)\s*(Certified|Silver|Gold|Platinum)$/i)
    if (!m) return undefined // anything unusual goes to review instead of being forced in
    out.push({
      system: m[1].toLowerCase() as Certification['system'],
      level: m[3].toLowerCase() as Certification['level'],
      note: m[2] || undefined,
    })
  }
  return out
}

const isWebAddress = (value: string) => {
  try {
    const url = new URL(value)
    return (url.protocol === 'http:' || url.protocol === 'https:') && !/\s/.test(value) && url.hostname.includes('.')
  } catch {
    return false
  }
}

/**
 * The firms a project's old pages credit: architects from the label line (or, without one, the
 * credits page's architects), and every other firm credit under its role. A credits page can
 * name an architect the label line leaves out (a design or collaborating architect); it is kept
 * as a credit under its own role rather than dropped.
 */
export function planFirmCredits(p: Pick<ProjectRecord, 'labelFirms' | 'credits'>, splitLabelFirm: (segment: string) => string[] = (s) => [s]) {
  const entries = p.credits?.entries ?? []
  const fromLabel = p.labelFirms.length > 0
  const architects = fromLabel
    ? p.labelFirms.flatMap(splitLabelFirm)
    : entries.filter((e) => ARCHITECT_ROLES.has(e.role)).flatMap((e) => e.values)
  const credits = entries
    .filter((e) => FIRM_ROLES.has(e.role) && e.role !== 'lightingDesign')
    .filter((e) => !(ARCHITECT_ROLES.has(e.role) && !fromLabel)) // already the architects
    .map((e) => ({ role: e.role, roleName: ROLE_NAMES[e.role] ?? e.label, order: ROLE_ORDER[e.role] ?? 50, values: e.values }))
  return { architects, credits }
}

/**
 * Splits "Gensler, Studio Paolo Ferrari" into two firms only when the part before the comma
 * is a firm seen elsewhere on the site; "Skidmore, Owings & Merrill" stays one firm.
 */
export const labelFirmSplitter = (knownFirmKeys: Set<string>) => (segment: string): string[] => {
  if (!segment.includes(',')) return [segment]
  const parts = segment.split(',').map((p) => p.trim()).filter(Boolean)
  return knownFirmKeys.has(normalizeName(parts[0])) && parts.length > 1 ? parts : [segment]
}

/** "Gensler/WKSHPS": two firms joined by a slash, unless a firm is known by exactly that name. */
export const looksJoined = (value: string) => /\S\s*\/\s*\S/.test(value)

const yearOf = (value?: string) => (value && /^\d{4}$/.test(value.trim()) ? Number(value) : undefined)

/** Finds a firm by any of its names (its own or an alias), without creating one. */
export function firmFinder(payload: Payload) {
  return async (name: string): Promise<number | undefined> => {
    const normalized = normalizeName(name)
    const found = await payload.find({
      collection: 'firms',
      where: { or: [{ normalizedName: { equals: normalized } }, { 'aliases.normalizedName': { equals: normalized } }] },
      limit: 1,
      depth: 0,
    })
    return found.docs[0]?.id as number | undefined
  }
}

/** Finds a record by normalized name or creates it; never renames an existing record. */
export function finder(payload: Payload) {
  const cache = new Map<string, number>()
  return async function findOrCreate(
    collection: 'firms' | 'photographers' | 'creditRoles' | 'typologies',
    name: string,
    extra: Record<string, unknown> = {},
  ): Promise<number> {
    const key = `${collection}:${normalizeName(name)}`
    const hit = cache.get(key)
    if (hit) return hit
    const normalized = normalizeName(name)
    const found = await payload.find({
      collection,
      // A firm also answers to its other names (aliases), so a merged spelling is not recreated.
      where:
        collection === 'firms'
          ? { or: [{ normalizedName: { equals: normalized } }, { 'aliases.normalizedName': { equals: normalized } }] }
          : { normalizedName: { equals: normalized } },
      limit: 1,
      depth: 0,
    })
    const id = (found.docs[0]?.id ??
      (await payload.create({ collection, data: { name, ...extra } as never })).id) as number
    cache.set(key, id)
    return id
  }
}

/**
 * Finds a location by its display name ("New York, NY") or creates it; a location that cannot
 * be read as city and country is flagged instead.
 */
export function locationFinder(payload: Payload, flag: (where: string, field: string, asWritten: string, note: string) => void) {
  const locationIds = new Map<string, number>()
  return async function locationId(loc: Location | undefined, where: string): Promise<number | undefined> {
    if (!loc?.city || !loc.country) {
      if (loc) flag(where, 'location', loc.asWritten, 'Not imported: could not tell city and country apart. Set the location by hand.')
      return undefined
    }
    const display = [loc.city, loc.region || loc.country].join(', ')
    const key = normalizeName(display)
    if (locationIds.has(key)) return locationIds.get(key)
    const found = await payload.find({ collection: 'locations', where: { normalizedName: { equals: key } }, limit: 1, depth: 0 })
    const worldRegion = WORLD_REGION[loc.country]
    if (!worldRegion && !found.docs[0]) {
      flag(where, 'world region', loc.country, `No world region set for this country. Choose one on the location ${display}.`)
    }
    const id =
      found.docs[0]?.id ??
      (
        await payload.create({
          collection: 'locations',
          data: { city: loc.city, region: loc.region, country: loc.country, worldRegion },
        })
      ).id
    locationIds.set(key, id)
    return id
  }
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  assertLocalDatabase()
  const payload = await getPayload({ config })
  const findOrCreate = finder(payload)
  const review: ReviewRow[] = []
  const flag = (where: string, field: string, asWritten: string, note: string) =>
    review.push({ url: where.startsWith('http') ? where : `${SITE}${where}`, field, asWritten, suggested: '', note })

  const read = async <T>(file: string): Promise<T> =>
    JSON.parse(await readFile(path.join(extractedDir, file), 'utf8')) as T
  const projects = await read<ProjectRecord[]>('projects.json')
  const people = await read<{ name: string; title: string; group: string; order: number }[]>('people.json')
  const firms = await read<{ key: string; preferred?: string }[]>('firms.json')
  const preferred = new Map(firms.filter((f) => f.preferred).map((f) => [f.key, f.preferred!]))
  const knownFirmKeys = new Set(firms.map((f) => f.key))
  const firmId = (name: string) => findOrCreate('firms', preferred.get(normalizeName(name)) ?? name)
  const findFirm = firmFinder(payload)
  // A credit naming several firms in one line is flagged rather than made into one odd firm.
  const creditFirmId = async (name: string) =>
    looksJoined(name) && !(await findFirm(preferred.get(normalizeName(name)) ?? name)) ? undefined : firmId(name)

  const counts: Record<string, number> = {}
  const bump = (k: string) => (counts[k] = (counts[k] ?? 0) + 1)

  // Typologies
  const typologyIds = new Map<string, number>()
  for (const [i, [slug, name]] of TYPOLOGIES.entries()) {
    typologyIds.set(slug, await findOrCreate('typologies', name, { order: (i + 1) * 10, slug }))
  }

  // People: drafts, hidden from the site until the credit policy is decided.
  const groups: Record<string, 'leadership' | 'design' | 'administration'> = {
    Leadership: 'leadership',
    'Design Team': 'design',
    Administration: 'administration',
  }
  for (const person of people) {
    const slug = toSlug(person.name)!
    const existing = await payload.find({ collection: 'people', where: { slug: { equals: slug } }, limit: 1, draft: true, depth: 0 })
    const data = {
      name: person.name,
      title: person.title,
      group: groups[person.group],
      order: person.order,
      isCurrent: true,
      showOnSite: false,
      slug,
    }
    if (!existing.docs[0]) {
      await payload.create({ collection: 'people', data, draft: true })
      bump('people created')
    } else if (update) {
      const { showOnSite: _keep, ...rest } = data // never flip an editor's showOnSite decision
      await payload.update({ collection: 'people', id: existing.docs[0].id, data: rest, draft: true })
      bump('people updated')
    }
  }

  const locationId = locationFinder(payload, flag)

  const splitLabelFirm = labelFirmSplitter(knownFirmKeys)

  // Projects
  const currentYear = new Date().getFullYear()
  for (const p of projects) {
    try {
      await importProject(p)
    } catch (error) {
      flag(p.legacyPaths[0] ?? '/on-the-boards', 'project', p.name, `Import failed: ${(error as Error).message}`)
      bump('projects failed')
    }
  }

  async function importProject(p: ProjectRecord) {
    const where = p.legacyPaths[0] ?? '/on-the-boards'
    const c = p.credits

    const plan = planFirmCredits(p, splitLabelFirm)
    const architects = [...new Set(await Promise.all(plan.architects.map(firmId)))]

    // Credits: everyone else, grouped by role in the order they appear. A firm already named as
    // architect (under any of its names) is not repeated.
    const creditRows = new Map<number, number[]>()
    for (const row of plan.credits) {
      const ids: number[] = []
      for (const v of row.values) {
        const id = await creditFirmId(v)
        if (id === undefined) flag(p.creditsPath ?? where, 'credit', `${row.roleName}: ${v}`, 'Looks like several firms in one line; not imported. Add each firm by hand.')
        else if (!architects.includes(id)) ids.push(id)
      }
      if (!ids.length) continue
      const roleId = await findOrCreate('creditRoles', row.roleName, { order: row.order })
      creditRows.set(roleId, [...(creditRows.get(roleId) ?? []), ...ids])
    }
    for (const e of c?.entries ?? []) {
      if (e.role === 'curator' || e.role === 'artist') {
        flag(p.creditsPath ?? where, 'credit', `${e.label}: …`, 'Curators and artists are people, not firms; not imported into credits. Add by hand if they should be credited.')
      }
      if (e.role === 'lightingDesign' && normalizeName(e.value) !== normalizeName('Tillotson Design Associates')) {
        flag(p.creditsPath ?? where, 'lighting design', e.value, 'Lighting design credit is not "Tillotson Design Associates". Typo, or a predecessor-firm project?')
      }
    }

    const clients = c?.owner ? [await firmId(c.owner)] : []
    const residential = p.typologies.includes('residential')

    const area = parseArea(c?.area)
    if (c?.area && !area) flag(p.creditsPath ?? where, 'area', c.area, 'Area not in "N SF" form; not imported. Enter it by hand.')
    const certifications = parseCertifications(c?.sustainabilityStatus)
    if (!certifications) flag(p.creditsPath ?? where, 'certification', c?.sustainabilityStatus ?? '', 'Not a plain "LEED Gold" style value; not imported. Enter it by hand.')

    const year = yearOf(c?.completed)
    if (c?.completed && !year) flag(p.creditsPath ?? where, 'year', c.completed, 'Not a single year; not imported. Enter it by hand.')
    const status: Project['status'] | undefined = p.onTheBoards
      ? 'in-progress'
      : year && year > currentYear
        ? 'in-progress'
        : p.label || year
          ? 'completed'
          : undefined

    const slugBase = p.key.startsWith('/') ? toSlug(p.name)! : p.key
    const data = {
      name: p.name,
      status,
      year,
      location: await locationId(p.location ?? c?.location, where),
      ...(area ?? {}),
      certifications: certifications ?? [],
      typologies: p.typologies.map((t) => typologyIds.get(t)!).filter(Boolean),
      architects,
      credits: [...creditRows].map(([role, firmIds]) => ({ role, firms: [...new Set(firmIds)] })),
      clients,
      confidential: residential,
      description: p.description.length ? richText(p.description) : undefined,
      featured: p.featured,
      legacyUrls: p.legacyPaths.map((pathValue) => ({ path: pathValue })),
    }

    // Match on the project's own old address (slugs are editable), then on slug. Never on a
    // shared credits address, which can belong to another project.
    const existing = p.legacyPaths.length
      ? await payload.find({ collection: 'projects', where: { 'legacyUrls.path': { equals: p.legacyPaths[0] } }, limit: 1, draft: true, depth: 0 })
      : await payload.find({ collection: 'projects', where: { slug: { equals: slugBase } }, limit: 1, draft: true, depth: 0 })
    let projectId = existing.docs[0]?.id
    if (!projectId) {
      let slug = slugBase
      for (let n = 2; (await payload.count({ collection: 'projects', where: { slug: { equals: slug } } })).totalDocs; n++) {
        slug = `${slugBase}-${n}`
      }
      if (slug !== slugBase) flag(where, 'slug', slug, `Another project already uses ${slugBase}; this one got ${slug}.`)
      projectId = (await payload.create({ collection: 'projects', data: { ...data, slug } as never, draft: true })).id
      bump('projects created')
    } else if (update) {
      await payload.update({ collection: 'projects', id: projectId, data: data as never, draft: true })
      bump('projects updated')
    } else {
      bump('projects already imported (fields left as they are)')
    }

    // Photographers (credited on images later), awards and press.
    for (const name of (c?.photography ?? []).flatMap(splitCredit)) await findOrCreate('photographers', name)
    for (const award of c?.awards ?? []) {
      const dup = await payload.find({
        collection: 'awards',
        where: { and: [{ project: { equals: projectId } }, { name: { equals: award.text } }, ...(award.year ? [{ year: { equals: award.year } }] : [])] },
        limit: 1,
      })
      if (!dup.docs[0]) {
        await payload.create({ collection: 'awards', data: { name: award.text, year: award.year, project: projectId } })
        bump('awards created')
      }
    }
    for (const item of p.press) {
      if (!item.url || !isWebAddress(item.url)) {
        flag(where, 'press', item.title, 'Press item has no web link; not imported. Add the link by hand.')
        continue
      }
      const found = await payload.find({ collection: 'press', where: { url: { equals: item.url } }, limit: 1, depth: 0 })
      const doc = found.docs[0]
      if (!doc) {
        try {
          await payload.create({ collection: 'press', data: { title: item.title, outlet: item.outlet, url: item.url, projects: [projectId] } })
          bump('press created')
        } catch (error) {
          flag(where, 'press', item.title, `Not imported: ${(error as Error).message}`)
        }
      } else {
        const linked = (doc.projects ?? []).map((x) => (typeof x === 'object' ? x.id : x))
        if (!linked.includes(projectId)) {
          await payload.update({ collection: 'press', id: doc.id, data: { projects: [...linked, projectId] } })
        }
      }
    }
  }

  const residentialCount = projects.filter((p) => p.typologies.includes('residential')).length
  flag('/residential', 'confidential', `${residentialCount} residential projects`, 'Imported as confidential (client hidden). Confirm per project which residences can name the client (decisions.md, question 5).')

  const total = await writeReview('import', review)
  console.log(counts)
  console.log(`${review.length} import review rows; review.csv now has ${total}`)
  process.exit(0)
}

if (process.argv[1]?.endsWith('import.ts')) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
