/**
 * Step 1 of the photo import: list marketing's web photos and propose which website project
 * each folder belongs to. Reads only; writes a CSV for marketing to check.
 *
 *   pnpm media:scan "/Volumes/<share>/Marketing/Website/Photos"     # Mac, share mounted
 *   pnpm media:scan "F:\Marketing\Website\Photos"                   # Windows
 *   pnpm media:scan "/Volumes/T7/Website" --accept-guesses             # also say yes to clear best guesses
 *
 * Writes scripts/media/cache/photos.csv (gitignored: folder and file names can name private
 * clients). One row per photo. `include` is "yes" where the folder name matches a project
 * exactly, and, with --accept-guesses, where the best guess is clear (typos and shortened names
 * allowed, well ahead of the next project). Every other row needs a person. A folder-by-folder
 * list of the matches is written to cache/photo-matches.csv, to check at a glance.
 * Photographers are credited on the project; the photographer column is only for a photo
 * whose credit differs.
 *
 * Squarespace stays the source of truth for text and facts; this only brings in photographs.
 */
import '../env'

import { copyFile, mkdir, readdir, stat, writeFile } from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

import { getPayload } from 'payload'

import config from '../../src/payload.config'
import { csv } from '../migrate/lib'

import { redactor } from './inventory-lib'
import { guessProject, parsePhotoPath, type PhotoPath, photosRoot, skipReason, slideOrder } from './lib'

export const mediaDir = path.dirname(fileURLToPath(import.meta.url))
export const PHOTOS_CSV = path.join(mediaDir, 'cache', 'photos.csv')
export const MATCHES_CSV = path.join(mediaDir, 'cache', 'photo-matches.csv')
export const COLUMNS = ['include', 'project', 'website name', 'category', 'folder', 'file', 'slide', 'photographer', 'alt', 'note']

async function walk(root: string, dir = ''): Promise<string[]> {
  const entries = await readdir(path.join(root, dir), { withFileTypes: true })
  const out: string[] = []
  for (const e of entries) {
    if (e.name.startsWith('.')) continue
    const rel = dir ? `${dir}/${e.name}` : e.name
    if (e.isDirectory()) out.push(...(await walk(root, rel)))
    else out.push(rel)
  }
  return out
}

