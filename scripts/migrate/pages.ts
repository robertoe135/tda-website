/**
 * Step 5 of the Squarespace migration: the homepage, About, contact and timeline content.
 *
 *   pnpm migrate:pages              # fill what is empty; never overwrite
 *   pnpm migrate:pages --update     # also replace the homepage and About drafts
 *
 * Reads the fetched pages in cache/www.tillotsondesign.com/pages and writes, word for word:
 * - Homepage (draft): rows as laid out on the old site, projects and quotes in place; the
 *   videos it played are listed for review (originals come from marketing).
 * - About page (draft): one section per heading (Philosophy, Background, …).
 * - Site settings: address, phone, emails, contact intro and careers text, only where empty.
 * - Timeline: completion years from /timeline, on projects that have none (as drafts).
 *   A year that differs from the project's is not changed; it goes to the review file.
 *
 * The timeline page itself is not stored: /timeline lists published projects by year.
 * Refuses a database that is not on this machine unless --confirm-backup is passed.
 */
import 'dotenv/config'

import { readFile } from 'fs/promises'
import path from 'path'

import { HTMLElement, parse } from 'node-html-parser'
import { getPayload, type Payload } from 'payload'

import config from '../../src/payload.config'
import { normalizeName } from '../../src/hooks/preventNearDuplicates'

import { cacheDir, type ReviewRow, richText, SITE, writeReview } from './lib'

const pagesDir = path.join(cacheDir, new URL(SITE).host, 'pages')
const update = process.argv.includes('--update')

const text = (el: HTMLElement) => el.text.replace(/\s+/g, ' ').trim()

/** Elements in document order. */
function* walk(el: HTMLElement): Generator<HTMLElement> {
  for (const child of el.childNodes) {
    if (child instanceof HTMLElement) {
      yield child
      yield* walk(child)
    }
  }
}

const legacyPath = (href: string) => {
  try {
    return new URL(href, SITE).pathname.replace(/\/+$/, '').toLowerCase()
  } catch {
    return ''
  }
}

// ── parsers (exported for tests) ─────────────────────────────────────────────

export type HomeItem =
  | { kind: 'project'; path: string; name: string; video?: string; imagePath?: string }
  | { kind: 'quote'; text: string; attribution: string }
export type HomeRow = { layout: 'one' | 'two' | 'wide-narrow' | 'narrow-wide' | 'three'; items: HomeItem[] }

type Area = { row: number; col: number; rowEnd: number; colEnd: number }

/**
 * The old homepage as rows. Squarespace lays it out on a 24-column grid: each block has a
 * desktop grid area in the page's CSS, and a photo or video shares its area with the text
 * block holding the project's name and link. Blocks are paired by where they start, items
 * whose rows overlap form one row, and the column spans give the layout (13 + 9 is wide then
 * narrow). A video's address is kept so marketing can find the original.
 */
