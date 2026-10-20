/**
 * Import TDA team credits (Principal in Charge, Project Manager, Designer) from a CSV that
 * marketing assembles. See README.md in this folder for the columns.
 *
 *   pnpm team:import path/to/team.csv                    # check only: prints the plan, writes nothing
 *   pnpm team:import path/to/team.csv --write            # save the teams as project drafts
 *   pnpm team:import path/to/team.csv --write --create-people
 *                                                        # also create people not yet in the admin
 *
 * All or nothing: if any row has a problem, nothing is written and every problem is listed.
 * For each project in the file, its TDA team becomes exactly the rows for it; projects not in
 * the file are left alone. Projects are saved as drafts, so the live site changes only when
 * someone publishes them in the admin. New people are drafts too.
 *
 * Names are never corrected: a name close to an existing person's ("Jon Smith" vs "John
 * Smith") stops the import so a person decides which is right.
 *
 * Refuses a database that is not on this machine unless --confirm-backup is passed.
 * Future source: a manual, one-way export from the internal TDA app into this same CSV.
 * This script never connects to that app.
 */
import '../env'

import { readFile } from 'fs/promises'

import { getPayload } from 'payload'

import config from '../../src/payload.config'
import { checkTeamCredits, ROLE_LABELS, saveTeamCredits } from '../../src/lib/team-credits'

const args = process.argv.slice(2)
const file = args.find((a) => !a.startsWith('--'))
const write = args.includes('--write')
const createPeople = args.includes('--create-people')

function assertLocalDatabase() {
  const url = process.env.DATABASE_URL ?? ''
  const host = (() => {
    try {
      return new URL(url).hostname
    } catch {
      return ''
    }
  })()
  if (['localhost', '127.0.0.1', '::1'].includes(host) || args.includes('--confirm-backup')) return
  console.error(`DATABASE_URL points at ${host || 'an unknown host'}, not this machine.`)
  console.error('Take a fresh backup of that database, then rerun with --confirm-backup.')
  process.exit(1)
}

async function main() {
  if (!file) {
    console.error('Usage: pnpm team:import <file.csv> [--write] [--create-people] [--confirm-backup]')
    process.exit(1)
  }
  if (write) assertLocalDatabase()
  const payload = await getPayload({ config })
  const plan = await checkTeamCredits(payload, await readFile(file, 'utf8'), { createPeople })

  for (const w of plan.warnings) console.warn(`line ${w.line}: ${w.message}`)
  if (plan.problems.length) {
    for (const p of plan.problems) console.error(`line ${p.line}: ${p.message}`)
    console.error(`\n${plan.problems.length} problem(s). Nothing was written.`)
    process.exit(1)
  }
  for (const { name, team } of plan.projects) console.log(`${name}: ${team.map((c) => `${c.person} (${ROLE_LABELS[c.role]})`).join(', ')}`)
  for (const c of plan.newPeople) console.log(`new person (draft): ${c.person}${c.former ? ', former staff' : ''}`)
  if (!write) {
    console.log(`\nChecked ${plan.projects.length} project(s). Nothing written; rerun with --write to save drafts.`)
    process.exit(0)
  }
  const saved = await saveTeamCredits(payload, plan)
  console.log(`\nSaved ${saved.projects} project draft(s) and ${saved.people} new person draft(s). Publish them in the admin.`)
  process.exit(0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
