/**
 * Merge two records of the same firm, once a person has decided which spelling is right.
 *
 *   pnpm migrate:merge-firms --keep "Foster + Partners" --merge "Fosters + Partners"           # list
 *   pnpm migrate:merge-firms --keep "Foster + Partners" --merge "Fosters + Partners" --write   # merge
 *
 * Every project that names the merged firm as architect, client or in its credits is pointed
 * at the kept (main) firm instead (no repeats). The merged record is deleted and its name, with
 * any aliases it had, becomes an alias of the main firm: never shown, but old links, filters
 * and imports using it land on the main firm. Names must match exactly; nothing is guessed. A project saved as a draft stays a draft; a published one is
 * republished with only this change. Refuses a database that is not on this machine unless
 * --confirm-backup is passed.
 */
import 'dotenv/config'

import { fileURLToPath } from 'url'

import { getPayload, type Payload } from 'payload'

import config from '../../src/payload.config'
import { normalizeName } from '../../src/hooks/preventNearDuplicates'
import type { Firm, Project } from '../../src/payload-types'

type Ref = number | { id: number } | null | undefined
const idOf = (r: Ref) => (r && typeof r === 'object' ? r.id : r)
const swap = (refs: Ref[] | null | undefined, from: number, to: number) => {
  const ids = (refs ?? []).map(idOf).filter((id): id is number => typeof id === 'number')
  return [...new Set(ids.map((id) => (id === from ? to : id)))]
}

export async function mergeFirms(payload: Payload, keepName: string, mergeName: string, write: boolean) {
  const byName = async (name: string) => {
    const found = await payload.find({ collection: 'firms', where: { name: { equals: name } }, limit: 2, depth: 0 })
    if (found.docs.length !== 1) throw new Error(`Expected one firm named "${name}", found ${found.docs.length}.`)
    return found.docs[0]
  }
  return mergeFirmRecords(payload, await byName(keepName), await byName(mergeName), write)
}

/** The merge itself, for two firm records already looked up. */
export async function mergeFirmRecords(payload: Payload, keep: Firm, merge: Firm, write: boolean) {
  if (keep.id === merge.id) throw new Error('Keep and merge are the same firm.')

  const projects = await payload.find({
    collection: 'projects',
    draft: true,
    pagination: false,
    depth: 0,
    where: {
      or: [{ architects: { in: [merge.id] } }, { clients: { in: [merge.id] } }, { 'credits.firms': { in: [merge.id] } }],
    },
  })

  const changed: string[] = []
  for (const p of projects.docs as Project[]) {
    changed.push(p.name)
    if (!write) continue
    await payload.update({
      collection: 'projects',
      id: p.id,
      data: {
        architects: swap(p.architects as Ref[], merge.id, keep.id),
        clients: swap(p.clients as Ref[], merge.id, keep.id),
        credits: (p.credits ?? []).map((c) => ({ ...c, firms: swap(c.firms as Ref[], merge.id, keep.id) })),
      },
      draft: p._status !== 'published',
    })
  }
  // The merged name joins the main firm's aliases, after the record is gone (a name may not be
  // both a firm and another firm's alias).
  const aliases = [
    ...(keep.aliases ?? []).map((a) => ({ name: a.name })),
    { name: merge.name },
    ...(merge.aliases ?? []).map((a) => ({ name: a.name })),
  ].filter((a, i, all) => all.findIndex((b) => normalizeName(b.name) === normalizeName(a.name)) === i)
  if (write) {
    await payload.delete({ collection: 'firms', id: merge.id })
    await payload.update({ collection: 'firms', id: keep.id, data: { aliases } })
  }
  return { keep: keep.name, merge: merge.name, projects: changed, aliases: aliases.map((a) => a.name) }
}

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
  const args = process.argv.slice(2)
  const value = (flag: string) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined)
  const keep = value('--keep')
  const merge = value('--merge')
  const write = args.includes('--write')
  if (!keep || !merge) {
    console.error('Usage: pnpm migrate:merge-firms --keep "<name to keep>" --merge "<name to remove>" [--write] [--confirm-backup]')
    process.exit(1)
  }
  if (write) assertLocalDatabase()
  const payload = await getPayload({ config })
  const result = await mergeFirms(payload, keep, merge, write)
  for (const name of result.projects) console.log(`  ${name}`)
  console.log(
    write
      ? `Merged "${result.merge}" into "${result.keep}" on ${result.projects.length} project(s). Other names of "${result.keep}": ${result.aliases.join(', ')}.`
      : `${result.projects.length} project(s) would move from "${result.merge}" to "${result.keep}". Rerun with --write.`,
  )
  process.exit(0)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
