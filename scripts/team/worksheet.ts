/**
 * A worksheet for marketing to fill in TDA's team credits, built from the projects and people
 * already on the site. Read-only: changes nothing in the database.
 *
 *   pnpm team:worksheet
 *
 * Writes two files in scripts/team/out/:
 *   team-worksheet.csv   one block of rows per project: its address, name and year, then a row
 *                        each for Principal in Charge, Project Manager and two Designers. Fill in
 *                        the person; add rows for more designers; leave unused rows empty.
 *   team-names.csv       everyone in the admin, with their title, to copy names from exactly.
 *
 * Projects that already have a team show it, so the worksheet can be re-made and corrected.
 * The filled-in worksheet goes straight into `pnpm team:import`: rows with no person are
 * skipped, and a project left blank keeps the team it has.
 */
import '../env'

import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

import { getPayload } from 'payload'

import config from '../../src/payload.config'
import { csv } from '../migrate/lib'

import { buildWorksheet, WORKSHEET_COLUMNS } from '../../src/lib/team-credits'

export const OUT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'out')
export { buildWorksheet, WORKSHEET_COLUMNS }

async function main() {
  const payload = await getPayload({ config })
  const { rows, names, projects } = await buildWorksheet(payload)
  await mkdir(OUT_DIR, { recursive: true })
  const worksheet = path.join(OUT_DIR, 'team-worksheet.csv')
  const people = path.join(OUT_DIR, 'team-names.csv')
  await writeFile(worksheet, csv(rows, WORKSHEET_COLUMNS))
  await writeFile(people, csv(names, ['name', 'title', 'current staff']))
  console.log(`${projects} projects, ${rows.length} rows: ${path.relative(process.cwd(), worksheet)}`)
  console.log(`${names.length} people to copy names from: ${path.relative(process.cwd(), people)}`)
  console.log('Fill in the person column, save as CSV, then: pnpm team:import scripts/team/out/team-worksheet.csv')
  process.exit(0)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
