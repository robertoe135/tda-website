/**
 * Removes placeholder photos and videos left from building the site ("Placeholder photograph 1",
 * credited "[Placeholder Photographer]"), and takes them off the projects that show them:
 *
 *   pnpm migrate:remove-placeholders                           # list, change nothing
 *   pnpm migrate:remove-placeholders --write                   # local database
 *   pnpm migrate:remove-placeholders --write --confirm-backup  # another database, after a backup
 *
 * A placeholder is a photo or video whose description starts with "Placeholder", or a photo
 * credited "[Placeholder…]". Projects lose it on their live version and latest draft alike (a
 * pending draft stays unpublished). A placeholder still used anywhere else (a headshot, the
 * homepage, About, a newsletter) is listed and kept: replace it there first.
 */
import '../env'

import { fileURLToPath } from 'url'

import { getPayload, type Payload, type Where } from 'payload'

import config from '../../src/payload.config'
import type { Project } from '../../src/payload-types'
import { changeProject } from './versions'

type Ref = number | { id: number } | null | undefined
const idOf = (r: Ref) => (r && typeof r === 'object' ? r.id : r)

export const isPlaceholder = (m: { alt?: string | null; credit?: string | null }) =>
  /^placeholder\b/i.test(m.alt?.trim() ?? '') || /^\[placeholder/i.test(m.credit?.trim() ?? '')

export async function removePlaceholders(payload: Payload, write: boolean) {
  const log: string[] = []
  const media = (await payload.find({ collection: 'media', pagination: false, depth: 0, select: { alt: true, credit: true, filename: true } })).docs.filter(isPlaceholder)
  const videos = (await payload.find({ collection: 'videos', pagination: false, depth: 0, select: { alt: true, credit: true, poster: true, filename: true } })).docs.filter(isPlaceholder)
  const mediaIds = media.map((m) => m.id)
  if (!mediaIds.length && !videos.length) return { log: ['No placeholders.'], removed: 0 }

  // Projects: live versions and latest drafts that show one.
  const where: Where = { or: [{ heroImage: { in: mediaIds } }, { 'gallery.image': { in: mediaIds } }] }
  const [drafts, live] = await Promise.all([
    payload.find({ collection: 'projects', draft: true, pagination: false, depth: 0, where, select: { name: true } }),
    payload.find({ collection: 'projects', pagination: false, depth: 0, where: { and: [where, { _status: { equals: 'published' } }] }, select: { name: true } }),
  ])
  const projects = new Map([...drafts.docs, ...live.docs].map((p) => [p.id, p.name]))
  const strip = (v: Project) => {
    const hero = mediaIds.includes(idOf(v.heroImage as Ref) as number)
    const gallery = (v.gallery ?? []).filter((g) => !mediaIds.includes(idOf(g.image as Ref) as number))
    if (!hero && gallery.length === (v.gallery ?? []).length) return undefined
    return { ...(hero ? { heroImage: null } : {}), gallery } as Partial<Project>
  }
  for (const [id, name] of projects) {
    log.push(`"${name}": placeholder photos taken off`)
    if (write) await changeProject(payload, id, strip)
  }

  // Anything else still using one keeps it, for a person to replace.
  const usedElsewhere = new Set<number>()
  const check = async (label: string, found: Promise<{ docs: unknown[] }>, ids: (doc: never) => number[]) => {
    for (const doc of (await found).docs)
      for (const id of ids(doc as never))
        if (mediaIds.includes(id)) {
          usedElsewhere.add(id)
          log.push(`kept photo ${id}: still used by ${label}`)
        }
  }
  await check('a person’s headshot', payload.find({ collection: 'people', draft: true, pagination: false, depth: 0, where: { headshot: { in: mediaIds } } }), (p: { headshot?: Ref }) => [idOf(p.headshot) as number])
  const home = JSON.stringify(await payload.findGlobal({ slug: 'home', draft: true, depth: 0 }))
  const about = JSON.stringify(await payload.findGlobal({ slug: 'about', draft: true, depth: 0 }))
  const newsletters = JSON.stringify((await payload.find({ collection: 'newsletters', draft: true, pagination: false, depth: 0 })).docs)
  for (const id of mediaIds)
    for (const [label, text] of [['the homepage', home], ['About', about], ['a newsletter', newsletters]] as const)
      if (new RegExp(`"(image|media|poster)":${id}\\b`).test(text)) {
        usedElsewhere.add(id)
        log.push(`kept photo ${id}: still used by ${label}`)
      }

  // Placeholder videos (and their stills) not on the homepage.
  const doomedVideos = videos.filter((v) => !new RegExp(`"video":${v.id}\\b`).test(home))
  for (const v of videos.filter((x) => !doomedVideos.includes(x))) log.push(`kept video "${v.alt}": still on the homepage`)
  for (const v of doomedVideos) {
    log.push(`video "${v.alt}" (${v.filename}) deleted`)
    if (write) await payload.delete({ collection: 'videos', id: v.id })
  }
  const posters = new Set(videos.filter((v) => !doomedVideos.includes(v)).map((v) => idOf(v.poster as Ref)))
  let removed = doomedVideos.length
  for (const m of media.filter((m) => !usedElsewhere.has(m.id) && !posters.has(m.id))) {
    log.push(`photo "${m.alt}" (${m.filename}) deleted`)
    if (write) await payload.delete({ collection: 'media', id: m.id })
    removed++
  }
  return { log, removed }
}

async function main() {
  const write = process.argv.includes('--write')
  if (write) {
    const { isLocalDatabase } = await import('../media/upload')
    if (!isLocalDatabase() && !process.argv.includes('--confirm-backup')) {
      console.error('DATABASE_URL is not this machine. Take a fresh backup (a Neon branch), then rerun with --confirm-backup.')
      process.exit(1)
    }
  }
  const payload = await getPayload({ config })
  const { log, removed } = await removePlaceholders(payload, write)
  for (const line of log) console.log(line)
  console.log(write ? `${removed} placeholder file(s) removed.` : `${removed} placeholder file(s) would be removed. Rerun with --write.`)
  process.exit(0)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
