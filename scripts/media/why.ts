/**
 * Why projects have no photos, read-only:
 *
 *   pnpm media:why "/Volumes/T7/Website"
 *
 * The photo import reads only Photos/<Category>/<Project>/ and only takes folders whose name
 * matches a project closely. This looks everywhere under the Website folder (Archive, Projects
 * to Add, subfolders, NO RIGHTS folders too) and, for each project without photos, says where
 * its photos probably are and what stops them: outside Photos, in a subfolder, marked NO RIGHTS,
 * a folder name too different to match, only HEIC/PSD files, or matched but not imported yet.
 * Projects with no folder anywhere say whether the old site showed photos for them.
 *
 * Writes scripts/media/cache/why-no-photos.csv (not committed: folder names can name private
 * clients) and prints counts only. Changes nothing.
 */
import '../env'

import { existsSync } from 'fs'
import { readdir, readFile, writeFile, mkdir } from 'fs/promises'
import path from 'path'

import { getPayload } from 'payload'

import config from '../../src/payload.config'
import { csv } from '../migrate/lib'
import { parseCsv } from '../team/lib'

import { guessProject, type GuessCandidate } from './lib'
import { mediaDir, PHOTOS_CSV } from './scan'
import { folderName, folderPlace, NEEDS_EXPORT, possibleProjects, WEB_IMAGE } from './why-lib'

const OUT = path.join(mediaDir, 'cache', 'why-no-photos.csv')
// The Squarespace inventory (committed): how many photos each old page showed.
const URL_INVENTORY = path.join(mediaDir, '..', 'migrate', 'out', 'url-inventory.csv')
// Folder names that say nothing about the project: match on the folder above instead.
const GENERIC = /^(images?|photos?|pictures?|web|website|hi[\s-]?res|low[\s-]?res|jpe?gs?|selects?|selected|finals?|edited|retouched|tiffs?|print|originals?|exports?|\d+)$/i

type ImageFolder = { parts: string[]; web: number; other: number }

async function imageFolders(root: string, parts: string[] = []): Promise<ImageFolder[]> {
  let entries
  try {
    entries = await readdir(path.join(root, ...parts), { withFileTypes: true })
  } catch {
    return []
  }
  const files = entries.filter((e) => e.isFile() && !e.name.startsWith('.'))
  const web = files.filter((f) => WEB_IMAGE.test(f.name)).length
  const other = files.filter((f) => NEEDS_EXPORT.test(f.name)).length
  const here: ImageFolder[] = web || other ? [{ parts, web, other }] : []
  const below = await Promise.all(
    entries.filter((e) => e.isDirectory() && !e.name.startsWith('.')).map((e) => imageFolders(root, [...parts, e.name])),
  )
  return [...here, ...below.flat()]
}

/** How many photos each old page showed, by its path, from the Squarespace inventory. */
async function oldSiteCounts(): Promise<Map<string, number>> {
  const counts = new Map<string, number>()
  if (!existsSync(URL_INVENTORY)) return counts
  const [header, ...rows] = parseCsv(await readFile(URL_INVENTORY, 'utf8'))
  const at = (name: string) => header.indexOf(name)
  for (const row of rows) if (row[at('path')]) counts.set(row[at('path')], Number(row[at('images')]) || 0)
  return counts
}

