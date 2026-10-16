/**
 * What is in TDA's website folder, before anything is uploaded. Reads only. Looks only at
 * project photography, as the import will: Photos/<portfolio category>/<project>/<file>.
 * Archive, Website Text and other top-level folders are never read; folders marked NO RIGHTS
 * or Removed, non-portfolio categories (Lifestyle Photos, Firm Profile) and PSDs are left out.
 *
 *   pnpm media:inventory "/Volumes/T7/Website"
 *   pnpm media:inventory "/Volumes/T7/Website" --match     # also match folders to projects
 *
 * Prints a summary (folder names under Residential/Private folders hidden, so it can be
 * pasted into a chat or email) and writes every file to scripts/media/cache/inventory.csv
 * (gitignored, real names) with what needs attention before upload. --match needs
 * DATABASE_URL (local or production; it only reads).
 */
import '../env'

import { mkdir, readdir, stat, writeFile } from 'fs/promises'
import path from 'path'

import sharp from 'sharp'

import { csv } from '../migrate/lib'

import {
  BLOB_BYTES_PER_PHOTO,
  type Entry,
  extOf,
  flagsFor,
  formatSize,
  isClutter,
  kindOf,
  type Kind,
  redactor,
  scaledOnUpload,
} from './inventory-lib'
import { findProjectsToAdd, IGNORED_EXTENSIONS, matchProject, photosRoot, PORTFOLIO_CATEGORIES, skipReason } from './lib'

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

