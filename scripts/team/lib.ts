/**
 * Pure helpers for the team-credits import (no database): reading the CSV, recognizing roles
 * and project references, and grouping rows into one team per project.
 */

export type TeamRole = 'principal' | 'project-manager' | 'designer'
export const ROLE_ORDER: TeamRole[] = ['principal', 'project-manager', 'designer']

export const COLUMNS = ['project', 'person', 'role', 'former staff', 'note'] as const

/** RFC 4180 CSV: quoted fields, doubled quotes, commas and line breaks inside quotes, CRLF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  const src = text.replace(/^﻿/, '') // Excel's byte-order mark
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        field += '"'
        i++
      } else if (c === '"') quoted = false
      else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += c
  }
  if (field || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => r.some((cell) => cell.trim()))
}

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
    const role = parseRole(get('role'))
    if (!ref) problems.push({ line, message: `Project "${get('project')}" is not a slug or a project address.` })
    if (!person) problems.push({ line, message: 'Person is empty.' })
    if (!role) problems.push({ line, message: `Role "${get('role')}" is not Principal in Charge, Project Manager or Designer.` })
    if (!ref || !person || !role) return
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
