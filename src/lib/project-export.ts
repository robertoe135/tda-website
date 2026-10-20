import type { Payload } from 'payload'

import { STILL_NEEDED } from '@/fields/stillNeeded'
import type { CreditRole, Firm, Location, Person, Photographer, Project, Typology } from '@/payload-types'

import { toCsv } from './csv'
import { siteUrl } from './seo'
import { ROLE_LABELS, sortTeam, type TeamRole } from './team-credits'

/**
 * Every project as one spreadsheet row, for marketing (admin → Projects → Export CSV). Shows
 * what the admin shows, latest drafts included, with a column saying what is live. Lists are
 * joined with "; " and roles written "Role: name, name", so a row reads like the project page.
 * Owners of confidential projects are included: the file is for staff, not for sharing.
 */

export const EXPORT_COLUMNS = [
  'id',
  'name',
  'on the site',
  'status',
  'year',
  'location',
  'categories',
  'architects',
  'credits',
  'owner',
  'confidential',
  'TDA team',
  'photographers',
  'area (sq ft)',
  'area note',
  'certifications',
  'awards',
  'press',
  'photos',
  'featured',
  'still needed',
  'page',
  'admin',
  'updated',
] as const

const isObject = <T>(v: unknown): v is T => typeof v === 'object' && v !== null
const names = (list: unknown[] | null | undefined) =>
  (list ?? []).filter(isObject<{ name: string }>).map((x) => x.name)
const STATUS: Record<Project['status'], string> = {
  completed: 'Completed',
  'in-progress': 'In progress',
  unbuilt: 'Unbuilt',
  cancelled: 'Cancelled',
}
const NEEDED = new Map<string, string>(STILL_NEEDED.map((o) => [o.value, o.label]))

export function projectRow(
  p: Project,
  ctx: { live: boolean; awards: string[]; press: number; site: string },
): Record<(typeof EXPORT_COLUMNS)[number], string | number> {
  const team = sortTeam(
    (p.team ?? [])
      .filter((t) => isObject<Person>(t.person))
      .map((t) => ({ role: t.role as TeamRole, name: (t.person as Person).name })),
  )
  const byRole = new Map<TeamRole, string[]>()
  for (const t of team) byRole.set(t.role, [...(byRole.get(t.role) ?? []), t.name])
  return {
    id: p.id,
    name: p.name,
    'on the site': ctx.live ? (p._status === 'published' ? 'live' : 'live, with unpublished changes') : 'draft only',
    status: STATUS[p.status] ?? p.status,
    year: p.year ?? '',
    location: isObject<Location>(p.location) ? (p.location.displayName ?? '') : '',
    categories: names(p.typologies as Typology[]).join('; '),
    architects: names(p.architects as Firm[]).join('; '),
    credits: (p.credits ?? [])
      .map((c) => `${isObject<CreditRole>(c.role) ? c.role.name : ''}: ${names(c.firms as Firm[]).join(', ')}`)
      .join('; '),
    owner: names(p.clients as Firm[]).join('; '),
    confidential: p.confidential ? 'yes' : '',
    'TDA team': [...byRole].map(([role, people]) => `${ROLE_LABELS[role]}: ${people.join(', ')}`).join('; '),
    photographers: names(p.photographers as Photographer[]).join('; '),
    'area (sq ft)': p.areaSqFt ?? '',
    'area note': p.areaNote ?? '',
    certifications: (p.certifications ?? [])
      .map((c) => [c.system?.toUpperCase(), c.note, c.level && c.level[0].toUpperCase() + c.level.slice(1)].filter(Boolean).join(' '))
      .join('; '),
    awards: ctx.awards.join('; '),
    press: ctx.press,
    photos: (p.heroImage ? 1 : 0) + (p.gallery?.length ?? 0),
    featured: p.featured ? 'yes' : '',
    'still needed': (p.stillNeeded ?? []).map((n) => NEEDED.get(n) ?? n).join('; '),
    page: p.slug ? `${ctx.site}/projects/${p.slug}` : '',
    admin: `${ctx.site}/admin/collections/projects/${p.id}`,
    updated: p.updatedAt?.slice(0, 10) ?? '',
  }
}

/** The whole portfolio as CSV, A to Z. */
export async function projectsCsv(payload: Payload): Promise<string> {
  const [latest, live, awards, press] = await Promise.all([
    payload.find({ collection: 'projects', draft: true, pagination: false, depth: 1, sort: 'name' }),
    payload.find({ collection: 'projects', pagination: false, depth: 0, where: { _status: { equals: 'published' } }, select: { name: true } }),
    payload.find({ collection: 'awards', pagination: false, depth: 0, sort: ['-year', 'name'], select: { name: true, year: true, issuer: true, project: true } }),
    payload.find({ collection: 'press', pagination: false, depth: 0, select: { projects: true } }),
  ])
  const liveIds = new Set(live.docs.map((p) => p.id))
  const awardsOf = new Map<number, string[]>()
  for (const a of awards.docs) {
    const id = isObject<{ id: number }>(a.project) ? a.project.id : (a.project as number)
    awardsOf.set(id, [...(awardsOf.get(id) ?? []), [a.year, a.name, a.issuer && `(${a.issuer})`].filter(Boolean).join(' ')])
  }
  const pressOf = new Map<number, number>()
  for (const item of press.docs)
    for (const ref of item.projects ?? []) {
      const id = isObject<{ id: number }>(ref) ? ref.id : (ref as number)
      pressOf.set(id, (pressOf.get(id) ?? 0) + 1)
    }
  const site = siteUrl()
  const rows = (latest.docs as Project[]).map((p) =>
    projectRow(p, { live: liveIds.has(p.id), awards: awardsOf.get(p.id) ?? [], press: pressOf.get(p.id) ?? 0, site }),
  )
  return toCsv(rows, [...EXPORT_COLUMNS])
}
