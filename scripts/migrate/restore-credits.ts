/**
 * Puts back credits the old site's pages had and the new site lost: firms, photographers,
 * awards, and the year, area and old addresses where the project has none:
 *
 *   pnpm migrate:restore-credits                                   # list what is missing, change nothing
 *   pnpm migrate:restore-credits --write                           # add it (local database)
 *   pnpm migrate:restore-credits --write --confirm-backup          # add it to another database, after a backup
 *
 * Credits were lost three ways: credit labels the import did not know (MoMA's "Vertical
 * Transportation", "Millwork"…), architects a credits page names but the label line leaves out,
 * and firm merges that moved a project's draft but not its published version, so the published
 * version silently lost the firm when the merged record was deleted (merge-firms.ts, versions.ts).
 *
 * Reads the extracted old pages (pnpm migrate:extract) and, for each project, adds only firms that
 * are on neither its architects nor its credits. Nothing is removed or renamed. A firm that an
 * earlier version of the project had and its latest draft no longer has was taken off by a
 * person, so it is left off. Both the live (published) version and the latest draft are fixed,
 * and a pending draft stays unpublished.
 */
import '../env'

import { readFile } from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

import { getPayload, type Payload } from 'payload'

import config from '../../src/payload.config'
import { normalizeName } from '../../src/hooks/preventNearDuplicates'
import type { Project } from '../../src/payload-types'
import type { ProjectRecord } from './extract'
import { finder, firmFinder, labelFirmSplitter, looksJoined, parseArea, planFirmCredits } from './import'
import { ARCHITECT_ROLES } from './credit-labels'
import { sameFirm } from '../../src/lib/firm-names'
import { cacheDir, similarity, SITE, splitCredit } from './lib'
import { changeProject } from './versions'

type Ref = number | { id: number } | null | undefined
const idOf = (r: Ref) => (r && typeof r === 'object' ? r.id : r)
const ids = (refs: Ref[] | null | undefined) => (refs ?? []).map(idOf).filter((id): id is number => typeof id === 'number')
const isObject = <T>(v: unknown): v is T => typeof v === 'object' && v !== null
const samePerson = (a: string, b: string) => normalizeName(a) === normalizeName(b) || similarity(normalizeName(a), normalizeName(b)) >= 0.88
const firmsOn = (p: Pick<Project, 'architects' | 'credits'>) => new Set([...ids(p.architects as Ref[]), ...(p.credits ?? []).flatMap((c) => ids(c.firms as Ref[]))])

// Two spellings of one firm: in src/lib/firm-names, shared with the admin's merge tool.
export { sameFirm }

export type RestoreRow = { project: string; projectId: number; role: string; firm: string; where: string }

