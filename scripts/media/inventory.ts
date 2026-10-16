/**
 * What is in TDA's website folder, before anything is uploaded. Reads only.
 *
 *   pnpm media:inventory "/Volumes/T7/Website"
 *   pnpm media:inventory "/Volumes/T7/Website" --match     # also match folders to projects
 *
 * Prints a summary (folder names under Residential/Private folders hidden, so it can be
 * pasted into a chat or email) and writes every file to scripts/media/cache/inventory.csv
 * (gitignored, real names) with what needs attention before upload. --match needs
 * DATABASE_URL (local or production; it only reads).
 */
import 'dotenv/config'

import { mkdir, readdir, stat, writeFile } from 'fs/promises'
import path from 'path'

import sharp from 'sharp'

import { csv } from '../migrate/lib'

import {
  BLOB_BYTES_PER_PHOTO,
  type Entry,
  flagsFor,
  formatSize,
  isClutter,
  kindOf,
  type Kind,
  redactor,
  scaledOnUpload,
} from './inventory-lib'
import { matchProject } from './lib'

const OUT = path.join(path.dirname(new URL(import.meta.url).pathname), 'cache', 'inventory.csv')

async function walk(root: string, dir = '', out: string[] = [], skipped: string[] = []) {
  let entries
  try {
    entries = await readdir(path.join(root, dir), { withFileTypes: true })
  } catch {
    skipped.push(dir || '.')
    return { files: out, skipped }
  }
  for (const e of entries) {
    if (isClutter(e.name)) continue
    const rel = dir ? `${dir}/${e.name}` : e.name
    if (e.isDirectory()) await walk(root, rel, out, skipped)
    else if (e.isFile()) out.push(rel)
  }
  return { files: out, skipped }
}

