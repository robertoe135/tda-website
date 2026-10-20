/**
 * Step 3 of the Squarespace migration: turn the fetched pages into structured data.
 *
 *   pnpm migrate:extract
 *
 * Reads cache/www.tillotsondesign.com/pages/ (from `pnpm migrate:fetch`) and
 * out/url-inventory.csv. Writes, all gitignored because they hold client names and raw
 * image filenames:
 *   cache/www.tillotsondesign.com/extracted/projects.json   one record per project
 *   cache/www.tillotsondesign.com/extracted/people.json     the team page
 *   cache/www.tillotsondesign.com/extracted/firms.json      every firm spelling, grouped
 *   cache/www.tillotsondesign.com/extracted/site.json       contact details and About text
 * and out/review-extract.csv (committed, merged into review.csv), which never contains
 * owner/client names or image filenames.
 *
 * Text is copied exactly as written. Where two pages disagree, both values are kept and the
 * conflict goes to review.csv; nothing is corrected here.
 */
import { mkdir, readdir, readFile, writeFile } from 'fs/promises'
import path from 'path'

import { HTMLElement, parse } from 'node-html-parser'

import { normalizeName } from '../../src/hooks/preventNearDuplicates'

import { ARCHITECT_ROLES, FIRM_ROLES, type Role, roleFor } from './credit-labels'
import { MANUAL_MERGES } from './merges'
import { cacheDir, outDir, type ReviewRow, similarity, SITE, writeReview } from './lib'

const siteDir = path.join(cacheDir, new URL(SITE).host)
const pagesDir = path.join(siteDir, 'pages')
const extractedDir = path.join(siteDir, 'extracted')

const US_STATES = new Set(
  'AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY PR'.split(
    ' ',
  ),
)

// ── types ────────────────────────────────────────────────────────────────────

export type Location = { asWritten: string; city?: string; region?: string; country?: string }
export type Credit = { label: string; role: Role; value: string; values: string[] }
export type Image = { url: string; alt: string; filename: string }
export type PressItem = { title: string; outlet: string; url?: string }

export type ProjectRecord = {
  key: string // canonical project slug, or credits path for credits-only projects
  name: string
  legacyPaths: string[]
  typologies: string[]
  featured: boolean
  label?: string // the old pipe-delimited line, as written
  location?: Location
  labelFirms: string[]
  description: string[]
  heroImage?: Image
  gallery: Image[]
  press: PressItem[]
  creditsPath?: string
  credits?: {
    name: string
    location?: Location
    completed?: string
    area?: string
    sustainabilityStatus?: string
    owner?: string
    photography: string[]
    awards: { year?: number; text: string }[]
    entries: Credit[]
  }
  onTheBoards?: boolean
}

// ── html helpers ─────────────────────────────────────────────────────────────

const PARSE_OPTIONS = { blockTextElements: { script: false, style: false, noscript: false } }

const loadMain = async (file: string): Promise<HTMLElement | undefined> => {
  const html = await readFile(path.join(pagesDir, file), 'utf8').catch(() => undefined)
  return html ? (parse(html, PARSE_OPTIONS).querySelector('main') ?? undefined) : undefined
}

const lines = (el: HTMLElement): string[] =>
  el.structuredText
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)

