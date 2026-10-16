/**
 * Step 2 of the photo import: upload the photos marked "yes" in photos.csv and attach them
 * to their projects, the first as the hero and the rest as the slideshow, in `slide` order.
 *
 *   pnpm media:import "/Volumes/<share>/Marketing/Website/Photos"            # check only
 *   pnpm media:import "/Volumes/<share>/Marketing/Website/Photos" --write    # upload, save drafts
 *     --replace          also replace photos on projects that already have some
 *     --csv <file>       a different CSV than scripts/media/cache/photos.csv
 *     --confirm-backup   required when DATABASE_URL is not this machine
 *
 * All or nothing: every row is checked (file exists, credit known, description present)
 * before anything is uploaded. Photos are scaled to 3000 px and stripped of metadata on this
 * computer, so Vercel's upload limit does not apply and the originals never leave the office.
 * Projects are saved as drafts. Re-running reuses photos already uploaded (matched on a hash
 * of the file and its project), so an interrupted run can simply be started again.
 */
import 'dotenv/config'

import { createHash } from 'crypto'
import { readFile, stat } from 'fs/promises'
import path from 'path'

import { getPayload } from 'payload'
import sharp from 'sharp'

import config from '../../src/payload.config'
import { MAX_IMAGE_EDGE } from '../../src/hooks/sanitizeUpload'
import { normalizeName } from '../../src/hooks/preventNearDuplicates'
import { parseCsv } from '../team/lib'

import { PHOTOS_CSV } from './scan'

const args = process.argv.slice(2)
const flag = (name: string) => args.includes(name)
const option = (name: string) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined)
const root = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--csv')
const write = flag('--write')
const replace = flag('--replace')

type Row = { line: number; project: string; file: string; folder: string; category: string; slide: number; photographer: string; alt: string }

function dbHost() {
  try {
    return new URL(process.env.DATABASE_URL ?? '').hostname
  } catch {
    return ''
  }
}

function assertSafeTarget() {
  const local = ['localhost', '127.0.0.1', '::1'].includes(dbHost())
  if (!local && !flag('--confirm-backup')) {
    console.error(`DATABASE_URL points at ${dbHost() || 'an unknown host'}, not this machine.`)
    console.error('Take a fresh backup (a Neon branch), then rerun with --confirm-backup.')
    process.exit(1)
  }
  // Without the Blob token Payload would write files to this computer's disk while a remote
  // database records them: broken images on the live site.
  if (!local && !process.env.BLOB_READ_WRITE_TOKEN) {
    console.error('BLOB_READ_WRITE_TOKEN is not set, so photos would be saved on this computer only.')
    console.error('Add the token from Vercel → Storage → tda-website-storage, then rerun.')
    process.exit(1)
  }
}

