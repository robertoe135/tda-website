/**
 * Step 1 of the photo import: list marketing's web photos and propose which website project
 * each folder belongs to. Reads only; writes a CSV for marketing to check.
 *
 *   pnpm media:scan "/Volumes/<share>/Marketing/Website/Photos"     # Mac, share mounted
 *   pnpm media:scan "F:\Marketing\Website\Photos"                   # Windows
 *
 * Writes scripts/media/cache/photos.csv (gitignored: folder and file names can name private
 * clients). One row per photo. `include` is "yes" only where the folder name matches a
 * project exactly; every other row needs a person to fill in the project and say yes.
 * Photographers are credited on the project; the photographer column is only for a photo
 * whose credit differs.
 *
 * Squarespace stays the source of truth for text and facts; this only brings in photographs.
 */
import 'dotenv/config'

import { mkdir, readdir, writeFile } from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

import { getPayload } from 'payload'

import config from '../../src/payload.config'
import { csv } from '../migrate/lib'

import { redactor } from './inventory-lib'
import { matchProject, parsePhotoPath, type PhotoPath, photosRoot, skipReason, slideOrder } from './lib'

export const mediaDir = path.dirname(fileURLToPath(import.meta.url))
export const PHOTOS_CSV = path.join(mediaDir, 'cache', 'photos.csv')
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
  const given = process.argv[2]
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
  const candidates = projects.docs.map((p) => ({ slug: p.slug ?? '', name: p.name }))
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
  const chosenFolderFor = new Map<string, string>()
  for (const [key, list] of folders) {
    const match = matchProject(list[0].folderName, candidates)
    if (!match?.exact) continue
    const current = chosenFolderFor.get(match.candidate.slug)
    if (!current || byFolder.get(current)!.length < list.length) chosenFolderFor.set(match.candidate.slug, key)
  }

  const rows: Record<string, unknown>[] = []
  let exact = 0
  let suggested = 0
  let unmatched = 0
  for (const [key, list] of folders) {
    const { category, folder, folderName } = list[0]
    const match = matchProject(folderName, candidates)
    const project = match && projects.docs.find((p) => p.slug === match.candidate.slug)
    const notes: string[] = []
    let include = match?.exact ? 'yes' : ''
    if (!match) {
      unmatched++
      notes.push('No matching project. Fill in the project slug, or leave this folder out.')
    } else if (!match.exact) {
      suggested++
      notes.push(`Closest project (${Math.round(match.score * 100)}% similar). Check it, then write yes.`)
    } else exact++

    if (project) {
      const chosen = chosenFolderFor.get(project.slug ?? '')
      if (chosen && chosen !== key) {
        include = ''
        notes.push(`Same project as ${chosen}, which has more photos and is used.`)
      }
      const typologyNames = (project.typologies ?? []).map((t) => (typeof t === 'object' ? t.name : '')).filter(Boolean)
      if (typologyNames.length && !typologyNames.some((n) => n.toLowerCase() === category.toLowerCase())) {
        notes.push(`Folder category "${category}" is not one of the project's categories (${typologyNames.join(', ')}).`)
      }
      if (project.heroImage) notes.push('Project already has photos; the import skips it unless run with --replace.')
    }

    if (project && !project.photographers?.length)
      notes.push('Project has no photographer. Run pnpm migrate:photographers, or add one to the project.')

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
  await writeFile(PHOTOS_CSV, csv(rows, COLUMNS))
  console.log(`${rows.length} photos in ${byFolder.size} folders.`)
  console.log(`Folders: ${exact} matched exactly, ${suggested} need a check, ${unmatched} not matched.`)
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
