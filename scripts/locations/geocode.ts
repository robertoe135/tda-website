/**
 * Fill in each location's coordinates for the portfolio map, by looking the city up on
 * OpenStreetMap (free, no account). Read-only unless --write:
 *
 *   pnpm locations:geocode                          # list what it finds
 *   pnpm locations:geocode --write --confirm-backup # save the clear matches
 *
 * Looks at locations that projects use and that have no coordinates yet (--all: every location;
 * --redo: also ones that have them). A clear match is a city, town or village with the location's
 * name; anything else is listed as "check" and not saved unless --include-check is passed, so a
 * wrong guess never reaches the map. Names are never changed.
 *
 * Writes scripts/locations/out/geocode.csv (not committed). Refuses a database that is not on
 * this machine unless --confirm-backup is passed. One lookup a second, as the service asks.
 */
import '../env'

import { mkdir, writeFile } from 'fs/promises'
import path from 'path'

import { getPayload } from 'payload'

import config from '../../src/payload.config'
import { dbHost, isLocalDatabase } from '../media/upload'
import { csv } from '../migrate/lib'

import { type Found, geocode, nominatim, type Place } from './geocode-lib'

const OUT = path.join(path.dirname(new URL(import.meta.url).pathname), 'out', 'geocode.csv')

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

  await mkdir(path.dirname(OUT), { recursive: true })
  await writeFile(
    OUT,
    csv(
      found.map((f) => ({
        location: f.place.displayName ?? f.place.city,
        result: f.result,
        lat: f.lat,
        lng: f.lng,
        found: f.found,
        saved: write && save(f) ? 'yes' : 'no',
        note: f.note,
      })),
      ['location', 'result', 'lat', 'lng', 'found', 'saved', 'note'],
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
      : 'Nothing saved. Rerun with --write --confirm-backup to save the clear matches.',
  )
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
