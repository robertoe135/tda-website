/**
 * Replace team headshots with the original photographs, read-only unless --write:
 *
 *   pnpm team:headshots "/Users/me/Desktop/Team photos"                  # list the matches
 *   pnpm team:headshots "<folder>" --write --confirm-backup              # upload, save as drafts
 *   pnpm team:headshots "<folder>" --write --publish --confirm-backup    # and publish them
 *   pnpm team:headshots "<folder>" --map headshots.csv                  # use a list you filled in
 *
 * Looks through the folder and its subfolders for photos (JPEG, PNG, TIFF, WebP) and matches each
 * to a person by first and last name in the file or folder name (either order), or by initials
 * when no one else shares them. Where several photos match one person, the largest is used. A
 * person keeps their current headshot when the new photo is not larger. Photos are scaled to
 * 3000 px and stripped of camera data before upload; the old headshot stays in Images.
 *
 * Writes scripts/team/out/headshots.csv (not committed) with every match and every photo that
 * matched no one. Refuses a database that is not on this machine unless --confirm-backup is passed.
 */
import '../env'

import { createHash } from 'crypto'
import { mkdir, readdir, readFile, stat, writeFile } from 'fs/promises'
import path from 'path'

import { getPayload } from 'payload'
import sharp from 'sharp'

import config from '../../src/payload.config'
import { csv } from '../migrate/lib'
import { assertSafeTarget, uploadPhoto } from '../media/upload'

import { matchesFromList, matchHeadshots } from './headshots-lib'
import { parseCsv } from './lib'

const IMAGE = /\.(jpe?g|png|tiff?|webp)$/i
const OUT = path.join(path.dirname(new URL(import.meta.url).pathname), 'out', 'headshots.csv')

