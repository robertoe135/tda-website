/**
 * One-off repair: the first import saved comma-separated credits ("Brett Beyer, Iwan Baan")
 * as single photographers. This creates each person (or finds them, by normalized name) and
 * deletes the combined record, unless an image already uses it; those are listed instead.
 * Spellings are kept exactly as written on the old site.
 *
 *   pnpm migrate:split-photographers               # list what would change
 *   pnpm migrate:split-photographers --write       # change it (--confirm-backup if not local)
 */
import 'dotenv/config'

import { getPayload } from 'payload'

import config from '../../src/payload.config'
import { normalizeName } from '../../src/hooks/preventNearDuplicates'

import { splitCredit } from './lib'

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
  console.log(write ? `\nSplit ${combined.length} records; ${created} photographers added.` : `\n${combined.length} to split. Rerun with --write.`)
  process.exit(0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
