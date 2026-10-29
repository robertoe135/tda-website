/**
 * Checks every project's credits against the old site's pages, and changes nothing:
 *
 *   pnpm migrate:audit-credits    # any database: it only reads
 *
 * For each project the old credits pages describe (pnpm migrate:extract), both the live version
 * and the latest draft are compared field by field: architects and credited firms,
 * photographers, owner, location, year, area, LEED/WELL and awards. Names are compared allowing
 * for spelling (a firm's other names count, and "Foster + Partner" matches "Foster + Partners").
 *
 * Prints a summary and writes every difference to
 * scripts/migrate/cache/credits-audit.csv (gitignored: it names owners of confidential projects).
 * A difference is not always a mistake: marketing may have corrected a name or a credit on
 * purpose. Missing credits can be put back with migrate:restore-credits and
 * migrate:photographers.
 */
import '../env'

import { readFile, writeFile } from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

import { getPayload, type Payload } from 'payload'

import config from '../../src/payload.config'
import { normalizeName } from '../../src/hooks/preventNearDuplicates'
import { projectPhotographers } from '../../src/lib/projects'
import type { Award, Client, Firm, Location, Project } from '../../src/payload-types'
import type { ProjectRecord } from './extract'
import { labelFirmSplitter, parseArea, parseCertifications, planFirmCredits } from './import'
import { cacheDir, csv, similarity, SITE, splitCredit } from './lib'
import { sameFirm } from './restore-credits'

export type AuditRow = { project: string; version: 'live' | 'draft'; field: string; oldSite: string; newSite: string; note: string }

const isObject = <T>(v: unknown): v is T => typeof v === 'object' && v !== null
const firmNames = (f: unknown) => (isObject<Firm>(f) ? [f.name, ...(f.aliases ?? []).map((a) => a.name)] : [])
const samePerson = (a: string, b: string) => {
  const [x, y] = [normalizeName(a), normalizeName(b)]
  return x === y || similarity(x, y) >= 0.88
}

/** The differences between one project's old pages and one version of it. */
export function compareProject(p: ProjectRecord, v: Project, version: 'live' | 'draft', split: (s: string) => string[] = (s) => [s]): AuditRow[] {
  const rows: AuditRow[] = []
  const add = (field: string, oldSite: string, newSite: string, note: string) => rows.push({ project: v.name, version, field, oldSite, newSite, note })
  const c = p.credits

  // Firms: architects and every credited firm, under any of their names.
  const firms = [...(v.architects ?? []), ...(v.credits ?? []).flatMap((r) => r.firms)].filter(isObject<Firm>)
  const onProject = firms.flatMap(firmNames)
  const has = (name: string) => onProject.some((n) => sameFirm(n, name))
  const plan = planFirmCredits(p, split)
  for (const [role, name] of [...plan.architects.map((a) => ['Architect', a]), ...plan.credits.flatMap((r) => r.values.map((x) => [r.roleName, x]))]) {
    if (parseCertifications(name)?.length || /^(LEED|WELL)\b/i.test(name)) continue // a certification, reported below
    if (has(name)) continue
    // "A / B", "A/B" or "A, B": several firms, each of which may be credited. A one-sided
    // slash ("Weiss/ Manfredi") is a firm's own name.
    const parts = name.split(/,\s+(?=[A-Z])/).flatMap((part) => {
      const bare = part.replace(/\s*\([^)]*\)\s*$/, '').trim()
      return has(part) || has(bare) ? [] : bare.split(/\s+\/\s+|(?<=\S)\/(?=\S)/).map((x) => x.trim())
    })
    const missing = parts.filter((part) => !has(part))
    if (missing.length) add(`firm (${role})`, missing.join(' | '), '', missing.length === 1 && missing[0] === name ? 'On the old page, not on the project.' : `Part of "${name}"; not on the project.`)
  }
  for (const f of firms) {
    if (/^(LEED|WELL)\b/i.test(f.name)) add('firm record', f.name, f.name, 'A certification stored as a firm credit; enter it under LEED/WELL and remove the credit.')
    else if (/\s\/\s/.test(f.name)) add('firm record', f.name, f.name, 'May name several firms in one record; if so, split it into one record per firm.')
  }

  // Photographers: as the project page credits them (project, then each photo).
  const credited = projectPhotographers(v)
  const old = (c?.photography ?? []).flatMap(splitCredit)
  for (const name of old) if (!credited.some((n) => samePerson(n, name))) add('photographer', name, credited.join(', '), 'On the old page, not credited on the project.')
  if (old.length) for (const name of credited) if (!old.some((n) => samePerson(n, name))) add('photographer', old.join(', '), name, 'Credited on the project, not on the old page.')

  // Owner (kept even when the project is confidential: the page hides it, the record has it).
  const owners = (v.clients ?? []).flatMap((f) => (isObject<Client>(f) ? [f.name] : []))
  if (c?.owner && !owners.some((n) => sameFirm(n, c.owner!)))
    add('owner', c.owner, owners.join(', '), 'Owner on the old page is not the project’s client.')

  // Location, as "City, ST" (or "City, Country").
  const loc = p.location ?? c?.location
  const location = isObject<Location>(v.location) ? v.location.displayName ?? '' : ''
  if (loc?.city) {
    const display = [loc.city, loc.region || loc.country].join(', ')
    if (normalizeName(display) !== normalizeName(location)) add('location', loc.asWritten, location, 'Different place.')
  }

  // Facts.
  if (c?.completed && String(v.year ?? '') !== c.completed.trim()) add('year', c.completed, String(v.year ?? ''), /^\d{4}$/.test(c.completed.trim()) ? 'Different year.' : 'Not a single year on the old page; enter by hand.')
  if (c?.area) {
    const area = parseArea(c.area)
    if (!area) {
      if (!v.areaSqFt && !v.areaNote) add('area', c.area, '', 'Not in "N SF" form on the old page; enter by hand.')
    } else if (area.areaSqFt !== v.areaSqFt) add('area', c.area, String(v.areaSqFt ?? ''), 'Different area.')
  }
  if (c?.sustainabilityStatus) {
    const want = parseCertifications(c.sustainabilityStatus)
    const have = (v.certifications ?? []).map((x) => `${x.system} ${x.level}`).join(', ')
    if (!want) {
      if (!have) add('LEED/WELL', c.sustainabilityStatus, '', 'Not a plain "LEED Gold" style value; enter by hand if it should show.')
    } else if (want.map((x) => `${x.system} ${x.level}`).join(', ') !== have) add('LEED/WELL', c.sustainabilityStatus, have, 'Different certification.')
  }
  return rows
}