async function walk(root: string, dir = ''): Promise<string[]> {
  const out: string[] = []
  for (const e of await readdir(path.join(root, dir), { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue
    const rel = dir ? path.join(dir, e.name) : e.name
    if (e.isDirectory()) out.push(...(await walk(root, rel)))
    else out.push(rel)
  }
  return out
}

async function main() {
  const args = process.argv.slice(2)
  const folder = args.find((a) => !a.startsWith('--'))
  const write = args.includes('--write')
  const publish = args.includes('--publish')
  if (!folder) {
    console.error('Usage: pnpm team:headshots "<folder of photos>" [--map list.csv] [--write] [--publish] [--confirm-backup]')
    process.exit(1)
  }
  if (write) assertSafeTarget(args.includes('--confirm-backup'))

  const files = await walk(folder)
  const photos = files.filter((f) => IMAGE.test(f))
  const other = files.filter((f) => /\.(heic|psd|cr2|cr3|nef|arw|dng)$/i.test(f))

  const payload = await getPayload({ config })
  const people = await payload.find({
    collection: 'people',
    draft: true,
    pagination: false,
    depth: 1,
    select: { name: true, slug: true, headshot: true, isCurrent: true },
  })
  // A list someone filled in (person, file) decides; otherwise the names in the files do.
  const mapPath = args.includes('--map') ? args[args.indexOf('--map') + 1] : undefined
  let listed = false
  let problems: string[] = []
  let { matches, unmatched } = matchHeadshots(photos, people.docs)
  if (mapPath) {
    const [header, ...lines] = parseCsv(await readFile(mapPath, 'utf8'))
    const col = (n: string) => header.map((h) => h.trim().toLowerCase()).indexOf(n)
    if (col('person') < 0 || col('file') < 0) throw new Error(`${mapPath} needs a "person" and a "file" column.`)
    const list = matchesFromList(lines.map((l) => ({ person: l[col('person')] ?? '', file: l[col('file')] ?? '' })), people.docs, photos)
    const chosen = new Set(list.matches.map((m) => m.file))
    matches = list.matches
    unmatched = photos.filter((f) => !chosen.has(f))
    problems = list.problems
    listed = true
  }

  // Per person: the largest matching photo.
  const sized = await Promise.all(matches.map(async (m) => ({ ...m, bytes: (await stat(path.join(folder, m.file))).size })))
  const best = new Map<number, (typeof sized)[number]>()
  for (const m of sized) if (!best.has(m.person.id) || m.bytes > best.get(m.person.id)!.bytes) best.set(m.person.id, m)

  const rows: Record<string, string | number>[] = []
  let replaced = 0
  for (const person of people.docs) {
    const m = best.get(person.id)
    const current = typeof person.headshot === 'object' && person.headshot ? person.headshot : undefined
    const currentSize = current?.width && current?.height ? `${current.width}×${current.height}` : current ? 'unknown' : 'none'
    if (!m) {
      if (person.isCurrent) rows.push({ person: person.name, action: 'no photo found', file: '', by: '', new: '', current: currentSize })
      continue
    }
    const original = await readFile(path.join(folder, m.file))
    // The same photo already uploaded (uploads are scaled, so compare fingerprints, not sizes).
    const key = `person:${person.slug ?? person.id}`
    const hash = createHash('sha256').update(`${key}\n`).update(original).digest('hex')
    if (current?.sourceHash === hash) {
      rows.push({ person: person.name, action: 'kept: already this photo', file: m.file, by: m.by, new: '', current: currentSize })
      continue
    }
    const meta = await sharp(original).metadata()
    const newSize = meta.width && meta.height ? `${meta.width}×${meta.height}` : '?'
    // A photo someone chose is used even when the current one is as large.
    const larger = listed || !current?.width || (meta.width ?? 0) * (meta.height ?? 0) > current.width * (current.height ?? current.width)
    const action = !larger ? 'kept: current photo is as large' : write ? (publish ? 'replaced, published' : 'replaced, draft') : 'would replace'
    rows.push({ person: person.name, action, file: m.file, by: m.by === 'initials' || m.by === 'first name' ? `${m.by}: check` : m.by, new: newSize, current: currentSize })
    if (!larger || !write) continue
    const media = await uploadPhoto(payload, key, original, { alt: person.name })
    await payload.update({
      collection: 'people',
      id: person.id,
      draft: !publish,
      data: { headshot: media.id, ...(publish ? { _status: 'published' as const } : {}) },
    })
    replaced++
  }
  for (const file of unmatched) rows.push({ person: '', action: listed ? 'not on your list' : 'matched no one (or two people)', file, by: '', new: '', current: '' })

  // Never write over the list that was read.
  const out = mapPath && path.resolve(mapPath) === OUT ? OUT.replace(/\.csv$/, '-checked.csv') : OUT
  await mkdir(path.dirname(out), { recursive: true })
  await writeFile(out, csv(rows, ['person', 'action', 'file', 'by', 'new', 'current']))

  const count = (a: string) => rows.filter((r) => String(r.action).startsWith(a)).length
  console.log(`${photos.length} photos in the folder${other.length ? ` (${other.length} HEIC/PSD/RAW files skipped: export JPEGs)` : ''}.`)
  const loose = [...best.values()].filter((m) => m.by === 'initials' || m.by === 'first name').length
  console.log(`${best.size} people matched${listed ? ' from your list' : ''}${loose ? ` (${loose} by first name or initials: check those)` : ''}.`)
  console.log(`${write ? 'Replaced' : 'Would replace'}: ${write ? replaced : count('would replace')}. Kept (already that photo, or as large): ${count('kept')}.`)
  console.log(`Current staff with no photo found: ${count('no photo found')}. Photos that matched no one: ${unmatched.length}.`)
  if (problems.length) {
    console.log(`\nNot used from your list (${problems.length}):`)
    for (const p of problems) console.log(`  ${p}`)
  }
  console.log(`\nPerson by person: ${path.relative(process.cwd(), out)}`)
  if (write && !publish) console.log('Saved as drafts: publish each person in the admin, or rerun with --publish.')
  process.exit(0)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