export async function restoreCredits(
  payload: Payload,
  projects: ProjectRecord[],
  firms: { key: string; preferred?: string }[],
  write: boolean,
): Promise<{ rows: RestoreRow[]; skipped: RestoreRow[] }> {
  const preferred = new Map(firms.filter((f) => f.preferred).map((f) => [f.key, f.preferred!]))
  const split = labelFirmSplitter(new Set(firms.map((f) => f.key)))
  const findOrCreate = finder(payload)
  const findFirm = firmFinder(payload)
  const nameOf = (name: string) => preferred.get(normalizeName(name)) ?? name
  const rows: RestoreRow[] = []
  const skipped: RestoreRow[] = []

  for (const p of projects) {
    if (!p.legacyPaths[0]) continue
    const found = await payload.find({ collection: 'projects', where: { 'legacyUrls.path': { equals: p.legacyPaths[0] } }, limit: 1, draft: true, depth: 0 })
    const doc = found.docs[0] as Project | undefined
    if (!doc) continue
    const plan = planFirmCredits(p, split)

    // Firms a person took off: on an earlier version, not on the latest draft.
    const versions = await payload.findVersions({ collection: 'projects', where: { parent: { equals: doc.id } }, pagination: false, depth: 0 })
    const ever = new Set(versions.docs.flatMap((v) => [...firmsOn(v.version as Project)]))
    const latest = firmsOn(doc)
    const removed = (id: number) => ever.has(id) && !latest.has(id)

    // Every name the project's firms go by, to spot one already credited under another spelling
    // ("REX" for REX Architecture): those are not added again.
    const onProject = (
      await payload.find({ collection: 'firms', where: { id: { in: [...new Set([...ever, ...latest])] } }, pagination: false, depth: 0, select: { name: true, aliases: true } })
    ).docs.map((f) => ({ id: f.id, name: f.name, names: [f.name, ...(f.aliases ?? []).map((a) => a.name)] }))
    const creditedAs = (name: string, id: number | undefined) => {
      if (id !== undefined && (ever.has(id) || latest.has(id))) return undefined // the same firm: handled below
      return onProject.find((f) => f.id !== id && f.names.some((m) => sameFirm(m, nameOf(name))))?.name
    }

    // Architects (and architect credits) are added only when the site already knows a firm by
    // exactly that name: another spelling may be a firm already on the project. Other credits
    // make a new firm when there is none, as the import does.
    const wanted: { role?: string; order?: number; firm: string; id: number }[] = []
    let next = -1
    const consider = async (name: string, role?: { roleName: string; order: number; architect: boolean }) => {
      const label = role?.roleName ?? 'Architect'
      const known = await findFirm(nameOf(name))
      if (looksJoined(name) && !known) {
        // "A / B": fine when each firm is already on the project.
        const parts = name.split(/\s*\/\s*/).filter(Boolean)
        if (parts.length > 1 && parts.every((part) => onProject.some((f) => f.names.some((m) => sameFirm(m, part))))) return
        skipped.push({ project: doc.name, projectId: doc.id, role: label, firm: name, where: 'several firms in one line: add by hand' })
        return
      }
      const similar = creditedAs(name, known)
      if (similar) {
        if (normalizeName(similar) !== normalizeName(nameOf(name)))
          skipped.push({ project: doc.name, projectId: doc.id, role: label, firm: name, where: `probably already credited as "${similar}"` })
        return
      }
      if (!known && (!role || role.architect)) {
        skipped.push({ project: doc.name, projectId: doc.id, role: label, firm: name, where: 'no firm on the site by this name: check the spelling, then add by hand' })
        return
      }
      if (wanted.some((w) => w.id === known)) return
      wanted.push({ role: role?.roleName, order: role?.order, firm: name, id: known ?? (write ? await findOrCreate('firms', nameOf(name)) : next--) })
    }
    for (const name of plan.architects) await consider(name)
    for (const row of plan.credits)
      for (const name of row.values) await consider(name, { roleName: row.roleName, order: row.order, architect: ARCHITECT_ROLES.has(row.role) })

    // Photographers the old page credits, by name (already credited on the project or on one of
    // its photos counts), and the facts it gives that the project leaves empty.
    const photoIdsOf = (v: Project) => ids(v.photographers as Ref[])
    const everPhotos = new Set(versions.docs.flatMap((v) => photoIdsOf(v.version as Project)))
    const latestPhotos = new Set(photoIdsOf(doc))
    const photoNames = new Map(
      (await payload.find({ collection: 'photographers', where: { id: { in: [...new Set([...everPhotos, ...latestPhotos])] } }, pagination: false, depth: 0, select: { name: true } })).docs.map((x) => [x.id, x.name]),
    )
    const imageCredits = async (v: Project) => {
      const mediaIds = ids([v.heroImage, ...(v.gallery ?? []).map((g) => g.image)] as Ref[])
      if (!mediaIds.length) return []
      const media = await payload.find({ collection: 'media', where: { id: { in: mediaIds } }, pagination: false, depth: 1, select: { photographer: true, credit: true } })
      return media.docs.flatMap((m) => (isObject<{ name: string }>(m.photographer) ? [m.photographer.name] : m.credit ? [m.credit] : []))
    }
    const findPhotographer = async (name: string) =>
      (await payload.find({ collection: 'photographers', where: { normalizedName: { equals: normalizeName(name) } }, limit: 1, depth: 0 })).docs[0]?.id
    const oldPhotographers = (p.credits?.photography ?? []).flatMap(splitCredit)
    const year = p.credits?.completed && /^\d{4}$/.test(p.credits.completed.trim()) ? Number(p.credits.completed.trim()) : undefined
    const area = parseArea(p.credits?.area)
    // Old addresses (the stats page) for redirects, unless another project already has one.
    const paths: string[] = []
    for (const path of p.legacyPaths) {
      const owner = await payload.find({ collection: 'projects', where: { 'legacyUrls.path': { equals: path } }, limit: 1, draft: true, depth: 0 })
      if (!owner.docs[0] || owner.docs[0].id === doc.id) paths.push(path)
    }

    const roleIds = new Map<string, number>()
    const roleId = async (name: string, order: number) => {
      if (!roleIds.has(name)) roleIds.set(name, write ? await findOrCreate('creditRoles', name, { order }) : -roleIds.size - 1)
      return roleIds.get(name)!
    }
    type Added = { role?: string; firm: string }
    const added: Record<'live' | 'draft', Added[]> = { live: [], draft: [] }
    const fill = async (v: Project, which: 'live' | 'draft') => {
      const changes: Partial<Project> = {}
      const note = (a: Added) => added[which].push(a)

      const have = firmsOn(v)
      const missing = wanted.filter((w) => !have.has(w.id) && !removed(w.id))
      if (missing.length) {
        changes.architects = [...ids(v.architects as Ref[]), ...missing.filter((m) => !m.role).map((m) => m.id)]
        const credits = (v.credits ?? []).map((c) => ({ ...c, role: idOf(c.role as Ref) as number, firms: ids(c.firms as Ref[]) }))
        for (const m of missing.filter((m) => m.role)) {
          const role = await roleId(m.role!, m.order ?? 50)
          const row = credits.find((c) => c.role === role)
          if (row) row.firms.push(m.id)
          else credits.push({ role, firms: [m.id] } as (typeof credits)[number])
        }
        changes.credits = credits as Project['credits']
        missing.forEach((m) => note({ role: m.role ?? 'Architect', firm: m.firm }))
      }

      const credited = [...photoIdsOf(v).map((id) => photoNames.get(id) ?? ''), ...(await imageCredits(v))]
      const photographers = photoIdsOf(v)
      for (const name of oldPhotographers) {
        if (credited.some((c) => samePerson(c, name))) continue
        const id = (await findPhotographer(name)) ?? (write ? (await payload.create({ collection: 'photographers', data: { name } })).id : next--)
        if ((everPhotos.has(id) && !latestPhotos.has(id)) || photographers.includes(id)) continue // taken off by a person
        photographers.push(id)
        note({ role: 'Photographer', firm: name })
      }
      if (photographers.length !== photoIdsOf(v).length) changes.photographers = photographers

      if (year && !v.year) {
        changes.year = year
        note({ role: 'Year', firm: String(year) })
      }
      if (area?.areaSqFt && !v.areaSqFt && !v.areaNote) {
        Object.assign(changes, area)
        note({ role: 'Area', firm: p.credits!.area! })
      }
      const known = new Set((v.legacyUrls ?? []).map((u) => u.path))
      const newPaths = paths.filter((x) => !known.has(x))
      if (newPaths.length) {
        changes.legacyUrls = [...(v.legacyUrls ?? []).map((u) => ({ path: u.path })), ...newPaths.map((x) => ({ path: x }))]
        newPaths.forEach((x) => note({ role: 'Old address', firm: x }))
      }
      return Object.keys(changes).length ? changes : undefined
    }

    if (write) await changeProject(payload, doc.id, (v) => fill(v, v._status === 'published' ? 'live' : 'draft'))
    else {
      // Same decisions without saving: the published version (if any) and the latest draft.
      const live = (await payload.findByID({ collection: 'projects', id: doc.id, depth: 0 }).catch(() => undefined)) as Project | undefined
      if (live?._status === 'published') await fill(live, 'live')
      if (doc._status !== 'published') await fill(doc, 'draft')
    }
    // Awards are their own records (shown on live and draft alike). One is added only when the
    // project has fewer awards for that year than the old page lists: an award a person renamed
    // or corrected still counts.
    const awards = (await payload.find({ collection: 'awards', where: { project: { equals: doc.id } }, pagination: false, depth: 0 })).docs
    const perYear = new Map<number, number>()
    for (const a of awards) perYear.set(a.year ?? 0, (perYear.get(a.year ?? 0) ?? 0) + 1)
    for (const a of p.credits?.awards ?? []) {
      const y = a.year ?? 0
      const left = perYear.get(y) ?? 0
      if (left > 0) {
        perYear.set(y, left - 1)
        continue
      }
      if (write) await payload.create({ collection: 'awards', data: { name: a.text, year: a.year, project: doc.id } })
      rows.push({ project: doc.name, projectId: doc.id, role: 'Award', firm: `${a.year ?? ''} ${a.text}`.trim(), where: 'live site and draft' })
    }
    for (const which of ['live', 'draft'] as const)
      for (const m of added[which]) rows.push({ project: doc.name, projectId: doc.id, role: m.role ?? 'Architect', firm: m.firm, where: which === 'live' ? 'live site' : 'draft' })
  }
  return { rows, skipped }
}

