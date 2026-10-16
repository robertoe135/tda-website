/**
 * The team as the old site's team page shows it: each person's name, title, group, order and
 * headshot, so the new team page starts where the old one was.
 *
 *   pnpm migrate:people                                  # list what would change
 *   pnpm migrate:people --write                          # create/update the people as drafts
 *   pnpm migrate:people --write --publish                # and publish them (the team page shows them)
 *     --confirm-backup                                   # required when DATABASE_URL is not this machine
 *
 * Reads the cached team page (pnpm migrate:fetch). Names and titles are copied exactly. A person
 * already in the admin keeps what an editor has filled in: title, group and order are only filled
 * where empty, and a headshot is added only if there is none. Everyone on the old page is public
 * there already, so "Show on site" is turned on for them. The old site has no bios, and none are
 * written: leave them for each person to supply.
 *
 * Headshots are downloaded from Squarespace at their original upload size (the photos TDA
 * uploaded), then renamed and stripped of camera data like every other upload. Anything odd
 * (a file named for someone else's initials, a "temporary" photo) goes to review.csv.
 */
import '../env'

import { createHash } from 'crypto'
import { readFile } from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

import { parse } from 'node-html-parser'
import { getPayload, type Payload } from 'payload'

import config from '../../src/payload.config'
import { toSlug } from '../../src/fields/slug'
import { normalizeName } from '../../src/hooks/preventNearDuplicates'
import type { Person } from '../../src/payload-types'

import { cacheDir, type ReviewRow, SITE, writeReview } from './lib'

export type TeamMember = { name: string; title: string; group: 'leadership' | 'design' | 'administration'; order: number; headshot?: string }

const GROUPS: Record<string, TeamMember['group']> = { leadership: 'leadership', 'design team': 'design', administration: 'administration' }

/**
 * The team page is a run of blocks: a group heading, then for each person an image block and a
 * text block "Name, Title". Each name takes the image just before it.
 */
export function parseTeamPage(html: string): TeamMember[] {
  const root = parse(html)
  const people: TeamMember[] = []
  let group: TeamMember['group'] | undefined
  let image: string | undefined
  for (const block of root.querySelectorAll('.fe-block')) {
    const text = block.querySelector('[data-sqsp-text-block-content]')
    const img = block.querySelector('img[data-src]')
    if (img && !text) {
      // The original upload: Squarespace's address without its ?format= resizing.
      image = img.getAttribute('data-src')?.split('?')[0]
      continue
    }
    if (!text) continue
    const line = text.text.replace(/\s+/g, ' ').trim()
    const heading = GROUPS[line.toLowerCase()]
    if (heading) {
      group = heading
      image = undefined
      continue
    }
    const m = line.match(/^([^,]{2,60}),\s*(.{2,80})$/)
    if (!m || !group) continue
    people.push({ name: m[1].trim(), title: m[2].trim(), group, order: people.filter((p) => p.group === group).length + 1, headshot: image })
    image = undefined
  }
  return people
}

const initials = (name: string) =>
  name
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase())
    .join('')

/** Notes on a headshot file name: someone else's initials, or marked temporary. */
export function headshotNotes(person: TeamMember): string[] {
  if (!person.headshot) return ['No headshot on the old team page.']
  const file = decodeURIComponent(person.headshot.split('/').pop() ?? '').replace(/\+/g, ' ')
  const notes: string[] = []
  const lead = file.match(/^([A-Z]{2,4})(?=[\s_+-]|$)/)?.[1]
  // "TDA_Noor…" is the firm's prefix, not someone's initials.
  if (lead && lead !== 'TDA' && !initials(person.name).startsWith(lead)) notes.push(`The headshot file is named "${file}": check it is ${person.name}.`)
  if (/temp/i.test(file)) notes.push(`The headshot file is named "${file}": it may be a temporary photo.`)
  return notes
}

type Fetch = (url: string) => Promise<{ ok: boolean; status: number; headers: { get(name: string): string | null }; arrayBuffer(): Promise<ArrayBuffer> }>