const pageFile = (pagePath: string) =>
  (pagePath === '/' ? 'index' : pagePath.slice(1).replace(/\//g, '__')).replace(/[^a-z0-9_.-]/gi, '_') + '.html'

const imageOf = (img: HTMLElement): Image | undefined => {
  const url = img.getAttribute('data-src') ?? img.getAttribute('src')
  if (!url || !url.includes('squarespace-cdn')) return undefined
  return {
    url,
    alt: (img.getAttribute('alt') ?? '').trim(),
    filename: decodeURIComponent(url.split('/').pop() ?? '').replace(/\+/g, ' '),
  }
}

// ── parsers ──────────────────────────────────────────────────────────────────

const US_STATE_NAMES = new Set(
  'Alabama Alaska Arizona Arkansas California Colorado Connecticut Delaware Florida Georgia Hawaii Idaho Illinois Indiana Iowa Kansas Kentucky Louisiana Maine Maryland Massachusetts Michigan Minnesota Mississippi Missouri Montana Nebraska Nevada Ohio Oklahoma Oregon Pennsylvania Tennessee Texas Utah Vermont Virginia Washington Wisconsin Wyoming|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Rhode Island|South Carolina|South Dakota|West Virginia'
    .split('|')
    .flatMap((group, i) => (i === 0 ? group.split(' ') : [group])),
)
const CA_PROVINCES = new Set(['Alberta', 'British Columbia', 'Manitoba', 'New Brunswick', 'Newfoundland and Labrador', 'Nova Scotia', 'Ontario', 'Prince Edward Island', 'Quebec', 'Saskatchewan'])
const US_COUNTRY = new Set(['U.S.', 'US', 'USA', 'U.S.A.', 'United States'])
const isUsRegion = (s: string) => US_STATES.has(s) || US_STATE_NAMES.has(s) || /^D\.?C\.?$/.test(s)

/**
 * Splits a location as written into city, region and country without changing any spelling.
 * Only the country "United States" is inferred, from a US state or "D.C.". Anything that does
 * not fit is returned with just `asWritten` so it can be flagged.
 */
export function parseLocation(asWritten: string): Location {
  const parts = asWritten.split(',').map((p) => p.trim()).filter(Boolean)
  if (parts.length === 3) return { asWritten, city: parts[0], region: parts[1], country: parts[2] }
  if (parts.length !== 2) return { asWritten }
  const [city, second] = parts
  if (isUsRegion(second)) return { asWritten, city, region: second, country: 'United States' }
  if (US_COUNTRY.has(second)) return { asWritten, city, country: 'United States' }
  const regionCountry = second.match(/^([A-Z]{2}) (Canada)$/) // "Waterloo, ON Canada"
  if (regionCountry) return { asWritten, city, region: regionCountry[1], country: regionCountry[2] }
  return { asWritten, city, country: second }
}

/** "Max Touhey / Michael Moran- OTTO" → two names. Firm values are never split (A & B, A + B). */
const splitPeople = (value: string) =>
  value
    .split(/\s*\/\s*|\s*;\s*|\s+and\s+/)
    .map((v) => v.trim())
    .filter(Boolean)

export function parseCredits(text: string[]): NonNullable<ProjectRecord['credits']> {
  const [name = '', ...rest] = text
  const entries: Credit[] = []
  const awards: { year?: number; text: string }[] = []
  let inAwards = false
  for (const line of rest) {
    const m = line.match(/^([^:]{2,60}):\s*(.*)$/)
    const role = m ? roleFor(m[1]) : undefined
    if (m && role === 'awards') {
      inAwards = true
      if (m[2]) awards.push(award(m[2]))
      continue
    }
    if (m && role === 'consultantsHeading') {
      inAwards = false
      continue
    }
    if (inAwards && (!m || /^\d{4}\b/.test(line))) {
      awards.push(award(line))
      continue
    }
    if (m) {
      inAwards = false
      const value = m[2].trim()
      const values =
        role === 'photography'
          ? splitPeople(value)
          : value.split('|').map((v) => v.trim()).filter(Boolean) // "REX | Rockwell Group" is two firms
      entries.push({ label: m[1].trim(), role: role!, value, values })
    } else if (/^consultants$/i.test(line)) {
      inAwards = false
    } else if (/^awards$/i.test(line)) {
      inAwards = true
    } else {
      entries.push({ label: '', role: 'unmapped', value: line, values: [line] })
    }
  }
  const first = (role: Role) => entries.find((e) => e.role === role)?.value || undefined
  const loc = first('location')
  return {
    name,
    location: loc ? parseLocation(loc) : undefined,
    completed: first('completed'),
    area: first('area'),
    sustainabilityStatus: first('sustainabilityStatus'),
    owner: first('owner'),
    photography: entries.filter((e) => e.role === 'photography').flatMap((e) => e.values),
    awards,
    entries,
  }
}

function award(text: string) {
  const m = text.match(/^(\d{4})\s+(.*)$/)
  return m ? { year: Number(m[1]), text: m[2].trim() } : { text: text.trim() }
}

export function parseProjectPage(main: HTMLElement) {
  const name = main.querySelector('h3')?.text.trim() ?? lines(main)[0] ?? ''
  const text = lines(main)
  const labelIndex = text.findIndex((l) => l.includes('|'))
  const label = labelIndex > -1 ? text[labelIndex] : undefined
  const [locationPart, ...firmParts] = (label ?? '').split('|').map((p) => p.trim())

  const stop = /^(Full Project Stats|press|Previous|Next|Other Projects with\b)/i
  const description: string[] = []
  for (const l of text.slice(labelIndex + 1)) {
    if (stop.test(l)) break
    if (/^View fullsize$/i.test(l) || l === name) continue
    description.push(l)
  }

  const hero = main.querySelectorAll('.gallery-grid-item img').map(imageOf).find(Boolean)
  const gallery = main
    .querySelectorAll('.user-items-list-carousel__slide img')
    .map(imageOf)
    .filter((i): i is Image => Boolean(i))

  const press: PressItem[] = []
  for (const list of main.querySelectorAll('[data-current-context]')) {
    const context = JSON.parse(list.getAttribute('data-current-context') ?? '{}')
    if (!Array.isArray(context.userItems)) continue
    const title = (list.closest('section')?.querySelector('.list-section-title')?.text ?? '').trim()
    if (!/press/i.test(title)) continue
    for (const item of context.userItems) {
      const desc = parse(item.description ?? '')
      const link = desc.querySelector('a')
      press.push({
        title: String(item.title ?? '').replace(/^"|"$/g, '').trim(),
        outlet: desc.text.trim(),
        url: link?.getAttribute('href') ?? undefined,
      })
    }
  }

  // The "Full Project Stats" link, wherever it points: most credits pages end in -credits, but
  // some are plain pages (/holt-renfrew, /loyola-chapel).
  const links = main.querySelectorAll('a').map((a) => ({ href: a.getAttribute('href') ?? '', text: a.text.replace(/\s+/g, ' ').trim() }))
  const creditsPath = (
    links.find((l) => /^full project (stats|credits)$/i.test(l.text) && /^\/[^/?#]+$/.test(l.href)) ??
    links.find((l) => /^\/[^/]*credits$/.test(l.href))
  )?.href

  return {
    name,
    label,
    location: locationPart ? parseLocation(locationPart) : undefined,
    labelFirms: firmParts.filter(Boolean),
    description,
    heroImage: hero,
    gallery,
    press,
    creditsPath,
  }
}

// ── main ─────────────────────────────────────────────────────────────────────

type InventoryRow = { path: string; kind: string; typology: string; projectSlug: string }

async function readInventory(): Promise<InventoryRow[]> {
  const text = await readFile(path.join(outDir, 'url-inventory.csv'), 'utf8')
  const [header, ...rows] = text.trim().split('\n')
  const cols = header.split(',')
  return rows.map((r) => {
    const cells = r.split(',')
    return Object.fromEntries(cols.map((c, i) => [c, cells[i] ?? ''])) as InventoryRow
  })
}

async function main() {
  const available = new Set(await readdir(pagesDir))
  const inventory = await readInventory()
  const review: ReviewRow[] = []
  const flagged = new Set<string>()
  // The same conflict (e.g. one firm misspelled on several credits pages) is reported once.
  const flag = (url: string, field: string, asWritten: string, note: string, suggested = '') => {
    const key = `${field}|${asWritten}|${note}`
    if (flagged.has(key)) return
    flagged.add(key)
    review.push({ url: url.startsWith('http') ? url : `${SITE}${url}`, field, asWritten, suggested, note })
  }

  // Featured projects: whatever the homepage links to.
  const home = await loadMain('index.html')
  const featuredPaths = new Set(
    (home?.querySelectorAll('a') ?? []).map((a) => (a.getAttribute('href') ?? '').replace(/\/$/, '')),
  )

  // Projects, merged across the categories they are listed under.
  const projects = new Map<string, ProjectRecord>()
  for (const row of inventory.filter((r) => r.kind === 'project')) {
    const file = pageFile(row.path)
    if (!available.has(file)) {
      flag(row.path, 'page', row.path, 'Page was not fetched; rerun pnpm migrate:fetch.')
      continue
    }
    const page = parseProjectPage((await loadMain(file))!)
    const existing = projects.get(row.projectSlug)
    if (existing) {
      existing.legacyPaths.push(row.path)
      existing.typologies.push(row.typology)
      existing.featured ||= featuredPaths.has(row.path)
      if (page.name !== existing.name) {
        flag(row.path, 'project name', `${existing.name} | ${page.name}`, 'Same project, named differently under two categories.')
      }
      continue
    }
    projects.set(row.projectSlug, {
      key: row.projectSlug,
      legacyPaths: [row.path],
      typologies: [row.typology],
      featured: featuredPaths.has(row.path),
      ...page,
    })
  }

  // Credits pages: attach through the project page's own "Full Project Stats" link.
  const creditsByPath = new Map<string, NonNullable<ProjectRecord['credits']>>()
  const linked = new Set([...projects.values()].map((p) => p.creditsPath).filter((p): p is string => Boolean(p)))
  for (const row of inventory.filter((r) => r.kind === 'credits' || (r.kind === 'page' && linked.has(r.path)))) {
    const main = available.has(pageFile(row.path)) ? await loadMain(pageFile(row.path)) : undefined
    if (main) creditsByPath.set(row.path, parseCredits(lines(main)))
  }
  const claimed = new Set<string>()
  for (const [key, project] of [...projects]) {
    if (!project.creditsPath) {
      flag(project.legacyPaths[0], 'credits page', project.name, 'Project page has no "Full Project Stats" link.')
      continue
    }
    const credits = creditsByPath.get(project.creditsPath)
    if (!credits) {
      flag(project.legacyPaths[0], 'credits page', project.creditsPath, 'Links to a credits page that is not in the sitemap or was not fetched.')
      continue
    }
    project.credits = credits
    if (!claimed.has(project.creditsPath)) {
      claimed.add(project.creditsPath)
      project.legacyPaths.push(project.creditsPath)
      continue
    }
    // A second project page linking to the same credits page. Same name: one project under two
    // addresses, so merge. Different names (712 Fifth Lobby and Atrium): keep both and flag.
    const first = [...projects.values()].find((p) => p !== project && p.creditsPath === project.creditsPath)!
    if (normalizeName(first.name) === normalizeName(project.name)) {
      first.legacyPaths.push(...project.legacyPaths.filter((x) => !first.legacyPaths.includes(x)))
      first.typologies.push(...project.typologies.filter((t) => !first.typologies.includes(t)))
      first.featured ||= project.featured
      projects.delete(key)
      flag(project.legacyPaths[0], 'project', `${first.legacyPaths[0]} | ${project.legacyPaths[0]}`, `Same project (${project.name}) under two addresses; merged into one. Images and text come from the first.`)
    } else if (!MANUAL_MERGES.some((m) => m.slugs.includes(first.key) && m.slugs.includes(project.key))) {
      flag(project.creditsPath, 'credits page', `${first.name} | ${project.name}`, 'Two different projects share one credits page. Both keep these credits; the old credits address redirects to the first. Split the credits if they differ.')
    }
  }

  // Merges TDA confirmed by hand (scripts/migrate/merges.ts).
  for (const merge of MANUAL_MERGES) {
    const [into, ...others] = merge.slugs.map((slug) => projects.get(slug))
    if (!into || others.some((o) => !o)) {
      flag('/', 'project', merge.slugs.join(' | '), 'Listed in merges.ts but not found among the extracted projects.')
      continue
    }
    for (const other of others as ProjectRecord[]) {
      into.legacyPaths.push(...other.legacyPaths.filter((x) => !into.legacyPaths.includes(x)))
      into.typologies.push(...other.typologies.filter((t) => !into.typologies.includes(t)))
      into.featured ||= other.featured
      into.description.push(...other.description)
      into.gallery.push(...[other.heroImage, ...other.gallery].filter((i): i is Image => Boolean(i)))
      into.press.push(...other.press.filter((x) => !into.press.some((y) => y.url === x.url)))
      projects.delete(other.key)
    }
    into.name = merge.name
  }

  // Credits pages no project links to: projects that exist only as credits, or stale copies.
  for (const [creditsPath, credits] of creditsByPath) {
    if (claimed.has(creditsPath)) continue
    const twin = [...projects.values()].find(
      (p) => p.credits && normalizeName(p.credits.name) === normalizeName(credits.name),
    )
    if (twin) {
      twin.legacyPaths.push(creditsPath)
      flag(creditsPath, 'credits page', `${creditsPath} | ${twin.creditsPath}`, `Second credits page for ${twin.name}; the project page links to the other one. Redirects to the same project.`)
      continue
    }
    projects.set(creditsPath, {
      key: creditsPath,
      name: credits.name,
      legacyPaths: [creditsPath],
      typologies: [],
      featured: false,
      location: credits.location,
      labelFirms: [],
      description: [],
      gallery: [],
      press: [],
      creditsPath,
      credits,
    })
    flag(creditsPath, 'project', credits.name, 'Credits page with no project page. Import as a draft project (no images, no category) or leave out?')
  }

  // On the boards: in-progress work listed as "Name | Firm | Firm".
  const boards = await loadMain('on-the-boards.html')
  for (const line of boards ? lines(boards) : []) {
    if (!line.includes('|')) continue
    const [name, ...firms] = line.split('|').map((p) => p.trim())
    const match = [...projects.values()].find((p) => normalizeName(p.name) === normalizeName(name))
    if (match) {
      match.onTheBoards = true
      flag('/on-the-boards', 'project status', name, `Listed as on the boards and also has a project page (${match.legacyPaths[0]}). Completed or in progress?`)
      continue
    }
    const key = `/on-the-boards#${normalizeName(name)}`
    projects.set(key, {
      key,
      name,
      legacyPaths: [],
      typologies: [],
      featured: false,
      label: line,
      labelFirms: firms,
      description: [],
      gallery: [],
      press: [],
      onTheBoards: true,
    })
  }

  // Conflicts between a project page and its credits page.
  for (const p of projects.values()) {
    const c = p.credits
    if (!c) continue
    const where = p.legacyPaths[0] ?? p.key
    if (p.label && normalizeName(c.name) !== normalizeName(p.name)) {
      flag(where, 'project name', `${p.name} | ${c.name}`, 'Project page and credits page name the project differently. Which is right?')
    }
    if (p.location && c.location && normalizeName(p.location.asWritten) !== normalizeName(c.location.asWritten)) {
      flag(where, 'location', `${p.location.asWritten} | ${c.location.asWritten}`, 'Project page and credits page give different locations.')
    }
    const creditArchitects = c.entries.filter((e) => ARCHITECT_ROLES.has(e.role)).flatMap((e) => e.values)
    for (const firm of p.labelFirms) {
      const exact = creditArchitects.some((a) => normalizeName(a) === normalizeName(firm))
      const close = creditArchitects.find((a) => normalizeName(a) !== normalizeName(firm) && similarity(normalizeName(a), normalizeName(firm)) >= 0.8)
      if (!exact && close) {
        flag(where, 'firm', `${firm} | ${close}`, 'Same firm spelled differently on the project page and the credits page. Check the firm’s own spelling.')
      }
    }
    for (const e of c.entries.filter((e) => e.role === 'unmapped')) {
      flag(p.creditsPath ?? where, 'credit label', e.label ? `${e.label}: …` : e.value.slice(0, 80), 'Credit line the extractor does not recognise. Add its label to scripts/migrate/credit-labels.ts or tell a developer what it means.')
    }
    if (!c.completed) flag(p.creditsPath ?? where, 'year', p.name, 'Credits page has no "Project Completed" year.')
  }

  // Locations that are not "City, ST" in the US: the country is as written and needs a look.
  const seenLocations = new Set<string>()
  for (const p of projects.values()) {
    for (const loc of [p.location, p.credits?.location]) {
      if (!loc || seenLocations.has(loc.asWritten)) continue
      if (loc.city && CA_PROVINCES.has(loc.city)) {
        seenLocations.add(loc.asWritten)
        flag(p.legacyPaths[0] ?? p.key, 'location', loc.asWritten, `"${loc.city}" is a province, not a city. Order may be reversed.`)
        continue
      }
      if (loc.region) continue
      seenLocations.add(loc.asWritten)
      flag(p.legacyPaths[0] ?? p.key, 'location', loc.asWritten, loc.country ? `Read as city "${loc.city}", country "${loc.country}". Confirm how the country should be written.` : 'Could not split into city and state or country.')
    }
  }

  // Label segments with a comma may be two firms written as one.
  for (const p of projects.values()) {
    for (const firm of p.labelFirms) {
      if (firm.includes(',')) flag(p.legacyPaths[0] ?? p.key, 'firm', firm, 'Comma inside one label segment: one firm or two?')
    }
  }

  // Firms: every spelling from labels, credits and the collaborators page, grouped.
  const collaborators = await loadMain('collaborators.html')
  const curated = (collaborators ? lines(collaborators) : []).filter((l) => l.length > 1 && !/^collaborators$/i.test(l))
  const spellings = new Map<string, { spelling: string; sources: Set<string> }[]>()
  const addFirm = (spelling: string, source: string) => {
    const key = normalizeName(spelling)
    if (!key) return
    const list = spellings.get(key) ?? []
    const same = list.find((s) => s.spelling === spelling)
    if (same) same.sources.add(source)
    else list.push({ spelling, sources: new Set([source]) })
    spellings.set(key, list)
  }
  for (const f of curated) addFirm(f, 'collaborators page')
  for (const p of projects.values()) {
    for (const f of p.labelFirms) addFirm(f, `label ${p.legacyPaths[0] ?? p.key}`)
    for (const e of p.credits?.entries ?? [])
      if (FIRM_ROLES.has(e.role) && e.role !== 'lightingDesign') for (const v of e.values) addFirm(v, `credits ${p.creditsPath}`)
  }
  const firms = [...spellings.entries()].map(([key, list]) => ({
    key,
    preferred: list.find((s) => s.sources.has('collaborators page'))?.spelling,
    spellings: list.map((s) => ({ spelling: s.spelling, sources: [...s.sources] })),
  }))
  for (const f of firms.filter((f) => f.spellings.length > 1)) {
    flag('/collaborators', 'firm', f.spellings.map((s) => s.spelling).join(' | '), 'One firm, several spellings (differ only in spacing or punctuation).', f.preferred ?? '')
  }
  const keys = firms.map((f) => f.key)
  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      if (Math.min(keys[i].length, keys[j].length) < 6) continue
      if (similarity(keys[i], keys[j]) >= 0.88) {
        const a = firms[i]
        const b = firms[j]
        flag('/collaborators', 'firm', `${a.spellings[0].spelling} | ${b.spellings[0].spelling}`, 'Two firm names that differ by a letter or two. Same firm misspelled, or two firms?', a.preferred ?? b.preferred ?? '')
      }
    }
  }

  // People: the team page lists "Name, Title" under group headings.
  const team = await loadMain('team.html')
  const people: { name: string; title: string; group: string; order: number }[] = []
  let group = ''
  for (const line of team ? lines(team) : []) {
    if (/^(Leadership|Design Team|Administration)$/i.test(line)) {
      group = line
      continue
    }
    const m = line.match(/^([^,]+),\s*(.+)$/)
    if (m && group) people.push({ name: m[1].trim(), title: m[2].trim(), group, order: people.filter((p) => p.group === group).length + 1 })
  }

  // Site details and About text, verbatim.
  const contact = await loadMain('contact.html')
  const about = await loadMain('about-5.html')
  const site = { contact: contact ? lines(contact) : [], about: about ? lines(about) : [] }

  await mkdir(extractedDir, { recursive: true })
  const list = [...projects.values()]
  await writeFile(path.join(extractedDir, 'projects.json'), JSON.stringify(list, null, 1))
  await writeFile(path.join(extractedDir, 'people.json'), JSON.stringify(people, null, 1))
  await writeFile(path.join(extractedDir, 'firms.json'), JSON.stringify(firms, null, 1))
  await writeFile(path.join(extractedDir, 'site.json'), JSON.stringify(site, null, 1))
  const total = await writeReview('extract', review)

  const count = (f: (p: ProjectRecord) => boolean) => list.filter(f).length
  console.log(`${list.length} projects: ${count((p) => Boolean(p.label && p.credits))} with page and credits, ${count((p) => Boolean(p.label && !p.credits && !p.onTheBoards))} page only, ${count((p) => !p.label && Boolean(p.credits))} credits only, ${count((p) => Boolean(p.onTheBoards && !p.credits))} on the boards`)
  console.log(`${count((p) => p.featured)} featured on the homepage; ${list.reduce((n, p) => n + p.gallery.length + (p.heroImage ? 1 : 0), 0)} project images; ${list.reduce((n, p) => n + p.press.length, 0)} press items; ${list.reduce((n, p) => n + (p.credits?.awards.length ?? 0), 0)} awards`)
  console.log(`${firms.length} firms (${firms.filter((f) => f.preferred).length} on the collaborators page); ${people.length} people`)
  console.log(`${review.length} extract review rows; review.csv now has ${total}`)
  console.log(`Data: ${path.relative(process.cwd(), extractedDir)} (gitignored)`)
}

if (process.argv[1]?.endsWith('extract.ts')) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