async function main() {
  const root = process.argv[2]
  const match = process.argv.includes('--match')
  if (!root) {
    console.error('Usage: pnpm media:inventory "/Volumes/T7/Website" [--match]')
    process.exit(1)
  }
  console.log(`Reading ${root} …`)
  const { files, skipped } = await walk(root)

  const entries: Entry[] = []
  let done = 0
  for (let i = 0; i < files.length; i += 16) {
    const batch = files.slice(i, i + 16)
    entries.push(
      ...(await Promise.all(
        batch.map(async (rel): Promise<Entry> => {
          const full = path.join(root, rel)
          const kind = kindOf(rel)
          const { size } = await stat(full)
          if (kind !== 'photo') return { path: rel, kind, bytes: size }
          try {
            const m = await sharp(full, { failOn: 'none' }).metadata() // reads the header only
            const turned = (m.orientation ?? 1) >= 5 // EXIF says rotate 90°
            return { path: rel, kind, bytes: size, width: turned ? m.height : m.width, height: turned ? m.width : m.height }
          } catch {
            return { path: rel, kind, bytes: size, unreadable: true }
          }
        }),
      )),
    )
    done += batch.length
    if (files.length > 200) process.stdout.write(`\r${done}/${files.length} files`)
  }
  if (files.length > 200) process.stdout.write('\n')

  // Same file name and size in two places: probably the same photo filed twice.
  const seen = new Map<string, string>()
  const duplicates = new Map<string, string>()
  for (const e of entries) {
    if (e.kind === 'other' || e.kind === 'document') continue
    const key = `${path.basename(e.path).toLowerCase()}|${e.bytes}`
    if (seen.has(key)) duplicates.set(e.path, seen.get(key)!)
    else seen.set(key, e.path)
  }

  const redact = redactor()
  const rows = entries.map((e) => {
    const flags = flagsFor(e)
    if (duplicates.has(e.path)) flags.push(`same name and size as ${duplicates.get(e.path)}`)
    return { ...e, flags }
  })

  // ── summary ────────────────────────────────────────────────────────────────
  const line = (s = '') => console.log(s)
  const by = (k: Kind) => rows.filter((r) => r.kind === k)
  const total = (list: { bytes: number }[]) => formatSize(list.reduce((n, r) => n + r.bytes, 0))
  const LABEL: Record<Kind, string> = {
    photo: 'Photos (JPEG, PNG, TIFF…)',
    'needs-export': 'Images to export first (HEIC, PSD, RAW…)',
    video: 'Videos',
    document: 'Documents (copy, PDFs…)',
    other: 'Other files',
  }
  line()
  line(`${rows.length} files, ${total(rows)}`)
  for (const k of Object.keys(LABEL) as Kind[]) {
    const list = by(k)
    if (list.length) line(`  ${LABEL[k].padEnd(44)} ${String(list.length).padStart(6)}  ${total(list).padStart(8)}`)
  }

  line()
  line('Folders (photos / videos / documents), three levels deep:')
  const tree = new Map<string, { photo: number; video: number; document: number }>()
  for (const r of rows) {
    const parts = r.path.split('/').slice(0, -1)
    for (let d = 1; d <= Math.min(3, parts.length); d++) {
      const key = parts.slice(0, d).join('/')
      const t = tree.get(key) ?? { photo: 0, video: 0, document: 0 }
      if (r.kind === 'photo' || r.kind === 'needs-export') t.photo++
      else if (r.kind === 'video') t.video++
      else if (r.kind === 'document') t.document++
      tree.set(key, t)
    }
  }
  const keys = [...tree.keys()].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
  const MAX_TREE = 120
  for (const key of keys.slice(0, MAX_TREE)) {
    const depth = key.split('/').length - 1
    const t = tree.get(key)!
    const name = redact(key).split('/').pop()
    line(`  ${'  '.repeat(depth)}${name}  (${t.photo} / ${t.video} / ${t.document})`)
  }
  if (keys.length > MAX_TREE) line(`  … ${keys.length - MAX_TREE} more folders in the CSV`)

  const photos = by('photo').filter((r) => !r.unreadable)
  const videos = by('video')
  const okVideos = videos.filter((v) => !v.flags.length)
  line()
  line('If every photo and video here went on the site:')
  line(`  ${photos.length} photos → about ${formatSize(photos.length * BLOB_BYTES_PER_PHOTO)} in Blob (originals stay on the drive)`)
  line(`  ${photos.filter(scaledOnUpload).length} of them are larger than 3000 px and would be scaled down on upload`)
  line(`  ${okVideos.length} of ${videos.length} videos are ready to upload as they are (${total(okVideos)})`)

  const flagCounts = new Map<string, number>()
  for (const r of rows) for (const f of r.flags) {
    const k = f.replace(/ \(\d+ px\)/, '').replace(/same name and size as .*/, 'possible duplicate (same name and size)')
    flagCounts.set(k, (flagCounts.get(k) ?? 0) + 1)
  }
  if (flagCounts.size) {
    line()
    line('Needs attention before upload:')
    for (const [f, n] of [...flagCounts].sort((a, b) => b[1] - a[1])) line(`  ${String(n).padStart(6)}  ${f}`)
  }
  if (skipped.length) {
    line()
    line(`${skipped.length} folder(s) could not be read (permissions).`)
  }

  if (match) {
    const { getPayload } = await import('payload')
    const config = (await import('../../src/payload.config')).default
    const payload = await getPayload({ config })
    const projects = await payload.find({ collection: 'projects', draft: true, pagination: false, depth: 0, select: { name: true, slug: true } })
    const candidates = projects.docs.map((p) => ({ slug: p.slug ?? '', name: p.name }))
    const folders = [...new Set(rows.filter((r) => r.kind === 'photo').map((r) => r.path.split('/').slice(0, -1).join('/')))]
    let exact = 0
    let near = 0
    for (const f of folders) {
      const m = matchProject(f.split('/').pop()!.replace(/^\s*\d+\s*[.)-]\s*/, ''), candidates)
      if (m?.exact) exact++
      else if (m) near++
    }
    line()
    line(`Photo folders vs. the ${candidates.length} website projects: ${exact} match exactly, ${near} look close, ${folders.length - exact - near} match none.`)
  }

  await mkdir(path.dirname(OUT), { recursive: true })
  await writeFile(
    OUT,
    csv(
      rows.map((r) => ({
        path: r.path,
        kind: r.kind,
        'size MB': (r.bytes / 1024 / 1024).toFixed(2),
        width: r.width ?? '',
        height: r.height ?? '',
        'needs attention': r.flags.join('; '),
      })),
      ['path', 'kind', 'size MB', 'width', 'height', 'needs attention'],
    ),
  )
  line()
  line(`Every file, with what needs attention: ${path.relative(process.cwd(), OUT)}`)
  line('The summary above hides folder names under Residential/Private folders; the CSV does not.')
  process.exit(0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