async function main() {
  const given = process.argv.slice(2).find((a) => !a.startsWith('--'))
  if (!given) {
    console.error('Usage: pnpm media:why "/Volumes/T7/Website"')
    process.exit(1)
  }
  // Given the Photos folder itself, read the paths as if from the Website folder above it.
  const isPhotos = /^photos$/i.test(path.basename(given.replace(/[\\/]+$/, '')))
  const root = isPhotos ? path.dirname(given) : given
  const folders = (await imageFolders(root)).filter((f) => !isPhotos || /^photos$/i.test(f.parts[0] ?? ''))

  const payload = await getPayload({ config })
  const all = await payload.find({
    collection: 'projects',
    draft: true,
    pagination: false,
    depth: 1,
    select: { name: true, slug: true, heroImage: true, gallery: true, legacyUrls: true, typologies: true, photographers: true },
    populate: { typologies: { name: true } },
  })
  const live = new Set(
    (await payload.find({ collection: 'projects', pagination: false, depth: 0, where: { _status: { equals: 'published' } }, select: { name: true } })).docs.map((p) => p.id),
  )
  const candidates: GuessCandidate[] = all.docs.map((p) => ({
    slug: p.slug ?? String(p.id),
    name: p.name,
    categories: (p.typologies ?? []).flatMap((t) => (typeof t === 'object' && t ? [t.name] : [])),
  }))
  const missing = all.docs.filter((p) => !p.heroImage && !p.gallery?.length)

  // Each folder goes to the project its name points to most (among all projects, so a folder
  // for a project that already has photos is not handed to another one).
  type Found = ImageFolder & { score: number; sure: boolean; runnerUp?: string; place: ReturnType<typeof folderPlace> }
  const bySlug = new Map<string, Found[]>()
  for (const f of folders) {
    const named = [...f.parts].reverse().find((p) => !GENERIC.test(folderName(p)))
    if (!named) continue
    const category = /^photos$/i.test(f.parts[0] ?? '') ? (f.parts[1] ?? '') : ''
    const guess = guessProject(folderName(named), category, candidates)
    const place = folderPlace(f.parts, f.web, f.other)
    // A short folder name ("Bloomberg London") may still point at a project: listed as possible.
    const slugs = guess ? [guess.candidate.slug] : possibleProjects(folderName(named), candidates).map((c) => c.slug)
    for (const slug of slugs) {
      const found: Found = { ...f, score: guess?.score ?? 0.5, sure: Boolean(guess && (guess.exact || guess.accepted)), runnerUp: guess?.runnerUp?.name, place }
      bySlug.set(slug, [...(bySlug.get(slug) ?? []), found])
    }
  }

  const oldSite = await oldSiteCounts()
  // The last scan's plan, per <category>/<folder>: whether it was set to import, and where to.
  const plan = new Map<string, { include: boolean; slug: string }>()
  if (existsSync(PHOTOS_CSV)) {
    const [header, ...lines] = parseCsv(await readFile(PHOTOS_CSV, 'utf8'))
    const col = (name: string) => header.indexOf(name)
    for (const line of lines) {
      const key = `${line[col('category')]}/${line[col('folder')]}`
      const prev = plan.get(key)
      plan.set(key, { include: Boolean(prev?.include) || /^(y|yes)$/i.test(line[col('include')] ?? ''), slug: line[col('project')] ?? '' })
    }
  }
  const rows: Record<string, string | number>[] = []
  for (const p of missing) {
    const slug = p.slug ?? String(p.id)
    const base = { project: p.name, live: live.has(p.id) ? 'yes' : 'no' }
    // Folders the import could use first, then the closest name.
    const found = (bySlug.get(slug) ?? []).sort((a, b) => Number(b.place.kind === 'importable') - Number(a.place.kind === 'importable') || b.score - a.score)
    if (!found.length) {
      const shown = (p.legacyUrls ?? []).reduce((n, u) => n + (oldSite.get(u.path) ?? 0), 0)
      rows.push({
        ...base,
        reason: 'No folder on this drive',
        folder: '',
        photos: '',
        match: '',
        fix: shown
          ? `The old site showed ${shown} photo(s): the originals are elsewhere (F: drive, the photographer). Add a folder under Photos.`
          : (p.legacyUrls ?? []).some((u) => oldSite.has(u.path))
            ? 'The old site showed no photos for it either. Decide whether it should launch.'
            : 'Not on the old site. Find its photos or decide whether it should launch.',
      })
      continue
    }
    const best = found[0]
    const where = best.parts.join(' / ')
    const photos = best.web + best.other
    const match = best.sure ? `sure (${best.score.toFixed(2)})` : best.score > 0.5 ? `unsure (${best.score.toFixed(2)})` : 'possible: shares a distinctive word'
    if (best.place.kind === 'blocked') {
      rows.push({ ...base, reason: best.place.reason, folder: where, photos, match, fix: best.place.fix })
    } else if (best.sure && !p.photographers?.length) {
      rows.push({
        ...base,
        reason: 'Matched, but the project has no photographer (the import skips it)',
        folder: where,
        photos,
        match,
        fix: 'Add the photographer in the admin (Images → Photographers), then pnpm media:scan --accept-guesses and pnpm media:import --write --confirm-backup.',
      })
    } else if (best.sure) {
      // What the last scan's photos.csv says about this folder decides why nothing came in.
      const planned = plan.get(best.parts.slice(1, 3).join('/'))
      const [reason, fix] = !planned
        ? ['Matched, but not in photos.csv (scanned before the folder was added)', 'pnpm media:scan --accept-guesses, then pnpm media:import --write --confirm-backup.']
        : !planned.include
          ? ['Matched, but photos.csv says not to import it', 'Write yes in photos.csv for its rows (or rerun pnpm media:scan --accept-guesses), then pnpm media:import --write --confirm-backup.']
          : planned.slug !== slug
            ? [`Matched, but photos.csv sends its photos to ${planned.slug}`, `Change the project column to ${slug} in photos.csv, then pnpm media:import --write --confirm-backup.`]
            : ['Matched and marked yes in photos.csv; the import has not run since, or stopped', 'Run pnpm media:import (without --write) to see what stops it, then with --write --confirm-backup.']
      rows.push({ ...base, reason, folder: where, photos, match, fix })
    } else {
      rows.push({
        ...base,
        reason: best.runnerUp
          ? `Folder name close to two projects (also ${best.runnerUp})`
          : 'In Photos, but the folder name is too different to match for sure',
        folder: where,
        photos,
        match,
        fix: best.runnerUp
          ? `If it is ${p.name}, write yes and ${slug} in photos.csv for its rows. If the two projects are one, merge them first.`
          : `Write yes and ${slug} in photos.csv for its rows, or rename the folder to the website name.`,
      })
    }
  }

  await mkdir(path.dirname(OUT), { recursive: true })
  await writeFile(OUT, csv(rows, ['project', 'live', 'reason', 'folder', 'photos', 'match', 'fix']))

  const count = new Map<string, number>()
  for (const r of rows) count.set(String(r.reason).replace(/ \(in .*\)$/, ' (another top folder)'), (count.get(String(r.reason).replace(/ \(in .*\)$/, ' (another top folder)')) ?? 0) + 1)
  console.log(`Read ${folders.length} folders with images under ${root}.`)
  console.log(`${missing.length} projects have no photos. Why:`)
  for (const [k, n] of [...count].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${k}`)
  console.log(`\nProject by project, with the folder and what to do: ${path.relative(process.cwd(), OUT)}`)
  process.exit(0)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
