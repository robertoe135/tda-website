/**
 * Merge two records of the same firm, once a person has decided which spelling is right.
 *
 *   pnpm migrate:merge-firms --keep "Foster + Partners" --merge "Fosters + Partners"           # list
 *   pnpm migrate:merge-firms --keep "Foster + Partners" --merge "Fosters + Partners" --write   # merge
 *
 * Every project that names the merged firm as architect, client or in its credits is pointed
 * at the kept (main) firm instead (no repeats). The merged record is deleted and its name, with
 * any aliases it had, becomes an alias of the main firm: never shown, but old links, filters
 * and imports using it land on the main firm. Names must match exactly; nothing is guessed. A draft stays a draft; a published project is
 * republished with only this change, and a newer draft it has stays an unpublished draft. Refuses a database that is not on this machine unless
 * --confirm-backup is passed.
 */
import '../env'

import { fileURLToPath } from 'url'

import { getPayload } from 'payload'

import config from '../../src/payload.config'
import { mergeFirms } from '../../src/lib/merge-firms'

export { mergeFirmRecords, mergeFirms } from '../../src/lib/merge-firms'

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
