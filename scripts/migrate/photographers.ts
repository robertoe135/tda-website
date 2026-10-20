/**
 * Photographers, after the first import:
 * 1. Repair: that import saved comma-separated credits ("Brett Beyer, Iwan Baan") as single
 *    photographers. Each person is created (or found, by normalized name) and the combined
 *    record deleted, unless an image already uses it; those are listed instead.
 * 2. Credit: each project gets the photographers its old credits page lists, in that order,
 *    when it has none yet, on its published version and its latest draft (a pending draft
 *    stays unpublished). TDA credits photography per project, not per photo.
 * Spellings are kept exactly as written on the old site.
 *
 *   pnpm migrate:photographers               # list what would change
 *   pnpm migrate:photographers --write       # change it (--confirm-backup if not local)
 */
import '../env'

import { readFile } from 'fs/promises'
import path from 'path'

import { getPayload } from 'payload'

import config from '../../src/payload.config'
import { normalizeName } from '../../src/hooks/preventNearDuplicates'

import type { ProjectRecord } from './extract'
import { cacheDir, SITE, splitCredit } from './lib'
import { changeProject } from './versions'

const write = process.argv.includes('--write')

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
  if (write) assertLocalDatabase()
  const payload = await getPayload({ config })
  const all = await payload.find({ collection: 'photographers', pagination: false, depth: 0 })
  const combined = all.docs.filter((p) => splitCredit(p.name).length > 1 || p.name.trim().endsWith(','))
  let created = 0
  for (const record of combined) {
    const parts = splitCredit(record.name)
    const inUse = await payload.count({ collection: 'media', where: { photographer: { equals: record.id } } })
    if (inUse.totalDocs) {
      console.log(`keep "${record.name}": ${inUse.totalDocs} image(s) use it. Re-credit them in the admin first.`)
      continue
    }
    console.log(`"${record.name}" → ${parts.map((p) => `"${p}"`).join(', ')}`)
    if (!write) continue
    await payload.delete({ collection: 'photographers', id: record.id })
    for (const name of parts) {
      const found = await payload.find({ collection: 'photographers', where: { normalizedName: { equals: normalizeName(name) } }, limit: 1, depth: 0 })
      if (!found.docs[0]) {
        await payload.create({ collection: 'photographers', data: { name } })
        created++
      }
    }
  }
  console.log(write ? `\nSplit ${combined.length} records; ${created} photographers added.` : `\n${combined.length} to split.`)

  // Project credits from the extracted old credits pages.
  const extracted = path.join(cacheDir, new URL(SITE).host, 'extracted', 'projects.json')
  const records: ProjectRecord[] = JSON.parse(await readFile(extracted, 'utf8'))
  const ids = new Map(
    (await payload.find({ collection: 'photographers', pagination: false, depth: 0 })).docs.map((p) => [normalizeName(p.name), p.id]),
  )
  let credited = 0
  let missing = 0
  for (const record of records) {
    const names = (record.credits?.photography ?? []).flatMap(splitCredit)
    if (!names.length || !record.legacyPaths.length) continue
    const found = await payload.find({
      collection: 'projects',
      where: { 'legacyUrls.path': { equals: record.legacyPaths[0] } },
      draft: true,
      limit: 1,
      depth: 0,
      select: { name: true, photographers: true },
    })
    const project = found.docs[0]
    if (!project) continue
    // On the live version too (versions.ts): a draft-only credit never reached published pages.
    // Each version without photographers gets them; one that has any is left as it is.
    const live = await payload.findByID({ collection: 'projects', id: project.id, depth: 0 }).catch(() => undefined)
    const needs = !project.photographers?.length || (live?._status === 'published' && !live.photographers?.length)
    if (!needs) continue
    const photographerIds = names.map((n) => ids.get(normalizeName(n)))
    if (photographerIds.some((id) => !id)) {
      if (write) console.log(`skip ${project.name}: run once more after the split (${names.join(', ')})`)
      missing++
      continue
    }
    if (write) await changeProject(payload, project.id, (v) => (v.photographers?.length ? undefined : { photographers: photographerIds as number[] }))
    credited++
  }
  console.log(write ? `Credited photographers on ${credited} projects.` : `${credited + missing} projects to credit. Rerun with --write.`)
  process.exit(0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
