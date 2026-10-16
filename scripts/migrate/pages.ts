/**
 * Step 5 of the Squarespace migration: the homepage, About, contact and timeline content.
 *
 *   pnpm migrate:pages              # fill what is empty; never overwrite
 *   pnpm migrate:pages --update     # also replace the homepage and About drafts
 *
 * Reads the fetched pages in cache/www.tillotsondesign.com/pages and writes, word for word:
 * - Homepage (draft): the projects in the old order, with the two quotes where they stood.
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

export type HomeItem = { kind: 'project'; path: string } | { kind: 'quote'; text: string; attribution: string }

/** Project links and quotes in page order. A quote is an h3 in curly quotes plus a "-Name" line. */
export function parseHome(main: HTMLElement): HomeItem[] {
  const items: HomeItem[] = []
  const seen = new Set<string>()
  for (const el of walk(main)) {
    if (el.tagName === 'A') {
      const p = legacyPath(el.getAttribute('href') ?? '')
      if (p && p !== '/' && !p.startsWith('/s/') && !seen.has(p)) {
        seen.add(p)
        items.push({ kind: 'project', path: p })
      }
    } else if (el.tagName === 'H3' && /^[“"]/.test(text(el))) {
      const next = el.nextElementSibling
      const attribution = next ? text(next).replace(/^[-–—]\s*/, '') : ''
      items.push({ kind: 'quote', text: text(el).replace(/^[“"]\s*|\s*[”"]$/g, ''), attribution })
    }
  }
  return items
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

  // Homepage
  const home = await payload.findGlobal({ slug: 'home', draft: true })
  if (!home.items?.length || update) {
    const items = []
    for (const item of parseHome(await loadMain('index.html'))) {
      if (item.kind === 'quote') {
        items.push({ blockType: 'quote' as const, text: item.text, attribution: item.attribution })
        continue
      }
      const project = await projectByPath(payload, item.path)
      if (project) items.push({ blockType: 'project' as const, project: project.id })
      else flag('/', 'homepage project', item.path, 'Link on the old homepage matches no imported project.')
    }
    await payload.updateGlobal({ slug: 'home', data: { items }, draft: true })
    console.log(`homepage: ${items.length} items (draft)`)
  } else console.log('homepage: already has items, left as is')

  // About
  const about = await payload.findGlobal({ slug: 'about', draft: true })
  if (!about.sections?.length || update) {
    const sections = parseAbout(await loadMain('about-5.html'))
    await payload.updateGlobal({
      slug: 'about',
      data: { sections: sections.map((s) => ({ heading: s.heading, body: richText(s.paragraphs) as never })) },
      draft: true,
    })
    console.log(`about: ${sections.length} sections (draft)`)
    flag('/about-5', 'Background', 'staff of twenty-three; over 100 years of lighting expertise', 'Figures copied as written. Confirm them before publishing (Archinect differs).')
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
