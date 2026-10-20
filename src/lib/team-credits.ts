/**
 * TDA team credits (Principal in Charge, Project Manager, Designer) from a CSV marketing fills
 * in: reading it, matching projects and people, and saving each project's team as a draft.
 * Used by the admin's Projects list (Import team credits) and by `pnpm team:import`.
 */
import type { Payload, Where } from 'payload'

import { normalizeName } from '@/hooks/preventNearDuplicates'
import type { Person, Project } from '@/payload-types'

import { parseCsv, toCsv } from './csv'

export { parseCsv }

export type TeamRole = 'principal' | 'project-manager' | 'designer'
export const ROLE_ORDER: TeamRole[] = ['principal', 'project-manager', 'designer']
/** As written in the CSV (and read back by parseRole). */
export const ROLE_LABELS: Record<TeamRole, string> = { principal: 'Principal in Charge', 'project-manager': 'Project Manager', designer: 'Designer' }

export const COLUMNS = ['project', 'person', 'role', 'former staff', 'note'] as const

const ROLE_NAMES: Record<string, TeamRole> = {
  'principal in charge': 'principal',
  principal: 'principal',
  pic: 'principal',
  'project manager': 'project-manager',
  pm: 'project-manager',
  designer: 'designer',
}

export const parseRole = (value: string): TeamRole | undefined =>
  ROLE_NAMES[value.trim().toLowerCase().replace(/\s+/g, ' ')]

export const parseYes = (value: string): boolean => /^(y|yes|true|x|1)$/i.test(value.trim())

/**
 * A project as marketing may paste it: a slug, a new-site address (/projects/<slug>) or an old
 * Squarespace address (matched against the project's old addresses).
 */
export type ProjectRef = { slug: string } | { legacyPath: string }

export function parseProjectRef(value: string): ProjectRef | undefined {
  const raw = value.trim()
  if (!raw) return undefined
  let pathname = raw
  if (/^https?:\/\//i.test(raw)) {
    try {
      pathname = new URL(raw).pathname
    } catch {
      return undefined
    }
  }
  pathname = pathname.replace(/\/+$/, '')
  const onNewSite = pathname.match(/^\/projects\/([^/]+)$/)
  if (onNewSite) return { slug: decodeURIComponent(onNewSite[1]) }
  if (pathname.startsWith('/')) return { legacyPath: pathname.toLowerCase() }
  return /^[a-z0-9-]+$/.test(pathname) ? { slug: pathname } : undefined
}

export type Credit = { person: string; role: TeamRole; former: boolean; line: number }
export type Problem = { line: number; message: string }

/** Rows grouped by project reference, in file order, with every problem found. */
export function planTeams(rows: string[][]): { teams: Map<string, Credit[]>; refs: Map<string, ProjectRef>; problems: Problem[] } {
  const problems: Problem[] = []
  const teams = new Map<string, Credit[]>()
  const refs = new Map<string, ProjectRef>()
  const [header, ...body] = rows
  const index = Object.fromEntries(COLUMNS.map((c) => [c, (header ?? []).findIndex((h) => h.trim().toLowerCase() === c)]))
  for (const required of ['project', 'person', 'role'] as const) {
    if (index[required] < 0) problems.push({ line: 1, message: `Missing the "${required}" column.` })
  }
  if (problems.length) return { teams, refs, problems }

  body.forEach((cells, i) => {
    const line = i + 2 // 1-based, after the header, as in a spreadsheet
    const get = (c: (typeof COLUMNS)[number]) => (index[c] >= 0 ? (cells[index[c]] ?? '').trim() : '')
    const ref = parseProjectRef(get('project'))
    const person = get('person').replace(/\s+/g, ' ')
    // A worksheet row nobody filled in (no person) is skipped; a project left blank keeps its team.
    if (!person) return
    const role = parseRole(get('role'))
    if (!ref) problems.push({ line, message: `Project "${get('project')}" is not a slug or a project address.` })
    if (!role) problems.push({ line, message: `Role "${get('role')}" is not Principal in Charge, Project Manager or Designer.` })
    if (!ref || !role) return
    const key = 'slug' in ref ? `slug:${ref.slug}` : `path:${ref.legacyPath}`
    refs.set(key, ref)
    const team = teams.get(key) ?? []
    if (!team.some((c) => c.person.toLowerCase() === person.toLowerCase() && c.role === role)) {
      team.push({ person, role, former: parseYes(get('former staff')), line })
    }
    teams.set(key, team)
  })
  return { teams, refs, problems }
}

