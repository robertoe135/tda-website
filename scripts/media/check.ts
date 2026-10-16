/**
 * What the photo imports left in the database, read-only:
 *
 *   pnpm media:check
 *
 * Prints the database server, how many photos there are (and how many from the last day),
 * and which projects have photos in their draft but not yet on the live site. Use it when an
 * import said it worked and the admin or site seems not to show it.
 */
import '../env'

import { getPayload } from 'payload'

import config from '../../src/payload.config'
import { dbHost } from './upload'
import { readTouched } from './publish'

async function main() {
  const payload = await getPayload({ config })
  const since = new Date(Date.now() - 24 * 3600_000).toISOString()
  const media = await payload.count({ collection: 'media' })
  const recent = await payload.count({ collection: 'media', where: { createdAt: { greater_than: since } } })
  const withPhotos = { exists: true }
  const drafts = await payload.find({
    collection: 'projects',
    draft: true,
    pagination: false,
    depth: 0,
    where: { heroImage: withPhotos },
    select: { name: true, slug: true, _status: true },
  })
  const live = await payload.find({ collection: 'projects', pagination: false, depth: 0, where: { heroImage: withPhotos }, select: { name: true } })
  const liveNames = new Set(live.docs.map((d) => d.name))
  const waiting = drafts.docs.filter((d) => !liveNames.has(d.name))
  const sample = await payload.find({ collection: 'media', sort: '-createdAt', limit: 1, depth: 0 })

  console.log(`Database server: ${dbHost()}`)
  console.log(`Blob storage: ${process.env.BLOB_READ_WRITE_TOKEN ? 'token set' : 'NO TOKEN: files went to this computer'}`)
  console.log(`Photos in Media: ${media.totalDocs} (${recent.totalDocs} added in the last 24 hours)`)
  if (sample.docs[0]) console.log(`Newest photo: ${sample.docs[0].url}`)
  console.log(`Projects with photos: ${drafts.docs.length} in the admin (latest draft), ${live.docs.length} on the live site`)
  if (waiting.length) {
    console.log(`\nWaiting to be published (${waiting.length}), e.g.:`)
    for (const d of waiting.slice(0, 5)) console.log(`  ${d.name}  →  /admin/collections/projects?search=${encodeURIComponent(d.name)}`)
  }
  console.log(`\nProjects listed for pnpm media:publish on this computer: ${(await readTouched()).length}`)
  process.exit(0)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
