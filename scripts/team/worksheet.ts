/**
 * A worksheet for marketing to fill in TDA's team credits, built from the projects and people
 * already on the site. Read-only: changes nothing in the database.
 *
 *   pnpm team:worksheet
 *
 * Writes two files in scripts/team/out/:
 *   team-worksheet.csv   one block of rows per project: its address, name and year, then a row
 *                        each for Principal in Charge, Project Manager and two Designers. Fill in
 *                        the person; add rows for more designers; leave unused rows empty.
 *   team-names.csv       everyone in the admin, with their title, to copy names from exactly.
 *
 * Projects that already have a team show it, so the worksheet can be re-made and corrected.
 * The filled-in worksheet goes straight into `pnpm team:import`: rows with no person are
 * skipped, and a project left blank keeps the team it has.
 */
import '../env'

import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

import { getPayload, type Payload } from 'payload'

import config from '../../src/payload.config'
import type { Person, Project } from '../../src/payload-types'
import { csv } from '../migrate/lib'

import { ROLE_LABELS, sortTeam } from './lib'

export const OUT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'out')
export const WORKSHEET_COLUMNS = ['project', 'website name', 'year', 'live', 'person', 'role', 'former staff', 'note']
const BLANK_ROLES = ['principal', 'project-manager', 'designer', 'designer'] as const

export async function buildWorksheet(payload: Payload) {
  const projects = (
    await payload.find({
      collection: 'projects',
      draft: true,
      pagination: false,
      depth: 1,
      select: { name: true, slug: true, year: true, team: true, _status: true },
    })
  ).docs as Project[]
  // Live projects first, then drafts; A to Z within each.
  projects.sort((a, b) => Number(b._status === 'published') - Number(a._status === 'published') || a.name.localeCompare(b.name))

  const rows: Record<string, unknown>[] = []
  for (const p of projects) {
    const base = { project: p.slug, 'website name': p.name, year: p.year ?? '', live: p._status === 'published' ? 'yes' : 'no' }
    const team = sortTeam(
      (p.team ?? [])
        .map((t) => ({ role: t.role, person: typeof t.person === 'object' ? (t.person as Person) : undefined }))
        .filter((t): t is { role: (typeof t)['role']; person: Person } => Boolean(t.person)),
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

async function main() {
  const payload = await getPayload({ config })
  const { rows, names, projects } = await buildWorksheet(payload)
  await mkdir(OUT_DIR, { recursive: true })
  const worksheet = path.join(OUT_DIR, 'team-worksheet.csv')
  const people = path.join(OUT_DIR, 'team-names.csv')
  await writeFile(worksheet, csv(rows, WORKSHEET_COLUMNS))
  await writeFile(people, csv(names, ['name', 'title', 'current staff']))
  console.log(`${projects} projects, ${rows.length} rows: ${path.relative(process.cwd(), worksheet)}`)
  console.log(`${names.length} people to copy names from: ${path.relative(process.cwd(), people)}`)
  console.log('Fill in the person column, save as CSV, then: pnpm team:import scripts/team/out/team-worksheet.csv')
  process.exit(0)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