/** Principal first, then project manager, then designers, keeping file order within a role. */
export const sortTeam = <T extends { role: TeamRole }>(team: T[]): T[] =>
  [...team].sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role))

// ── against the database ─────────────────────────────────────────────────────

const similarity = (a: string, b: string) => {
  // Levenshtein ratio, as in scripts/migrate/lib (kept here so the site does not import scripts).
  const row = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]
    row[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j]
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = tmp
    }
  }
  return 1 - row[b.length] / Math.max(a.length, b.length, 1)
}

const describeRef = (ref: ProjectRef) => ('slug' in ref ? ref.slug : ref.legacyPath)

/** Excel and Google Sheets save commas; Numbers and some copies use tabs. */
export const readSheet = (text: string) => {
  const first = text.replace(/^\uFEFF/, '').split(/\r?\n/, 1)[0] ?? ''
  return parseCsv(text, first.includes('\t') && !first.includes(',') ? '\t' : ',')
}

export type TeamPlan = {
  projects: { id: number; name: string; team: Credit[] }[]
  newPeople: Credit[]
  problems: Problem[]
  warnings: Problem[]
}

/**
 * Checks a filled-in sheet against the admin, changing nothing. Every problem is listed with
 * its line; any problem means nothing should be saved. Names are never guessed: one close to
 * an existing person's stops the import so a person decides.
 */
export async function checkTeamCredits(payload: Payload, text: string, { createPeople = false } = {}): Promise<TeamPlan> {
  const { teams, refs, problems } = planTeams(readSheet(text))
  const warnings: Problem[] = []
  const everyone = await payload.find({ collection: 'people', draft: true, pagination: false, depth: 0, select: { name: true, showOnSite: true, isCurrent: true } })
  const byName = new Map(everyone.docs.map((p) => [normalizeName(p.name), p]))
  const newPeople = new Map<string, Credit>()

  for (const credit of [...teams.values()].flat()) {
    const key = normalizeName(credit.person)
    const person = byName.get(key)
    if (person) {
      if (!person.showOnSite)
        problems.push({ line: credit.line, message: `${person.name} has "Show on site" off. Turn it on in the admin (with their OK) or remove the row.` })
      if (credit.former && person.isCurrent)
        warnings.push({ line: credit.line, message: `${person.name} is marked former staff here but current in the admin. The admin wins.` })
      continue
    }
    if (newPeople.has(key)) continue
    const near = everyone.docs.find((p) => similarity(normalizeName(p.name), key) >= 0.8)
    if (near) problems.push({ line: credit.line, message: `"${credit.person}" is close to "${near.name}". Fix the sheet or the admin; names are not guessed.` })
    else if (!createPeople) problems.push({ line: credit.line, message: `"${credit.person}" is not in the admin. Add them under People, or choose to add new people.` })
    else newPeople.set(key, credit)
  }

  // Projects, by slug or old address; rows naming one project two ways make one team.
  const projects = new Map<number, { id: number; name: string; team: Credit[] }>()
  for (const [key, ref] of refs) {
    const where: Where = 'slug' in ref ? { slug: { equals: ref.slug } } : { 'legacyUrls.path': { equals: ref.legacyPath } }
    const found = await payload.find({ collection: 'projects', where, draft: true, limit: 2, depth: 0, select: { name: true } })
    const rows = teams.get(key) ?? []
    if (found.docs.length !== 1) {
      problems.push({ line: rows[0]?.line ?? 0, message: `No single project matches "${describeRef(ref)}".` })
      continue
    }
    const doc = found.docs[0]
    const entry = projects.get(doc.id) ?? { id: doc.id, name: doc.name, team: [] }
    for (const c of rows) if (!entry.team.some((o) => normalizeName(o.person) === normalizeName(c.person) && o.role === c.role)) entry.team.push(c)
    projects.set(doc.id, entry)
  }
  return {
    projects: [...projects.values()].map((p) => ({ ...p, team: sortTeam(p.team) })),
    newPeople: [...newPeople.values()],
    problems: problems.sort((a, b) => a.line - b.line),
    warnings,
  }
}

