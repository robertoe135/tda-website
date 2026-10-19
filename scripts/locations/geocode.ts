/**
 * Fill in each location's coordinates for the portfolio map, by looking the city up on
 * OpenStreetMap (free, no account). Read-only unless --write:
 *
 *   pnpm locations:geocode                          # list what it finds
 *   pnpm locations:geocode --write --confirm-backup # save the clear matches
 *   pnpm locations:geocode --from scripts/locations/coordinates.csv --write --confirm-backup
 *                                                   # save a corrected list (comma, tab or ;)
 *
 * Correcting the list: set "result" to ok on a row you checked, and fix its lat and lng if
 * they are wrong (latitude first; New York is 40.71, -74.01). With --from only rows marked ok
 * are saved, nothing is looked up again, and rows that can't be saved are listed.
 *
 * Looks at locations that projects use and that have no coordinates yet (--all: every location;
 * --redo: also ones that have them). A clear match is a city, town or village with the location's
 * name; anything else is listed as "check" and not saved unless --include-check is passed, so a
 * wrong guess never reaches the map. Names are never changed.
 *
 * Each lookup writes a new scripts/locations/out/geocode-<date>.csv (not committed), so an edited
 * list is never overwritten. scripts/locations/coordinates.csv is the checked list (October 2026).
 * Refuses a database that is not on this machine unless --confirm-backup is passed. One lookup a
 * second, as the service asks.
 */
import '../env'

import { mkdir, readFile, writeFile } from 'fs/promises'
import path from 'path'

import { getPayload } from 'payload'

import config from '../../src/payload.config'
import { dbHost, isLocalDatabase } from '../media/upload'
import { csv } from '../migrate/lib'

import { parseCsv } from '../team/lib'

import { type Found, fromList, geocode, nominatim, type Place, separatorOf } from './geocode-lib'

const OUT_DIR = path.join(path.dirname(new URL(import.meta.url).pathname), 'out')
// A new file per run, so a list someone corrected is never overwritten by the next lookup.
const OUT = path.join(
  OUT_DIR,
  `geocode-${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')}.csv`,
)

async function main() {
  const args = process.argv.slice(2)
  const write = args.includes('--write')
  if (write && !isLocalDatabase() && !args.includes('--confirm-backup')) {
    console.error(`DATABASE_URL points at ${dbHost() || 'an unknown host'}, not this machine.`)
    console.error('Take a fresh backup (a Neon branch), then rerun with --confirm-backup.')
    process.exit(1)
  }

  const payload = await getPayload({ config })
  const locations = await payload.find({
    collection: 'locations',
    pagination: false,
    depth: 0,
    overrideAccess: true,
  })

  // An edited list: save the rows marked ok, as written.
  const listPath = args.includes('--from') ? args[args.indexOf('--from') + 1] : undefined
  if (listPath) {
    const text = await readFile(listPath, 'utf8')
    const [header = [], ...lines] = parseCsv(text, separatorOf(text)).filter((l) =>
      l.some((c) => c.trim()),
    )
    // Excel and Numbers often start a saved CSV with an invisible mark (BOM); drop it.
    const cols = header.map((h) =>
      h
        .replace(/^\uFEFF/, '')
        .trim()
        .toLowerCase(),
    )
    const missing = ['location', 'result', 'lat', 'lng'].filter((c) => !cols.includes(c))
    if (missing.length) {
      console.error(
        `${listPath} has no ${missing.join(', ')} column. Columns found: ${cols.join(' | ')}`,
      )
      console.error('Save it as CSV (Numbers: File > Export To > CSV), keeping the header row.')
      process.exit(1)
    }
    const rows = lines.map((l) => Object.fromEntries(cols.map((c, i) => [c, l[i] ?? ''])))
    console.log(
      `Read ${rows.length} rows, ${rows.filter((r) => r.result.trim().toLowerCase() === 'ok').length} marked ok.\n`,
    )
    const { save, problems } = fromList(rows, locations.docs)
    for (const s of save)
      console.log(`${write ? 'save ' : 'would save'}  ${s.name.padEnd(32)}  ${s.lat}, ${s.lng}`)
    for (const p of problems) console.log(`skip   ${p}`)
    if (write)
      for (const s of save)
        await payload.update({
          collection: 'locations',
          id: s.id,
          data: { lat: s.lat, lng: s.lng },
          overrideAccess: true,
        })
    console.log(
      `\n${save.length} marked ok${problems.length ? `, ${problems.length} skipped (above)` : ''}. ` +
        (write
          ? 'Saved. The map shows them at once (no redeploy).'
          : 'Nothing saved: add --write --confirm-backup.'),
    )
    process.exit(0)
  }
  const projects = await payload.find({
    collection: 'projects',
    pagination: false,
    depth: 0,
    draft: true,
    overrideAccess: true,
    select: { location: true },
  })
  const used = new Set(
    projects.docs
      .map((p) => (typeof p.location === 'object' ? p.location?.id : p.location))
      .filter(Boolean),
  )
  const places: Place[] = locations.docs
    .filter((l) => args.includes('--all') || used.has(l.id))
    .filter((l) => args.includes('--redo') || l.lat == null || l.lng == null)
    .map((l) => ({
      id: l.id,
      city: l.city,
      region: l.region,
      country: l.country,
      displayName: l.displayName,
    }))

  if (places.length === 0) {
    console.log('Every location that projects use already has coordinates.')
    process.exit(0)
  }
  console.log(
    `Looking up ${places.length} locations (about ${Math.ceil(places.length * 1.1)} seconds)...`,
  )
  const found = await geocode(places, nominatim)

  const save = (f: Found) =>
    f.result === 'ok' || (f.result === 'check' && args.includes('--include-check'))
  let saved = 0
  if (write) {
    for (const f of found.filter(save)) {
      await payload.update({
        collection: 'locations',
        id: f.place.id,
        data: { lat: Math.round(f.lat! * 1e5) / 1e5, lng: Math.round(f.lng! * 1e5) / 1e5 },
        overrideAccess: true,
      })
      saved++
    }
  }

  await mkdir(OUT_DIR, { recursive: true })
  await writeFile(
    OUT,
    csv(
      found.map((f) => ({
        id: f.place.id,
        location: f.place.displayName ?? f.place.city,
        result: f.result,
        lat: f.lat,
        lng: f.lng,
        found: f.found,
        saved: write && save(f) ? 'yes' : 'no',
        note: f.note,
      })),
      ['id', 'location', 'result', 'lat', 'lng', 'found', 'saved', 'note'],
    ),
  )

  const count = (r: Found['result']) => found.filter((f) => f.result === r).length
  for (const f of found)
    console.log(
      `${f.result.padEnd(5)}  ${(f.place.displayName ?? f.place.city).padEnd(32)}  ${f.found ?? f.note ?? ''}`,
    )
  console.log(
    `\n${count('ok')} clear, ${count('check')} to check, ${count('none')} not found. List: ${path.relative(process.cwd(), OUT)}`,
  )
  console.log(
    write
      ? `Saved ${saved}. The map shows them at once (no redeploy).`
      : `Nothing saved. Rerun with --write --confirm-backup to save the clear matches, or correct the\nlist and save it with --from ${path.relative(process.cwd(), OUT)} --write --confirm-backup.`,
  )
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
