/**
 * Delete the "in progress" copy of a project when the site also has it as completed (old
 * "on the boards" entries that stayed after the project finished).
 *
 *   pnpm migrate:drop-in-progress            # list the pairs
 *   pnpm migrate:drop-in-progress --write    # delete the in-progress copies (--confirm-backup if not local)
 *
 * A pair is an in-progress project whose name (three words or more, so "Art Museum" never
 * qualifies) is contained in, or nearly the same as, exactly one completed project's name: "Princeton Art Museum" → "Princeton University Art Museum".
 * Two or more completed candidates are listed and left alone. Before the copy is deleted, its
 * old web addresses, press, awards and homepage places move to the completed project, so old
 * links and the homepage keep working.
 */
import '../env'

import { fileURLToPath } from 'url'

import { getPayload, type Payload } from 'payload'

import config from '../../src/payload.config'
import { normalizeName } from '../../src/hooks/preventNearDuplicates'

import { similarity, tokens } from './lib'

type Named = { id: number; name: string; status?: string | null }
export type Pair<T extends Named = Named> = { stale: T; keep: T }

/** In-progress projects with exactly one completed counterpart; and those with several. */
export function inProgressPairs<T extends Named>(projects: T[]): { pairs: Pair<T>[]; ambiguous: { stale: T; candidates: T[] }[] } {
  const completed = projects.filter((p) => p.status === 'completed')
  const pairs: Pair<T>[] = []
  const ambiguous: { stale: T; candidates: T[] }[] = []
  for (const stale of projects.filter((p) => p.status === 'in-progress')) {
    const own = tokens(stale.name)
    const candidates = completed.filter((c) => {
      const theirs = tokens(c.name)
      const contained = own.size >= 3 && [...own].every((t) => theirs.has(t))
      return contained || similarity(normalizeName(stale.name), normalizeName(c.name)) >= 0.85
    })
    if (candidates.length === 1) pairs.push({ stale, keep: candidates[0] })
    else if (candidates.length > 1) ambiguous.push({ stale, candidates })
  }
  return { pairs, ambiguous }
}

const idOf = (ref: unknown) => (ref && typeof ref === 'object' ? (ref as { id: number }).id : (ref as number))

/** Moves what points at the stale project to the kept one, then deletes the stale one. */
export async function dropInProgress(payload: Payload, { stale, keep }: Pair, write: boolean): Promise<string[]> {
  const log: string[] = []
  const staleDoc = await payload.findByID({ collection: 'projects', id: stale.id, draft: true, depth: 0 })
  const keepDoc = await payload.findByID({ collection: 'projects', id: keep.id, draft: true, depth: 0 })

  const paths = (keepDoc.legacyUrls ?? []).map((l) => l.path)
  const moved = (staleDoc.legacyUrls ?? []).map((l) => l.path).filter((p) => !paths.includes(p))
  if (moved.length) log.push(`old addresses ${moved.join(', ')} now lead to "${keep.name}"`)

  const press = await payload.find({ collection: 'press', where: { projects: { in: [stale.id] } }, pagination: false, depth: 0 })
  const awards = await payload.find({ collection: 'awards', where: { project: { equals: stale.id } }, pagination: false, depth: 0 })
  if (press.docs.length) log.push(`${press.docs.length} press item(s) moved`)
  if (awards.docs.length) log.push(`${awards.docs.length} award(s) moved`)

  const home = await payload.findGlobal({ slug: 'home', draft: true, depth: 0 })
  let homeChanged = false
  const rows = (home.rows ?? []).map((row) => ({
    ...row,
    items: (row.items ?? []).map((item) => {
      if (item.blockType !== 'project' || idOf(item.project) !== stale.id) return item
      homeChanged = true
      return { ...item, project: keep.id }
    }),
  }))
  if (homeChanged) log.push('homepage tile now shows the completed project (publish the homepage to make it live)')

  if (!write) return log
  if (moved.length) {
    await payload.update({
      collection: 'projects',
      id: keep.id,
      data: { legacyUrls: [...(keepDoc.legacyUrls ?? []).map((l) => ({ path: l.path })), ...moved.map((path) => ({ path }))] },
      draft: keepDoc._status !== 'published',
    })
  }
  for (const p of press.docs) {
    const ids = [...new Set((p.projects ?? []).map(idOf).map((id) => (id === stale.id ? keep.id : id)))]
    await payload.update({ collection: 'press', id: p.id, data: { projects: ids } })
  }
  for (const a of awards.docs) await payload.update({ collection: 'awards', id: a.id, data: { project: keep.id } })
  if (homeChanged) await payload.updateGlobal({ slug: 'home', data: { rows } as never, draft: true })
  await payload.delete({ collection: 'projects', id: stale.id })
  return log
}

async function main() {
  const write = process.argv.includes('--write')
  if (write) {
    const { isLocalDatabase } = await import('../media/upload')
    if (!isLocalDatabase() && !process.argv.includes('--confirm-backup')) {
      console.error('DATABASE_URL is not this machine. Take a fresh backup (a Neon branch), then rerun with --confirm-backup.')
      process.exit(1)
    }
  }
  const payload = await getPayload({ config })
  const all = await payload.find({ collection: 'projects', draft: true, pagination: false, depth: 0, select: { name: true, status: true } })
  const { pairs, ambiguous } = inProgressPairs(all.docs)
  for (const pair of pairs) {
    console.log(`Delete "${pair.stale.name}" (in progress), keep "${pair.keep.name}" (completed)`)
    for (const line of await dropInProgress(payload, pair, write)) console.log(`  ${line}`)
  }
  for (const a of ambiguous)
    console.log(`Left alone: "${a.stale.name}" could be any of ${a.candidates.map((c) => `"${c.name}"`).join(', ')}. Delete it by hand if it is a copy.`)
  console.log(
    write
      ? `Deleted ${pairs.length} in-progress cop${pairs.length === 1 ? 'y' : 'ies'}.`
      : `${pairs.length} in-progress cop${pairs.length === 1 ? 'y' : 'ies'} would be deleted. Rerun with --write.`,
  )
  process.exit(0)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