export function parseHomeRows(html: string): HomeRow[] {
  const areas = new Map<string, Area>()
  for (const media of html.matchAll(/@media \(min-width: 768px\) \{([\s\S]*?)\n {2}\}\n/g)) {
    for (const [, id, value] of media[1].matchAll(/\.(fe-block-[\w-]+) \{\s*grid-area: ([^;]+);/g)) {
      const [row, col, rowEnd, colEnd] = value.split('/').map((n) => Number(n.trim()))
      areas.set(id, { row, col, rowEnd, colEnd })
    }
  }
  const root = parse(html, { blockTextElements: { script: false, style: false, noscript: false } })
  type Slot = Area & { href?: string; imageHref?: string; name?: string; video?: string; quote?: { text: string; attribution: string } }
  const slots = new Map<string, Slot>()
  for (const block of root.querySelectorAll('main .fe-block')) {
    const id = block.classNames.split(/\s+/).find((c) => c.startsWith('fe-block-'))
    const area = id ? areas.get(id) : undefined
    if (!area) continue
    const key = `${area.row}/${area.col}`
    const slot: Slot = slots.get(key) ?? { ...area }
    slot.rowEnd = Math.max(slot.rowEnd, area.rowEnd)
    slot.colEnd = Math.max(slot.colEnd, area.colEnd)
    const href = block.querySelector('a[href]')?.getAttribute('href')
    const config = block.querySelector('[data-config-video]')?.getAttribute('data-config-video')
    const heading = block.querySelector('h3')
    if (config) {
      try {
        const url = JSON.parse(config).alexandriaUrl as string | undefined
        if (url) slot.video = url.replace('{variant}', '1920:1080')
      } catch {}
    } else if (block.querySelector('img')) {
      if (href) slot.imageHref = legacyPath(href)
    } else if (heading && /^[“"]/.test(text(heading))) {
      const next = heading.nextElementSibling
      slot.quote = {
        text: text(heading).replace(/^[“"]\s*|\s*[”"]$/g, ''),
        attribution: next ? text(next).replace(/^[-–—]\s*/, '') : '',
      }
    } else if (href) {
      slot.href = legacyPath(href)
      slot.name = text(block)
    }
    slots.set(key, slot)
  }

  const rows: { end: number; slots: Slot[] }[] = []
  for (const slot of [...slots.values()].sort((a, b) => a.row - b.row || a.col - b.col)) {
    const current = rows[rows.length - 1]
    if (current && slot.row < current.end) {
      current.slots.push(slot)
      current.end = Math.max(current.end, slot.rowEnd)
    } else rows.push({ end: slot.rowEnd, slots: [slot] })
  }

  return rows.map(({ slots: list }) => {
    const sorted = list.sort((a, b) => a.col - b.col)
    const items: HomeItem[] = sorted.flatMap((s): HomeItem[] => {
      if (s.quote) return [{ kind: 'quote', ...s.quote }]
      const path = s.href ?? s.imageHref
      return path ? [{ kind: 'project', path, name: s.name ?? '', video: s.video, imagePath: s.imageHref }] : []
    })
    const spans = sorted.map((s) => s.colEnd - s.col)
    const layout: HomeRow['layout'] =
      items.length >= 3 ? 'three' : items.length === 1 ? 'one' : Math.abs(spans[0] - spans[1]) <= 1 ? 'two' : spans[0] > spans[1] ? 'wide-narrow' : 'narrow-wide'
    return { layout, items: items.slice(0, 3) }
  })
}

/** Sections of the About page: each h2 with the paragraphs after it. */
export function parseAbout(main: HTMLElement): { heading: string; paragraphs: string[] }[] {
  const sections: { heading: string; paragraphs: string[] }[] = []
  for (const el of walk(main)) {
    if (el.tagName === 'H2') sections.push({ heading: text(el), paragraphs: [] })
    else if (el.tagName === 'P' && sections.length && text(el)) sections[sections.length - 1].paragraphs.push(text(el))
  }
  return sections.filter((s) => s.heading && s.paragraphs.length)
}

/**
 * Each project on /timeline with its year. Every entry is an image link followed by a title,
 * and a year heading sits between a group's first link and its title. So the nth link goes
 * with the nth title, and the year is the last heading above that title.
 */
export function parseTimeline(main: HTMLElement): { year: number; path: string; title: string }[] {
  const links: string[] = []
  const titles: { year: number; title: string }[] = []
  let year: number | undefined
  for (const el of walk(main)) {
    if (/^H[1-6]$/.test(el.tagName) && /^\d{4}$/.test(text(el))) year = Number(text(el))
    else if (el.tagName === 'A' && el.getAttribute('href')) links.push(legacyPath(el.getAttribute('href')!))
    else if (el.tagName === 'P' && text(el) && year) titles.push({ year, title: text(el) })
  }
  if (links.length !== titles.length) throw new Error(`Timeline: ${links.length} links but ${titles.length} titles`)
  return links.map((p, i) => ({ path: p, ...titles[i] }))
}

export type Contact = {
  intro?: string
  street?: string
  suite?: string
  city?: string
  region?: string
  postalCode?: string
  phone?: string
  email?: string
  careers?: string
}

/** The contact page's labelled blocks (ADDRESS, PHONE NUMBER, …), as written. */
export function parseContact(lines: string[]): Contact {
  const after = (label: RegExp) => {
    const i = lines.findIndex((l) => label.test(l))
    return i >= 0 ? lines[i + 1] : undefined
  }
  const address = after(/^ADDRESS$/)?.replace(/\s+/g, ' ')
  const m = address?.match(/^(.*?)\s+((?:Ste\.?|Suite)\s*\S+)\s+(.+?),\s*([A-Z]{2})\s+(\d{5})$/)
  return {
    intro: lines[0] && !/^ADDRESS$/.test(lines[0]) ? lines[0] : undefined,
    ...(m ? { street: m[1], suite: m[2], city: m[3], region: m[4], postalCode: m[5] } : {}),
    phone: after(/^PHONE/),
    email: lines.find((l) => /^[^\s@]+@[^\s@]+\.[a-z]+$/i.test(l)),
    careers: after(/^CAREERS/),
  }
}

// ── main ─────────────────────────────────────────────────────────────────────

const loadMain = async (file: string) => {
  const html = await readFile(path.join(pagesDir, file), 'utf8')
  const main = parse(html, { blockTextElements: { script: false, style: false, noscript: false } }).querySelector('main')
  if (!main) throw new Error(`No <main> in ${file}`)
  return main
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

async function projectByName(payload: Payload, name: string) {
  const all = await payload.find({ collection: 'projects', draft: true, pagination: false, depth: 0, select: { name: true, year: true } })
  const matches = all.docs.filter((p) => normalizeName(p.name) === normalizeName(name))
  return matches.length === 1 ? matches[0] : undefined
}

async function projectByPath(payload: Payload, legacy: string) {
  const found = await payload.find({
    collection: 'projects',
    where: { 'legacyUrls.path': { equals: legacy } },
    draft: true,
    limit: 1,
    depth: 0,
    select: { name: true, year: true },
  })
  return found.docs[0]
}

async function main() {
  assertLocalDatabase()
  const payload = await getPayload({ config })
  const review: ReviewRow[] = []
  const flag = (url: string, field: string, asWritten: string, note: string) =>
    review.push({ url: `${SITE}${url}`, field, asWritten, suggested: '', note })

  // Homepage: rows as laid out on the old site
  // Review rows are always collected; only the writing is skipped when content exists, so a
  // second run never drops them from review.csv.
  const home = await payload.findGlobal({ slug: 'home', draft: true })
  {
    const html = await readFile(path.join(pagesDir, 'index.html'), 'utf8')
    const rows = []
    for (const row of parseHomeRows(html)) {
      const items = []
      for (const item of row.items) {
        if (item.kind === 'quote') {
          items.push({ blockType: 'quote' as const, text: item.text, attribution: item.attribution })
          continue
        }
        // The project's own link first; the old site has typos in some (london-mirhraeum), so
        // fall back to the name shown on the tile, matched exactly once normalized.
        const project = (await projectByPath(payload, item.path)) ?? (item.name ? await projectByName(payload, item.name) : undefined)
        if (!project) {
          flag('/', 'homepage project', `${item.name} (${item.path})`, 'Matches no imported project; left out of its row.')
          continue
        }
        if (item.imagePath && item.imagePath !== item.path)
          flag('/', 'homepage link', `${item.name}: photo links to ${item.imagePath}`, `The name links to ${item.path}; the new tile links to ${project.name}.`)
        if (item.video)
          flag('/', 'homepage video', `${project.name}: ${item.video}`, 'The old homepage played a video here. Upload the original under Videos and pick it on this tile.')
        items.push({ blockType: 'project' as const, project: project.id })
      }
      if (!items.length) continue
      // A row that lost an item keeps a layout that fits what is left.
      const layout = items.length === 1 ? 'one' : items.length === 2 && row.layout === 'three' ? 'two' : row.layout
      rows.push({ layout, items })
    }
    if (!home.rows?.length || update) {
      await payload.updateGlobal({ slug: 'home', data: { rows }, draft: true })
      console.log(`homepage: ${rows.length} rows (draft)`)
    } else console.log('homepage: already has rows, left as is')
  }

  // About
  const about = await payload.findGlobal({ slug: 'about', draft: true })
  flag('/about-5', 'Background', 'staff of twenty-three; over 100 years of lighting expertise', 'Figures copied as written. Confirm them before publishing (Archinect differs).')
  flag('/about-5', 'About facts', '2004 Founded; WBE Certified; 100+ LEED certified projects', 'Restated from the copy for the facts row. Confirm before publishing.')
  if (!about.sections?.length || update) {
    const sections = parseAbout(await loadMain('about-5.html'))
    await payload.updateGlobal({
      slug: 'about',
      data: {
        // The opening line is the page's own first sentence; the facts restate figures the copy
        // gives (founded in 2004; WBE Certified; "over one hundred LEED certified projects").
        lede: sections[0]?.paragraphs[0]?.match(/^[^.]+\./)?.[0],
        facts: [
          { value: '2004', label: 'Founded' },
          { value: 'WBE Certified', label: 'Women owned' },
          { value: '100+', label: 'LEED certified projects' },
        ],
        sections: sections.map((s) => ({ heading: s.heading, body: richText(s.paragraphs) as never })),
      },
      draft: true,
    })
    console.log(`about: ${sections.length} sections (draft)`)
  } else console.log('about: already has sections, left as is')

  // Contact details: only empty fields
  const contactMain = await loadMain('contact.html')
  const contact = parseContact(
    contactMain.structuredText
      .split('\n')
      .map((l) => l.replace(/\s+/g, ' ').trim())
      .filter(Boolean),
  )
  const settings = await payload.findGlobal({ slug: 'siteSettings' })
  const address = settings.address ?? {}
  await payload.updateGlobal({
    slug: 'siteSettings',
    data: {
      intro: settings.intro || contact.intro,
      address: {
        street: address.street || contact.street,
        suite: address.suite || contact.suite,
        city: address.city || contact.city,
        region: address.region || contact.region,
        postalCode: address.postalCode || contact.postalCode,
      },
      phone: settings.phone || contact.phone,
      generalEmail: settings.generalEmail || contact.email,
      pressEmail: settings.pressEmail || contact.email,
      careersText: settings.careersText || (contact.careers ? (richText([contact.careers]) as never) : undefined),
    },
  })
  console.log('site settings: empty contact fields filled')
  if (!settings.careersLink)
    flag('/contact', 'careers link', 'Submission Form', 'The old site used a Squarespace form. Decide where applications go and add the link in Site settings.')
  if (contact.suite) flag('/contact', 'address', contact.suite, 'Copied as written. Confirm the canonical form (open question 9: "Suite 703").')

  // Timeline years
  let filled = 0
  for (const { year, path: legacy } of parseTimeline(await loadMain('timeline.html'))) {
    const project = await projectByPath(payload, legacy)
    if (!project) flag('/timeline', 'timeline project', legacy, 'Timeline link matches no imported project.')
    else if (!project.year) {
      await payload.update({ collection: 'projects', id: project.id, data: { year }, draft: true })
      filled++
    } else if (project.year !== year)
      flag('/timeline', 'year', `${project.name}: ${year} on the timeline`, `Project page says ${project.year}. Left at ${project.year}; confirm which is right.`)
  }
  console.log(`timeline: ${filled} missing years filled (drafts)`)

  const count = await writeReview('pages', review)
  console.log(`${review.length} rows for review (review.csv now has ${count}).`)
  process.exit(0)
}

if (process.argv[1]?.endsWith('pages.ts')) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