async function main() {
  const given = process.argv.slice(2).find((a) => !a.startsWith('--'))
  const acceptGuesses = process.argv.includes('--accept-guesses')
  if (!given) {
    console.error('Usage: pnpm media:scan <path to the Website folder or its Photos folder>')
    process.exit(1)
  }

  const root = await photosRoot(given)
  if (root !== given) console.log(`Reading ${root} (project photos only).`)
  const files = await walk(root)
  const photos = files.map((f) => ({ rel: f, photo: parsePhotoPath(f) }))
  const skipped = photos.filter((p) => !p.photo && /\.(jpe?g|png|tiff?|webp)$/i.test(p.rel))

  const payload = await getPayload({ config })
  const projects = await payload.find({
    collection: 'projects',
    draft: true,
    pagination: false,
    depth: 1,
    select: { name: true, slug: true, typologies: true, heroImage: true, photographers: true },
  })
  const candidates = projects.docs.map((p) => ({
    slug: p.slug ?? '',
    name: p.name,
    categories: (p.typologies ?? []).map((t) => (typeof t === 'object' ? t.name : '')).filter(Boolean),
  }))
  const typologies = await payload.find({ collection: 'typologies', pagination: false, depth: 0, select: { name: true } })
  const categoryNames = typologies.docs.map((t) => t.name)

  // Folders never imported, with the reason, listed at the end (private names hidden).
  const skippedFolders = new Map<string, { reason: string; count: number }>()

  // Group by folder. A project filed under several categories uses the folder with the most
  // photos (the first of those, alphabetically, on a tie).
  const byFolder = new Map<string, PhotoPath[]>()
  for (const { photo } of photos) {
    if (!photo) continue
    const key = `${photo.category}/${photo.folder}`
    const reason = skipReason(photo.category, photo.folder, categoryNames)
    if (reason) {
      const s = skippedFolders.get(key) ?? { reason, count: 0 }
      s.count++
      skippedFolders.set(key, s)
      continue
    }
    byFolder.set(key, [...(byFolder.get(key) ?? []), photo])
  }

  const folders = [...byFolder].sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true }))
  // One guess per folder; a folder is used when it matches exactly, or (--accept-guesses) when
  // its guess is clear. Two folders on one project: exact beats a guess, then the closer guess,
  // then the one with more photos.
  const guesses = new Map(folders.map(([key, list]) => [key, guessProject(list[0].folderName, list[0].category, candidates)]))
  const used = (key: string) => {
    const g = guesses.get(key)
    return Boolean(g && (g.exact || (acceptGuesses && g.accepted)))
  }
  const rank = (key: string) => [guesses.get(key)!.exact ? 1 : 0, guesses.get(key)!.score, byFolder.get(key)!.length]
  const ahead = (a: string, b: string) => {
    const [x, y] = [rank(a), rank(b)]
    const i = x.findIndex((v, n) => v !== y[n])
    return i >= 0 && x[i] > y[i]
  }
  const chosenFolderFor = new Map<string, string>()
  for (const [key] of folders) {
    if (!used(key)) continue
    const slug = guesses.get(key)!.candidate.slug
    const current = chosenFolderFor.get(slug)
    if (!current || ahead(key, current)) chosenFolderFor.set(slug, key)
  }

  const rows: Record<string, unknown>[] = []
  let exact = 0
  let guessed = 0
  let suggested = 0
  let unmatched = 0
  const matchRows: Record<string, unknown>[] = []
  const redactFolder = redactor()
  for (const [key, list] of folders) {
    const { category, folder } = list[0]
    const match = guesses.get(key)
    const project = match && projects.docs.find((p) => p.slug === match.candidate.slug)
    const notes: string[] = []
    let include = used(key) ? 'yes' : ''
    let status = ''
    if (!match) {
      unmatched++
      status = 'no match'
      notes.push('No matching project. Fill in the project slug, or leave this folder out.')
    } else if (match.exact) {
      exact++
      status = 'exact'
    } else if (include) {
      guessed++
      status = 'best guess, used'
      notes.push(`Best guess (${Math.round(match.score * 100)}%), used. Clear include if it is the wrong project.`)
      if (match.twin && match.runnerUp)
        notes.push(`"${match.runnerUp.name}" fits almost as well: probably the same project entered twice. Merge them in the admin.`)
    } else {
      suggested++
      status = match.accepted ? 'best guess (run with --accept-guesses)' : 'unsure: check'
      notes.push(
        `Closest project (${Math.round(match.score * 100)}%)${match.runnerUp ? `, or perhaps ${match.runnerUp.name}` : ''}. Check it, then write yes.`,
      )
    }

    if (project) {
      const chosen = chosenFolderFor.get(project.slug ?? '')
      if (include && chosen && chosen !== key) {
        include = ''
        status = `same project as ${chosen}, which is used`
        notes.push(`Same project as ${chosen}, which is a closer match or has more photos and is used.`)
      }
      const typologyNames = (project.typologies ?? []).map((t) => (typeof t === 'object' ? t.name : '')).filter(Boolean)
      if (typologyNames.length && !typologyNames.some((n) => n.toLowerCase() === category.toLowerCase())) {
        notes.push(`Folder category "${category}" is not one of the project's categories (${typologyNames.join(', ')}).`)
      }
      if (project.heroImage) notes.push('Project already has photos; the import skips it unless run with --replace.')
    }

    if (project && !project.photographers?.length)
      notes.push('Project has no photographer. Run pnpm migrate:photographers, or add one to the project.')

    matchRows.push({
      folder: `${category}/${folder}`,
      photos: list.length,
      project: match?.candidate.name ?? '',
      slug: match?.candidate.slug ?? '',
      score: match ? Math.round(match.score * 100) : '',
      status,
      'next closest': match && !match.exact ? (match.runnerUp?.name ?? '') : '',
    })
    if (include && match && !match.exact) console.log(`  guess: ${redactFolder(`${category}/${folder}`)} → ${match.candidate.name} (${Math.round(match.score * 100)}%)`)

    slideOrder(list).forEach((photo, i) =>
      rows.push({
        include,
        project: match?.candidate.slug ?? '',
        'website name': match?.candidate.name ?? '',
        category,
        folder,
        file: photo.file,
        slide: i + 1,
        photographer: '', // only when this photo's credit differs from the project's
        alt: project ? `${project.name}, photograph ${i + 1}` : '',
        note: i === 0 ? notes.join(' ') : '',
      }),
    )
  }

  await mkdir(path.dirname(PHOTOS_CSV), { recursive: true })
  // A CSV someone has edited is kept: the scan writes a fresh one.
  if (await stat(PHOTOS_CSV).catch(() => undefined)) {
    const backup = PHOTOS_CSV.replace(/\.csv$/, `.before-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`)
    await copyFile(PHOTOS_CSV, backup)
    console.log(`Previous CSV kept as ${path.relative(process.cwd(), backup)}.`)
  }
  await writeFile(PHOTOS_CSV, csv(rows, COLUMNS))
  await writeFile(MATCHES_CSV, csv(matchRows, ['folder', 'photos', 'project', 'slug', 'score', 'status', 'next closest']))
  const usedPhotos = rows.filter((r) => r.include === 'yes').length
  console.log(`${rows.length} photos in ${byFolder.size} folders; ${usedPhotos} photos marked yes.`)
  console.log(
    `Folders: ${exact} matched exactly, ${guessed} by best guess, ${suggested} need a check, ${unmatched} not matched.` +
      (!acceptGuesses && suggested ? ' Add --accept-guesses to use the clear guesses.' : ''),
  )
  console.log(`Folder-by-folder list: ${path.relative(process.cwd(), MATCHES_CSV)}`)
  if (skipped.length) console.log(`${skipped.length} images not in a <Category>/<Project>/ folder (or in a subfolder of one) were left out.`)
  if (skippedFolders.size) {
    const redact = redactor()
    console.log('\nNot imported:')
    for (const [key, { reason, count }] of [...skippedFolders].sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true })))
      console.log(`  ${redact(key)} (${count}): ${reason}`)
  }
  console.log(`Wrote ${path.relative(process.cwd(), PHOTOS_CSV)}. Check it, then run pnpm media:import.`)
  process.exit(0)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