async function main() {
  if (!root) {
    console.error('Usage: pnpm media:import <path to Marketing/Website/Photos> [--write] [--replace] [--csv file] [--confirm-backup]')
    process.exit(1)
  }
  if (write) assertSafeTarget()

  const csvFile = option('--csv') ?? PHOTOS_CSV
  const [header, ...body] = parseCsv(await readFile(csvFile, 'utf8'))
  const col = (name: string) => header.findIndex((h) => h.trim().toLowerCase() === name)
  const problems: string[] = []
  const rows: Row[] = []
  body.forEach((cells, i) => {
    const get = (name: string) => (cells[col(name)] ?? '').trim()
    if (!/^(y|yes)$/i.test(get('include'))) return
    rows.push({
      line: i + 2,
      project: get('project'),
      file: get('file'),
      folder: get('folder'),
      category: get('category'),
      slide: Number(get('slide')) || Number.MAX_SAFE_INTEGER,
      photographer: get('photographer'),
      alt: get('alt'),
    })
  })

  const payload = await getPayload({ config })
  const photographers = await payload.find({ collection: 'photographers', pagination: false, depth: 0 })
  const photographerId = new Map(photographers.docs.map((p) => [normalizeName(p.name), p.id]))

  const byProject = new Map<string, Row[]>()
  for (const row of rows) {
    const at = `line ${row.line}`
    if (!row.project) problems.push(`${at}: no project.`)
    if (!row.alt) problems.push(`${at}: no description (alt).`)
    if (row.photographer && !photographerId.has(normalizeName(row.photographer)))
      problems.push(`${at}: photographer "${row.photographer}" is not in the admin. Add them under Photographers, or fix the spelling.`)
    const source = path.join(root, row.category, row.folder, row.file)
    if (!(await stat(source).catch(() => undefined))?.isFile()) problems.push(`${at}: file not found: ${row.category}/${row.folder}/${row.file}`)
    byProject.set(row.project, [...(byProject.get(row.project) ?? []), row])
  }

  const targets: { id: number; name: string; rows: Row[] }[] = []
  for (const [slug, list] of byProject) {
    if (!slug) continue
    const found = await payload.find({ collection: 'projects', where: { slug: { equals: slug } }, draft: true, limit: 1, depth: 0 })
    const project = found.docs[0]
    if (!project) {
      problems.push(`line ${list[0].line}: no project with slug "${slug}".`)
      continue
    }
    if (!project.photographers?.length && list.some((r) => !r.photographer)) {
      problems.push(`line ${list[0].line}: ${project.name} has no photographer. Add one to the project (Images → Photographers) or to each photo.`)
      continue
    }
    if ((project.heroImage || project.gallery?.length) && !replace) {
      console.log(`skip ${project.name}: already has photos (use --replace).`)
      continue
    }
    targets.push({ id: project.id, name: project.name, rows: [...list].sort((a, b) => a.slide - b.slide) })
  }

  if (problems.length) {
    for (const p of problems) console.error(p)
    console.error(`\n${problems.length} problem(s). Nothing was uploaded.`)
    process.exit(1)
  }
  const total = targets.reduce((n, t) => n + t.rows.length, 0)
  console.log(`${total} photos for ${targets.length} projects.`)
  if (!write) {
    console.log('Nothing uploaded; rerun with --write.')
    process.exit(0)
  }

  let uploaded = 0
  let reused = 0
  for (const target of targets) {
    const ids: number[] = []
    for (const row of target.rows) {
      const original = await readFile(path.join(root, row.category, row.folder, row.file))
      // Per project: the same photo filed under two projects gets its own description and credit.
      const sourceHash = createHash('sha256').update(`${row.project}\n`).update(original).digest('hex')
      const existing = await payload.find({ collection: 'media', where: { sourceHash: { equals: sourceHash } }, limit: 1, depth: 0 })
      if (existing.docs[0]) {
        ids.push(existing.docs[0].id)
        reused++
        continue
      }
      // Scale and re-encode here (TIFFs become JPEGs); the upload hook also strips metadata.
      const data = await sharp(original)
        .rotate()
        .resize({ width: MAX_IMAGE_EDGE, height: MAX_IMAGE_EDGE, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 90, mozjpeg: true })
        .toBuffer()
      const media = await payload.create({
        collection: 'media',
        data: { alt: row.alt, photographer: row.photographer ? photographerId.get(normalizeName(row.photographer)) : undefined, sourceHash },
        file: { data, mimetype: 'image/jpeg', name: 'photo.jpg', size: data.length },
      })
      ids.push(media.id)
      uploaded++
      process.stdout.write(`\r${uploaded + reused}/${total} photos`)
    }
    await payload.update({
      collection: 'projects',
      id: target.id,
      data: { heroImage: ids[0], gallery: ids.slice(1).map((image) => ({ image })) },
      draft: true,
    })
  }
  console.log(`\nUploaded ${uploaded} photos (${reused} already there) to ${targets.length} project drafts. Publish them in the admin.`)
  process.exit(0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
