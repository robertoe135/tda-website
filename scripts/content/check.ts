/**
 * What is left to finish before the site reads as complete, read-only:
 *
 *   pnpm content:check
 *
 * Writes scripts/content/out/content-review.csv (one row per gap: what, where, how to fix,
 * and a link into the admin) and prints a summary. Covers:
 * - projects: photos, photographer credit, category, completion year, location, architect,
 *   write-up, and photos uploaded to a draft but not yet live;
 * - names that may be one project entered twice;
 * - people on the team page without a headshot, title or bio;
 * - homepage tiles hidden because their project is not published.
 *
 * Changes nothing. The output folder is not committed: draft names can include private clients.
 */
import '../env'

import { mkdir, writeFile } from 'fs/promises'
import path from 'path'

import { getPayload } from 'payload'

import config from '../../src/payload.config'
import { dbHost } from '../media/upload'
import { personIssues, possibleDuplicates, projectIssues, type ProjectRecord } from './lib'

const OUT = path.join(path.dirname(new URL(import.meta.url).pathname), 'out', 'content-review.csv')
const SITE = (process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3000').replace(/\/$/, '')

type Row = { area: string; name: string; live: string; issue: string; detail: string; admin: string }
const csv = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value)

async function main() {
  const payload = await getPayload({ config })
  const fields = {
    name: true, status: true, announceApproved: true, year: true, location: true, typologies: true, architects: true,
    description: true, heroImage: true, gallery: true, photographers: true, _status: true,
  } as const
  const [drafts, published] = await Promise.all([
    payload.find({ collection: 'projects', draft: true, pagination: false, depth: 0, select: fields }),
    payload.find({ collection: 'projects', pagination: false, depth: 0, where: { _status: { equals: 'published' } }, select: fields }),
  ])
  const live = new Map(published.docs.map((p) => [p.id, p as unknown as ProjectRecord]))
  const projectLink = (id: number) => `${SITE}/admin/collections/projects/${id}`

  const rows: Row[] = []
  for (const p of drafts.docs) {
    for (const { issue, detail } of projectIssues(p as unknown as ProjectRecord, live.get(p.id))) {
      rows.push({ area: 'Project', name: p.name, live: live.has(p.id) ? 'yes' : 'no', issue, detail, admin: projectLink(p.id) })
    }
  }

  for (const { a, b, reason } of possibleDuplicates(drafts.docs)) {
    rows.push({
      area: 'Possible duplicate',
      name: `${a.name}  /  ${b.name}`,
      live: [a, b].map((p) => (live.has(p.id) ? 'yes' : 'no')).join(' / '),
      issue: reason,
      detail: 'If they are one project, keep one and move photos, press and old addresses to it (pnpm migrate:drop-in-progress handles in-progress copies).',
      admin: `${projectLink(a.id)}  ${projectLink(b.id)}`,
    })
  }

  const people = await payload.find({
    collection: 'people',
    pagination: false,
    depth: 0,
    where: { and: [{ showOnSite: { equals: true } }, { isCurrent: { equals: true } }] },
    select: { name: true, title: true, headshot: true, bio: true },
  })
  for (const person of people.docs) {
    for (const { issue, detail } of personIssues(person)) {
      rows.push({ area: 'Person', name: person.name, live: 'yes', issue, detail, admin: `${SITE}/admin/collections/people/${person.id}` })
    }
  }

  const home = await payload.findGlobal({ slug: 'home', depth: 0 })
  for (const [r, row] of (home.rows ?? []).entries()) {
    for (const item of row.items ?? []) {
      if (item.blockType !== 'project') continue
      const id = typeof item.project === 'object' ? item.project.id : item.project
      if (live.has(id)) continue
      const name = drafts.docs.find((p) => p.id === id)?.name ?? `project ${id}`
      rows.push({ area: 'Homepage', name, live: 'no', issue: 'Tile hidden', detail: `Row ${r + 1}: the project is not published, so the row shows without it.`, admin: `${SITE}/admin/globals/home` })
    }
  }

  await mkdir(path.dirname(OUT), { recursive: true })
  const header = ['Area', 'Name', 'Live', 'Issue', 'Detail', 'Admin']
  const body = rows.map((r) => [r.area, r.name, r.live, r.issue, r.detail, r.admin].map(csv).join(','))
  await writeFile(OUT, [header.join(','), ...body].join('\n') + '\n')

  const count = new Map<string, number>()
  for (const r of rows) count.set(`${r.area}: ${r.issue}`, (count.get(`${r.area}: ${r.issue}`) ?? 0) + 1)
  console.log(`Database server: ${dbHost()}`)
  console.log(`Projects: ${drafts.docs.length} (${published.docs.length} live). People on the team page: ${people.docs.length}.`)
  console.log(`\n${rows.length} things to finish:`)
  for (const [k, n] of [...count].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${k}`)
  console.log(`\nFull list: ${path.relative(process.cwd(), OUT)}`)
  process.exit(0)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
