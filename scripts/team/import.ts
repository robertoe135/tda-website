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

import { getPayload, type Where } from 'payload'

import config from '../../src/payload.config'
import { normalizeName } from '../../src/hooks/preventNearDuplicates'
import { similarity } from '../migrate/lib'

import { type Credit, parseCsv, planTeams, type Problem, type ProjectRef, sortTeam } from './lib'

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

const describeRef = (ref: ProjectRef) => ('slug' in ref ? ref.slug : ref.legacyPath)

async function main() {
  if (!file) {
    console.error('Usage: pnpm team:import <file.csv> [--write] [--create-people] [--confirm-backup]')
    process.exit(1)
  }
  if (write) assertLocalDatabase()

  const { teams, refs, problems } = planTeams(parseCsv(await readFile(file, 'utf8')))
  const payload = await getPayload({ config })

  // People already in the admin, by normalized name.
  const everyone = await payload.find({ collection: 'people', draft: true, pagination: false, depth: 0 })
  const byName = new Map(everyone.docs.map((p) => [normalizeName(p.name), p]))
  const toCreate = new Map<string, Credit>()
  const warnings: Problem[] = []

  for (const credit of [...teams.values()].flat()) {
    const key = normalizeName(credit.person)
    const person = byName.get(key)
    if (person) {
      if (!person.showOnSite) {
        problems.push({
          line: credit.line,
          message: `${person.name} has "Show on site" off. Turn it on in the admin (with their OK) or remove the row.`,
        })
      }
      if (credit.former && person.isCurrent) {
        warnings.push({ line: credit.line, message: `${person.name} is marked former staff here but current in the admin. The admin wins.` })
      }
      continue
    }
    if (toCreate.has(key)) continue
    const near = everyone.docs.find((p) => similarity(normalizeName(p.name), key) >= 0.8)
    if (near) {
      problems.push({ line: credit.line, message: `"${credit.person}" is close to "${near.name}". Fix the CSV or the admin; names are not guessed.` })
    } else if (!createPeople) {
      problems.push({ line: credit.line, message: `"${credit.person}" is not in the admin. Add them there, or rerun with --create-people.` })
    } else {
      toCreate.set(key, credit)
    }
  }

  // Projects, matched on slug or on an old Squarespace address.
  // Rows naming the same project two ways (slug, old address) merge into one team.
  const projects = new Map<number, { name: string; team: Credit[] }>()
  for (const [key, ref] of refs) {
    const where: Where = 'slug' in ref ? { slug: { equals: ref.slug } } : { 'legacyUrls.path': { equals: ref.legacyPath } }
    const found = await payload.find({ collection: 'projects', where, draft: true, limit: 2, depth: 0, select: { name: true } })
    const rows = teams.get(key) ?? []
    if (found.docs.length !== 1) {
      problems.push({ line: rows[0]?.line ?? 0, message: `No single project matches "${describeRef(ref)}".` })
      continue
    }
    const entry = projects.get(found.docs[0].id) ?? { name: found.docs[0].name, team: [] }
    for (const c of rows) {
      const same = (o: Credit) => normalizeName(o.person) === normalizeName(c.person) && o.role === c.role
      if (!entry.team.some(same)) entry.team.push(c)
    }
    projects.set(found.docs[0].id, entry)
  }

  for (const w of warnings) console.warn(`line ${w.line}: ${w.message}`)
  if (problems.length) {
    for (const p of problems.sort((a, b) => a.line - b.line)) console.error(`line ${p.line}: ${p.message}`)
    console.error(`\n${problems.length} problem(s). Nothing was written.`)
    process.exit(1)
  }

  for (const { name, team } of projects.values()) {
    console.log(`${name}: ${sortTeam(team).map((c) => `${c.person} (${c.role})`).join(', ')}`)
  }
  for (const c of toCreate.values()) console.log(`new person (draft): ${c.person}${c.former ? ', former staff' : ''}`)

  if (!write) {
    console.log(`\nChecked ${projects.size} project(s). Nothing written; rerun with --write to save drafts.`)
    process.exit(0)
  }

  for (const [key, credit] of toCreate) {
    const created = await payload.create({
      collection: 'people',
      // Being listed in the credits CSV is marketing's decision to name the person; the draft
      // still needs publishing before the name appears anywhere.
      data: { name: credit.person, showOnSite: true, isCurrent: !credit.former },
      draft: true,
    })
    byName.set(key, created)
  }
  for (const [id, { team }] of projects) {
    await payload.update({
      collection: 'projects',
      id,
      data: { team: sortTeam(team).map((c) => ({ person: byName.get(normalizeName(c.person))!.id, role: c.role })) },
      draft: true,
    })
  }
  console.log(`\nSaved ${projects.size} project draft(s) and ${toCreate.size} new person draft(s). Publish them in the admin.`)
  process.exit(0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