export async function applyTeam(payload: Payload, team: TeamMember[], options: { write: boolean; publish: boolean; fetchImpl?: Fetch }) {
  const fetchImpl = options.fetchImpl ?? (fetch as unknown as Fetch)
  const review: ReviewRow[] = []
  const flag = (field: string, asWritten: string, note: string) => review.push({ url: `${SITE}/team`, field, asWritten, suggested: '', note })
  const log: string[] = []

  for (const member of team) {
    for (const note of headshotNotes(member)) flag('headshot', member.name, note)
    const slug = toSlug(member.name)!
    const existing = (
      await payload.find({
        collection: 'people',
        draft: true,
        limit: 1,
        depth: 0,
        where: { or: [{ slug: { equals: slug } }, { name: { equals: member.name } }] },
      })
    ).docs[0] as Person | undefined

    const changes: Partial<Person> = {}
    const said: string[] = []
    if (!existing) said.push('new')
    if (!existing?.title) changes.title = member.title
    if (!existing?.group) changes.group = member.group
    if (existing?.order == null) changes.order = member.order
    if (!existing?.showOnSite) {
      changes.showOnSite = true
      said.push('shown on site')
    }
    if (existing && existing.isCurrent === false) flag('current staff', member.name, 'On the old team page, but marked as former staff in the admin. Kept as it is.')
    if (existing?.title && normalizeName(existing.title) !== normalizeName(member.title))
      flag('title', member.name, `The admin says "${existing.title}"; the old team page says "${member.title}". Kept the admin's.`)
    const needsHeadshot = !existing?.headshot && Boolean(member.headshot)
    if (needsHeadshot) said.push('headshot')
    const filled = Object.keys(changes).filter((k) => !['showOnSite'].includes(k))
    if (existing && filled.length) said.push(`fills ${filled.join(', ')}`)
    if (options.publish && existing?._status !== 'published') said.push('published')

    if (!said.length) continue
    log.push(`${member.name}: ${said.join('; ')}`)
    if (!options.write) continue

    if (needsHeadshot) {
      try {
        changes.headshot = await uploadHeadshot(payload, member, fetchImpl)
      } catch (error) {
        flag('headshot', member.name, `Could not copy the headshot: ${(error as Error).message}. Add it by hand.`)
      }
    }
    const data = { ...changes, ...(options.publish ? { _status: 'published' as const } : {}) }
    if (existing) {
      // Publishing a draft publishes all of it, so start from the latest draft.
      const { id: _id, createdAt: _c, updatedAt: _u, ...current } = existing
      await payload.update({ collection: 'people', id: existing.id, draft: !options.publish, data: { ...(options.publish ? current : {}), ...data } as never })
    } else {
      await payload.create({
        collection: 'people',
        draft: !options.publish,
        data: { name: member.name, slug, isCurrent: true, title: member.title, group: member.group, order: member.order, ...data } as never,
      })
    }
  }
  return { log, review }
}

async function uploadHeadshot(payload: Payload, member: TeamMember, fetchImpl: Fetch): Promise<number> {
  const res = await fetchImpl(member.headshot!)
  if (!res.ok) throw new Error(`Squarespace answered ${res.status}`)
  const data = Buffer.from(await res.arrayBuffer())
  const mimetype = (res.headers.get('content-type') ?? '').split(';')[0] || 'image/jpeg'
  if (!mimetype.startsWith('image/')) throw new Error(`not an image (${mimetype})`)
  // One upload per person and photo, so a second run reuses it.
  const sourceHash = createHash('sha256').update(`person:${toSlug(member.name)}\n`).update(data).digest('hex')
  const found = await payload.find({ collection: 'media', where: { sourceHash: { equals: sourceHash } }, limit: 1, depth: 0 })
  if (found.docs[0]) return found.docs[0].id
  const ext = mimetype === 'image/png' ? 'png' : 'jpg'
  const media = await payload.create({
    collection: 'media',
    data: { alt: member.name, sourceHash },
    file: { data, mimetype, name: `headshot.${ext}`, size: data.length },
  })
  return media.id
}

async function main() {
  const write = process.argv.includes('--write')
  const publish = process.argv.includes('--publish')
  if (write) {
    const { assertSafeTarget } = await import('../media/upload')
    assertSafeTarget(process.argv.includes('--confirm-backup'))
  }
  const html = await readFile(path.join(cacheDir, new URL(SITE).host, 'pages', 'team.html'), 'utf8').catch(() => '')
  if (!html) {
    console.error('The old team page is not cached. Run pnpm migrate:fetch first.')
    process.exit(1)
  }
  const team = parseTeamPage(html)
  const payload = await getPayload({ config })
  const { log, review } = await applyTeam(payload, team, { write, publish })
  for (const line of log) console.log(`  ${line}`)
  const total = await writeReview('people', review)
  console.log(`\n${team.length} people on the old team page; ${log.length} ${write ? 'changed' : 'to change'}.`)
  console.log(`${review.length} rows for marketing in scripts/migrate/review.csv (now ${total}).`)
  console.log(write ? (publish ? 'Published: the team page shows them now.' : 'Saved as drafts. Publish them in the admin, or rerun with --publish.') : 'Nothing was written. Rerun with --write.')
  process.exit(0)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