/** "Projects to add": projects marketing has ready that are not on the website yet. */
async function main() {
  const given = process.argv[2]
  const match = process.argv.includes('--match')
  if (!given) {
    console.error('Usage: pnpm media:inventory "/Volumes/T7/Website" [--match]')
    process.exit(1)
  }
  const root = await photosRoot(given)
  console.log(`Reading ${root} (project photos only) …`)
  const walked = await walk(root)
  const skipped = walked.skipped

  // Only what the import reads: <category>/<project>/<file>, in a portfolio category, not
  // marked NO RIGHTS or Removed, and not a PSD. Everything else is counted, not listed.
  const leftOut = new Map<string, { reason: string; count: number }>()
  const leaveOut = (key: string, reason: string) => {
    const l = leftOut.get(key) ?? { reason, count: 0 }
    l.count++
    leftOut.set(key, l)
  }
  let psds = 0
  const subfolderNames = new Map<string, { projects: Set<string>; files: number; onlyThere: number }>()
  const files = walked.files.filter((rel) => {
    const parts = rel.split('/')
    if (IGNORED_EXTENSIONS.has(extOf(rel))) return (psds++, false)
    if (parts.length < 3) return (leaveOut(parts.slice(0, -1).join('/') || '.', 'not inside a project folder'), false)
    const reason = skipReason(parts[0], parts[1], PORTFOLIO_CATEGORIES)
    if (reason) return (leaveOut(`${parts[0]}/${parts[1]}`, reason), false)
    if (parts.length > 3) {
      leaveOut(parts.slice(0, 3).join('/'), 'in a subfolder of a project (the import reads only the project folder itself)')
      // Subfolder names (Hi-Res, Selects…), not under Residential where they could be private.
      if (!/residen|private/i.test(parts[0])) {
        const sub = subfolderNames.get(parts[2]) ?? { projects: new Set<string>(), files: 0, onlyThere: 0 }
        sub.projects.add(`${parts[0]}/${parts[1]}`)
        sub.files++
        subfolderNames.set(parts[2], sub)
      }
      return false
    }
    return true
  })

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
    'needs-export': 'Images to export first (HEIC, RAW…)',
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
  line('Project folders (photos / videos / documents):')
  const tree = new Map<string, { photo: number; video: number; document: number }>()
  for (const r of rows) {
    const parts = r.path.split('/').slice(0, -1)
    for (let d = 1; d <= Math.min(2, parts.length); d++) {
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
  if (leftOut.size || psds) {
    line()
    line('Left out (never imported):')
    const reasons = new Map<string, { folders: number; files: number }>()
    for (const { reason, count } of leftOut.values()) {
      const r = reasons.get(reason) ?? { folders: 0, files: 0 }
      r.folders++
      r.files += count
      reasons.set(reason, r)
    }
    for (const [reason, { folders, files: n }] of reasons) line(`  ${String(n).padStart(6)} files in ${folders} folder(s): ${reason}`)
    if (psds) line(`  ${String(psds).padStart(6)} PSD files`)
    const named = [...leftOut].filter(([, l]) => /NO RIGHTS|removed/.test(l.reason))
    for (const [key, l] of named) line(`         ${redact(key)} (${l.count}): ${l.reason}`)
  }
  if (subfolderNames.size) {
    const direct = new Set(rows.filter((r) => r.kind === 'photo').map((r) => r.path.split('/').slice(0, 2).join('/')))
    line()
    line('Subfolders inside project folders (not imported). Name: projects that have one, files:')
    for (const [name, v] of [...subfolderNames].sort((a, b) => b[1].projects.size - a[1].projects.size).slice(0, 25))
      line(`  ${name}: ${v.projects.size} project(s), ${v.files} files`)
    const onlyInSub = new Set([...subfolderNames.values()].flatMap((v) => [...v.projects]).filter((p) => !direct.has(p)))
    if (onlyInSub.size) {
      line(`  ${onlyInSub.size} project folder(s) have photos ONLY in subfolders, so would get none:`)
      for (const p of [...onlyInSub].slice(0, 20)) line(`    ${redact(p)}`)
    }
  }
  if (skipped.length) {
    line()
    line(`${skipped.length} folder(s) could not be read (permissions).`)
  }

  // Projects to add: listed per project folder, so the next step can be built to fit.
  const toAddRoots = await findProjectsToAdd(given, root)
  const toAddRows: Record<string, unknown>[] = []
  const toAddNames: string[] = []
  for (const dir of toAddRoots) {
    const { files: addFiles } = await walk(dir)
    const groups = new Map<string, { photo: number; video: number; document: number; other: number; bytes: number; deeper: Set<string>; docs: Set<string> }>()
    for (const rel of addFiles) {
      if (IGNORED_EXTENSIONS.has(extOf(rel))) continue
      const parts = rel.split('/')
      // A folder holding only folders (like "0 - Archive") holds projects: listed one level
      // down, as "0 - Archive / FIT". A project's own subfolders (Images, Hi-Res) stay inside it.
      const nested = parts.length > 2 && !addFiles.some((f) => f.split('/').length === 2 && f.startsWith(`${parts[0]}/`))
      const name = parts.length > 1 ? (nested ? `${parts[0]} / ${parts[1]}` : parts[0]) : '(loose files)'
      const inner = nested ? parts.slice(1) : parts
      const g = groups.get(name) ?? { photo: 0, video: 0, document: 0, other: 0, bytes: 0, deeper: new Set(), docs: new Set() }
      const k = kindOf(rel)
      if (k === 'photo' || k === 'needs-export') g.photo++
      else if (k === 'video') g.video++
      else if (k === 'document') {
        g.document++
        g.docs.add(extOf(rel))
      } else g.other++
      if (inner.length > 2) g.deeper.add(inner[1])
      g.bytes += (await stat(path.join(dir, rel))).size
      groups.set(name, g)
      toAddRows.push({ path: `${path.basename(dir)}/${rel}`, kind: k })
    }
    line()
    line(`${path.relative(given, dir) || path.basename(dir)}: ${groups.size} folder(s)  (photos / videos / documents)`)
    for (const [name, g] of [...groups].sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true }))) {
      toAddNames.push(name)
      const shown = name
      const isPrivate = /residen|private|confidential/i.test(name)
      const sub = g.deeper.size && !isPrivate ? `; subfolders: ${[...g.deeper].slice(0, 4).join(', ')}${g.deeper.size > 4 ? ', …' : ''}` : ''
      const docs = g.docs.size ? `; documents: ${[...g.docs].join(', ')}` : ''
      line(`  ${isPrivate ? '[private project]' : shown}  (${g.photo} / ${g.video} / ${g.document})  ${formatSize(g.bytes)}${docs}${sub}`)
    }
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
    if (toAddNames.length) {
      line('Projects to add vs. the website (already there = may be a duplicate):')
      for (const n of toAddNames) {
        const m = matchProject(n.replace(/^\s*\d+\s*[.)-]\s*/, ''), candidates)
        line(`  ${/residen|private|confidential/i.test(n) ? '[private project]' : n}: ${m?.exact ? `already on the site as "${m.candidate.name}"` : m ? `close to "${m.candidate.name}"` : 'new'}`)
      }
    }
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