function assertLocalDatabase() {
  let host = ''
  try {
    host = new URL(process.env.DATABASE_URL ?? '').hostname
  } catch {}
  if (['localhost', '127.0.0.1', '::1'].includes(host) || process.argv.includes('--confirm-backup')) return
  console.error(`DATABASE_URL points at ${host || 'an unknown host'}, not this machine.`)
  console.error('Take a fresh backup of that database, then rerun with --confirm-backup.')
  process.exit(1)
}

async function main() {
  const write = process.argv.includes('--write')
  if (write) assertLocalDatabase()
  const dir = path.join(cacheDir, new URL(SITE).host, 'extracted')
  const read = async <T>(file: string) => JSON.parse(await readFile(path.join(dir, file), 'utf8')) as T
  const payload = await getPayload({ config })
  const { rows, skipped } = await restoreCredits(payload, await read<ProjectRecord[]>('projects.json'), await read('firms.json'), write)
  let last = ''
  for (const r of rows) {
    if (r.project !== last) console.log(`\n${r.project} (${r.projectId})`)
    last = r.project
    console.log(`  + ${r.role}: ${r.firm}  [${r.where}]`)
  }
  if (skipped.length) console.log('\nNot added, for a person to check:')
  for (const s of skipped) console.log(`  ${s.project}: ${s.role}: ${s.firm} (${s.where})`)
  const projects = new Set(rows.map((r) => r.projectId)).size
  console.log(`\n${rows.length} credit(s) on ${projects} project(s) ${write ? 'added' : 'would be added; rerun with --write'}.`)
  process.exit(0)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