/**
 * Saves a checked plan: each project's TDA team becomes exactly its rows, as a draft (the live
 * site changes when someone publishes it). New people are drafts too. Refuses a plan with problems.
 */
export async function saveTeamCredits(payload: Payload, plan: TeamPlan) {
  if (plan.problems.length) throw new Error('The sheet has problems; nothing was saved.')
  const people = await payload.find({ collection: 'people', draft: true, pagination: false, depth: 0, select: { name: true } })
  const byName = new Map(people.docs.map((p) => [normalizeName(p.name), p.id]))
  for (const credit of plan.newPeople) {
    // Being listed in the sheet is marketing's decision to name the person; the draft still
    // needs publishing before the name appears anywhere.
    const created = await payload.create({ collection: 'people', data: { name: credit.person, showOnSite: true, isCurrent: !credit.former }, draft: true })
    byName.set(normalizeName(credit.person), created.id)
  }
  for (const p of plan.projects) {
    await payload.update({
      collection: 'projects',
      id: p.id,
      data: { team: p.team.map((c) => ({ person: byName.get(normalizeName(c.person))!, role: c.role })) },
      draft: true,
    })
  }
  return { projects: plan.projects.length, people: plan.newPeople.length }
}

// ── the worksheet ────────────────────────────────────────────────────────────

export const WORKSHEET_COLUMNS = ['project', 'website name', 'year', 'live', 'person', 'role', 'former staff', 'note']
const BLANK_ROLES = ['principal', 'project-manager', 'designer', 'designer'] as const

/**
 * Every project (live ones first, A to Z) with its team, or empty rows for Principal in Charge,
 * Project Manager and two Designers; plus everyone in the admin, to copy names from exactly.
 */
export async function buildWorksheet(payload: Payload) {
  const projects = (
    await payload.find({ collection: 'projects', draft: true, pagination: false, depth: 1, select: { name: true, slug: true, year: true, team: true, _status: true } })
  ).docs as Project[]
  projects.sort((a, b) => Number(b._status === 'published') - Number(a._status === 'published') || a.name.localeCompare(b.name))
  const rows: Record<string, unknown>[] = []
  for (const p of projects) {
    const base = { project: p.slug, 'website name': p.name, year: p.year ?? '', live: p._status === 'published' ? 'yes' : 'no' }
    const team = sortTeam(
      (p.team ?? [])
        .map((t) => ({ role: t.role, person: typeof t.person === 'object' ? (t.person as Person) : undefined }))
        .filter((t): t is { role: TeamRole; person: Person } => Boolean(t.person)),
    )
    const lines = team.length
      ? [...team.map((t) => ({ person: t.person.name, role: ROLE_LABELS[t.role], 'former staff': t.person.isCurrent === false ? 'yes' : '' })), { person: '', role: ROLE_LABELS.designer, 'former staff': '' }]
      : BLANK_ROLES.map((role) => ({ person: '', role: ROLE_LABELS[role], 'former staff': '' }))
    for (const line of lines) rows.push({ ...base, ...line, note: '' })
  }
  const people = (
    await payload.find({ collection: 'people', draft: true, pagination: false, depth: 0, sort: ['group', 'order', 'name'], select: { name: true, title: true, isCurrent: true } })
  ).docs as Person[]
  const names = people.map((p) => ({ name: p.name, title: p.title ?? '', 'current staff': p.isCurrent === false ? 'no' : 'yes' }))
  return { rows, names, projects: projects.length }
}

export const worksheetCsv = (rows: Record<string, unknown>[]) => toCsv(rows, WORKSHEET_COLUMNS)
