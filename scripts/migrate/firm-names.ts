/**
 * Apply TDA's decisions on firm names from firm-names.csv: one main name per firm, its other
 * names as aliases. For each row, every record whose name or alias is one of the names is
 * merged into one, which carries the main name (renamed if needed; its web address stays, so
 * old links work). Safe to run again: a second run changes nothing.
 *
 *   pnpm migrate:firm-names            # list what would change
 *   pnpm migrate:firm-names --write    # change it (--confirm-backup if not local)
 *
 * Edit firm-names.csv to add decisions; names in it are written exactly as TDA wants them.
 */
import '../env'

import { readFile } from 'fs/promises'
import path from 'path'

import { getPayload, type Payload } from 'payload'

import config from '../../src/payload.config'
import { normalizeName } from '../../src/hooks/preventNearDuplicates'
import type { Firm } from '../../src/payload-types'
import { parseCsv } from '../team/lib'

import { migrateDir } from './lib'
import { mergeFirmRecords } from './merge-firms'

export type FirmNames = { main: string; others: string[] }

export const parseFirmNames = (text: string): FirmNames[] =>
  parseCsv(text)
    .slice(1)
    .map(([main, others = '']) => ({
      main: main.trim(),
      others: others
        .split(';')
        .map((n) => n.trim())
        .filter(Boolean),
    }))
    .filter((r) => r.main)

const projectCount = async (payload: Payload, id: number) =>
  (
    await payload.count({
      collection: 'projects',
      where: { or: [{ architects: { in: [id] } }, { 'credits.firms': { in: [id] } }] },
    })
  ).totalDocs

/** Apply one decision. Returns what was (or would be) done, one line per change. */
export async function applyFirmNames(payload: Payload, { main, others }: FirmNames, write: boolean): Promise<string[]> {
  const names = [main, ...others]
  const keys = names.map(normalizeName)
  const found = await payload.find({
    collection: 'firms',
    pagination: false,
    depth: 0,
    where: { or: [{ normalizedName: { in: keys } }, { 'aliases.normalizedName': { in: keys } }] },
  })
  const records = found.docs as Firm[]
  if (!records.length) return [`${main}: no firm uses any of these names; nothing to do.`]

  // Keep the record already named as the main name, else the one on the most projects.
  const counts = new Map<number, number>()
  for (const r of records) counts.set(r.id, await projectCount(payload, r.id))
  const keep =
    records.find((r) => normalizeName(r.name) === normalizeName(main)) ??
    [...records].sort((a, b) => counts.get(b.id)! - counts.get(a.id)! || a.id - b.id)[0]
  const log: string[] = []

  // Other records first: the merge adds their names as aliases.
  let current: Firm = keep
  for (const other of records.filter((r) => r.id !== keep.id)) {
    log.push(`${main}: merge "${other.name}" (${counts.get(other.id)} project(s)) into "${keep.name}"`)
    await mergeFirmRecords(payload, current, other, write)
    if (write) current = await payload.findByID({ collection: 'firms', id: keep.id, depth: 0 })
  }

  // Then the main name, with the old name kept as an alias, and every listed other name.
  const aliasNames = [...(current.aliases ?? []).map((a) => a.name)]
  if (normalizeName(current.name) !== normalizeName(main)) {
    log.push(`${main}: rename "${current.name}" to "${main}" (address /${current.slug} stays)`)
    aliasNames.push(current.name)
  }
  for (const n of others) if (!aliasNames.some((a) => normalizeName(a) === normalizeName(n))) aliasNames.push(n)
  const aliases = aliasNames.filter((n) => normalizeName(n) !== normalizeName(main)).map((name) => ({ name }))
  const before = (current.aliases ?? []).map((a) => normalizeName(a.name)).sort().join('|')
  const after = aliases.map((a) => normalizeName(a.name)).sort().join('|')
  if (current.name !== main || before !== after) {
    if (before !== after) log.push(`${main}: other names ${aliases.map((a) => `"${a.name}"`).join(', ')}`)
    if (write) await payload.update({ collection: 'firms', id: keep.id, data: { name: main, aliases } })
  }
  return log.length ? log : [`${main}: already as decided.`]
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
  const write = process.argv.includes('--write')
  if (write) assertLocalDatabase()
  const decisions = parseFirmNames(await readFile(path.join(migrateDir, 'firm-names.csv'), 'utf8'))
  const payload = await getPayload({ config })
  for (const d of decisions) for (const line of await applyFirmNames(payload, d, write)) console.log(line)
  if (!write) console.log('\nNothing changed. Rerun with --write.')
  process.exit(0)
}

if (process.argv[1]?.endsWith('firm-names.ts')) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
