/**
 * Publish what the photo imports saved as drafts, in one go, once someone has spot-checked a few.
 *
 *   pnpm media:publish            # list what would be published, and what cannot be yet
 *   pnpm media:publish --write    # publish it (--confirm-backup if the database is not local)
 *
 * Only projects that media:import or projects:add wrote to on this computer are considered;
 * they are listed in scripts/media/cache/touched.json as each one is saved. Nothing else an
 * editor has in draft is published. A project without categories (typologies) is held: it would
 * be missing from every portfolio page. Published projects leave the list; held ones stay
 * until they are ready.
 */
import '../env'

import { mkdir, readFile, writeFile } from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

import { getPayload, type Payload } from 'payload'

import config from '../../src/payload.config'
import type { Project } from '../../src/payload-types'

export const TOUCHED_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'cache', 'touched.json')

export async function readTouched(file = TOUCHED_FILE): Promise<number[]> {
  try {
    return (JSON.parse(await readFile(file, 'utf8')) as { projects: number[] }).projects
  } catch {
    return []
  }
}

async function saveTouched(ids: number[], file: string) {
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, JSON.stringify({ projects: [...new Set(ids)].sort((a, b) => a - b) }, null, 2) + '\n')
}

/** Called by the imports after each project they save. */
export async function recordTouched(id: number, file = TOUCHED_FILE) {
  await saveTouched([...(await readTouched(file)), id], file)
}

export type PublishResult = { published: string[]; held: { name: string; reason: string }[]; live: string[]; gone: number[] }

/** Publishes each project's latest draft as it stands; never changes its content. */
export async function publishProjects(payload: Payload, ids: number[], write: boolean): Promise<PublishResult> {
  const result: PublishResult = { published: [], held: [], live: [], gone: [] }
  for (const id of ids) {
    const latest = (await payload.find({ collection: 'projects', where: { id: { equals: id } }, draft: true, limit: 1, depth: 0 })).docs[0] as
      | Project
      | undefined
    if (!latest) {
      result.gone.push(id)
      continue
    }
    if (latest._status === 'published') {
      result.live.push(latest.name)
      continue
    }
    if (!latest.typologies?.length) {
      result.held.push({ name: latest.name, reason: 'no categories (typologies): choose them in the admin' })
      continue
    }
    if (!latest.status) {
      result.held.push({ name: latest.name, reason: 'no project status: set it in the admin' })
      continue
    }
    result.published.push(latest.name)
    if (!write) continue
    // The whole latest draft, so the published version is exactly what the admin shows.
    const { id: _id, createdAt: _c, updatedAt: _u, ...data } = latest
    await payload.update({ collection: 'projects', id, draft: false, data: { ...data, _status: 'published' } as never })
  }
  return result
}

async function main() {
  const write = process.argv.includes('--write')
  if (write) {
    const { isLocalDatabase } = await import('./upload')
    if (!isLocalDatabase() && !process.argv.includes('--confirm-backup')) {
      console.error('DATABASE_URL is not this machine. Take a fresh backup (a Neon branch), then rerun with --confirm-backup.')
      process.exit(1)
    }
  }
  const ids = await readTouched()
  if (!ids.length) {
    console.log('Nothing to publish: no import has saved a project on this computer yet.')
    process.exit(0)
  }
  const payload = await getPayload({ config })
  const r = await publishProjects(payload, ids, write)
  const section = (title: string, lines: string[]) => {
    if (!lines.length) return
    console.log(`\n${title} (${lines.length})`)
    for (const l of lines) console.log(`  ${l}`)
  }
  section(write ? 'Published' : 'Would publish', r.published)
  section('Held', r.held.map((h) => `${h.name}: ${h.reason}`))
  section('Already live', r.live)
  if (r.gone.length) console.log(`\n${r.gone.length} project(s) no longer exist (deleted in the admin).`)
  if (write) {
    // Keep only what still needs publishing.
    const heldNames = new Set(r.held.map((h) => h.name))
    const all = await payload.find({ collection: 'projects', where: { id: { in: ids } }, draft: true, pagination: false, depth: 0, select: { name: true } })
    await saveTouched(all.docs.filter((d) => heldNames.has(d.name)).map((d) => d.id), TOUCHED_FILE)
  }
  console.log(write ? '\nDone. The live site shows them now.' : '\nNothing was published. Rerun with --write.')
  process.exit(0)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