/** Awards are their own records (not versioned): compared once per project, by count and year. */
export function compareAwards(p: ProjectRecord, project: string, awards: Pick<Award, 'name' | 'year'>[]): AuditRow[] {
  const old = p.credits?.awards ?? []
  const years = (list: { year?: number | null }[]) => list.map((a) => a.year ?? 0).sort().join(', ')
  if (old.length === awards.length && years(old) === years(awards)) return []
  return [{ project, version: 'live', field: 'awards', oldSite: `${old.length} (${years(old)})`, newSite: `${awards.length} (${years(awards)})`, note: 'Different awards.' }]
}

export async function auditCredits(payload: Payload, projects: ProjectRecord[], firms: { key: string }[]) {
  const split = labelFirmSplitter(new Set(firms.map((f) => f.key)))
  const rows: AuditRow[] = []
  let checked = 0
  for (const p of projects) {
    if (!p.legacyPaths[0] || (!p.credits && !p.labelFirms.length)) continue
    const found = await payload.find({ collection: 'projects', where: { 'legacyUrls.path': { equals: p.legacyPaths[0] } }, limit: 1, draft: true, depth: 2 })
    const latest = found.docs[0] as Project | undefined
    if (!latest) {
      rows.push({ project: p.name, version: 'draft', field: 'project', oldSite: p.legacyPaths[0], newSite: '', note: 'Not on the new site.' })
      continue
    }
    checked++
    const live = latest._status === 'published' ? latest : ((await payload.findByID({ collection: 'projects', id: latest.id, depth: 2 }).catch(() => undefined)) as Project | undefined)
    if (live?._status === 'published') rows.push(...compareProject(p, live, 'live', split))
    if (latest !== live) rows.push(...compareProject(p, latest, 'draft', split))
    const awards = await payload.find({ collection: 'awards', where: { project: { equals: latest.id } }, pagination: false, depth: 0 })
    rows.push(...compareAwards(p, latest.name, awards.docs))
  }
  return { rows, checked }
}

async function main() {
  const dir = path.join(cacheDir, new URL(SITE).host, 'extracted')
  const read = async <T>(file: string) => JSON.parse(await readFile(path.join(dir, file), 'utf8')) as T
  const payload = await getPayload({ config })
  const { rows, checked } = await auditCredits(payload, await read<ProjectRecord[]>('projects.json'), await read('firms.json'))
  const out = path.join(cacheDir, 'credits-audit.csv')
  await writeFile(out, csv(rows, ['project', 'version', 'field', 'oldSite', 'newSite', 'note']))
  const byField = new Map<string, number>()
  for (const r of rows) byField.set(`${r.field.replace(/ \(.*/, '')} (${r.version})`, (byField.get(`${r.field.replace(/ \(.*/, '')} (${r.version})`) ?? 0) + 1)
  console.log(`${checked} projects checked against the old site; ${rows.length} difference(s).`)
  for (const [k, n] of [...byField].sort()) console.log(`  ${k}: ${n}`)
  console.log(`Every difference: ${path.relative(process.cwd(), out)}`)
  process.exit(0)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
