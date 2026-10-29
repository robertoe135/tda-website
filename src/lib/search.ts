import type { CreditRole, Firm, Location, Person, Photographer, Typology } from '@/payload-types'

import { cardImage, type CardImage, filterHref, getPayloadClient, PROJECT_STATUS } from './projects'

/**
 * Site search (app/(frontend)/search): every published project, by any of its words. Its name,
 * year, place, categories, status, architects, each credit (role and firm), the TDA team, the
 * photographers and its summary. Never its owner: clients are not searchable. Read as the public
 * sees projects, so unpublished work and internal fields (project number, internal names) are
 * never searchable either.
 */

/** One searchable fact of a project, shown under a result when it matched; links where it can. */
export type Fact = { label: string; value: string; href?: string; weight: number }
export type SearchDoc = {
  id: number
  name: string
  slug: string
  year?: number | null
  status?: string | null
  place?: string
  image?: CardImage
  facts: Fact[]
}
/** A firm or person whose name is the whole search, to go straight to their projects. */
export type Shortcut = { label: string; kind: string; href: string }
export type SearchResult = { doc: SearchDoc; score: number; matched: Fact[] }

const isObject = <T>(v: unknown): v is T => typeof v === 'object' && v !== null

/** Letters and digits only, lowercase, without accents: "Höweler + Yoon" → "howeler and yoon". */
export const normalize = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&|\+/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

const words = (s: string) => normalize(s).split(' ').filter(Boolean)
// Words too common to narrow anything: "the", "and" alone match every project.
const STOP = new Set(['the', 'and', 'of', 'a', 'an', 'in', 'at', 'for', 'by', 'with'])

/** Every published project as searchable facts. */
export async function getSearchIndex(): Promise<SearchDoc[]> {
  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'projects',
    overrideAccess: false, // the public view: published, no internal fields
    pagination: false,
    depth: 1,
    sort: ['-year', 'name'],
    select: {
      name: true,
      slug: true,
      year: true,
      status: true,
      summary: true,
      predecessorFirm: true,
      location: true,
      typologies: true,
      architects: true,
      credits: true,
      team: true,
      photographers: true,
      heroImage: true,
      gallery: true,
    },
  })
  return result.docs.map((p) => {
    const facts: Fact[] = []
    const add = (label: string, value: string | null | undefined, weight: number, href?: string) => {
      if (value?.trim()) facts.push({ label, value: value.trim(), weight, href })
    }
    const location = isObject<Location>(p.location) ? p.location : undefined
    add('Location', location?.displayName, 6, location?.slug ? filterHref('location', location.slug) : undefined)
    if (p.year) add(p.status === 'in-progress' ? 'Expected completion' : 'Year', String(p.year), 6)
    if (p.status) add('Status', PROJECT_STATUS[p.status], 2, filterHref('status', p.status))
    for (const t of (p.typologies ?? []).filter(isObject<Typology>))
      add('Category', t.name, 5, t.slug ? filterHref('typology', t.slug) : undefined)
    for (const f of (p.architects ?? []).filter(isObject<Firm>))
      add('Design architect', f.name, 6, f.slug ? filterHref('architect', f.slug) : undefined)
    for (const c of p.credits ?? []) {
      const role = isObject<CreditRole>(c.role) ? c.role.name : 'Credit'
      for (const f of (c.firms ?? []).filter(isObject<Firm>))
        add(role, f.name, 3, f.slug ? filterHref('collaborator', f.slug) : undefined)
    }
    for (const t of p.team ?? []) {
      const person = isObject<Person>(t.person) ? t.person : undefined
      add('TDA team', person?.name, 3, person?.isCurrent && person.slug ? `/about/team/${person.slug}` : undefined)
    }
    for (const ph of (p.photographers ?? []).filter(isObject<Photographer>))
      add('Photography', ph.name, 3, ph.slug ? filterHref('photographer', ph.slug) : undefined)
    add('Completed as', p.predecessorFirm, 3)
    add('About', p.summary, 1)
    const photo = [p.heroImage, ...(p.gallery ?? []).map((g) => g.image)].find((m) => isObject<{ url?: string }>(m) && m.url)
    return {
      id: p.id,
      name: p.name,
      slug: p.slug ?? String(p.id),
      year: p.year,
      status: p.status,
      place: location?.displayName ?? undefined,
      image: photo ? cardImage(photo as never) : undefined,
      facts,
    }
  })
}

/** How well one query word matches a text: whole word 2, start of a word 1, else 0. */
function wordScore(token: string, text: string[]): number {
  if (text.includes(token)) return 2
  // A year or number matches exactly; a word may be typed in part ("thorn" for Thornton).
  return /^\d+$/.test(token) ? 0 : text.some((w) => w.startsWith(token)) ? 1 : 0
}

/**
 * Projects that match every word of the query, in some fact or their name, best first: the
 * name counts most, then place, year and architects, then categories, credits and the team.
 */
export function searchProjects(docs: SearchDoc[], query: string): SearchResult[] {
  const tokens = words(query).filter((t) => !STOP.has(t))
  if (!tokens.length) return []
  const results: SearchResult[] = []
  for (const doc of docs) {
    const name = words(doc.name)
    const facts = doc.facts.map((f) => ({ fact: f, text: words(f.value) }))
    let score = 0
    const matched = new Set<Fact>()
    let everyWord = true
    for (const token of tokens) {
      const inName = wordScore(token, name) * 10
      // The project's own year, whatever its facts say.
      let best = Math.max(inName, doc.year && token === String(doc.year) ? 12 : 0)
      for (const { fact, text } of facts) {
        const s = wordScore(token, text) * fact.weight
        if (s > 0) matched.add(fact)
        best = Math.max(best, s)
      }
      if (!best) {
        everyWord = false
        break
      }
      score += best
    }
    if (!everyWord) continue
    // The whole query as a phrase in the name ranks first.
    if (normalize(doc.name).includes(normalize(query))) score += 15
    results.push({ doc, score, matched: [...matched].sort((a, b) => b.weight - a.weight) })
  }
  return results.sort((a, b) => b.score - a.score || (b.doc.year ?? 0) - (a.doc.year ?? 0) || a.doc.name.localeCompare(b.doc.name))
}

/** Firms and people whose whole name the query is part of, to open their projects directly. */
export function searchShortcuts(docs: SearchDoc[], query: string): Shortcut[] {
  const q = normalize(query)
  if (q.length < 3) return []
  const seen = new Map<string, Shortcut>()
  for (const doc of docs)
    for (const f of doc.facts) {
      if (!f.href || f.label === 'About' || f.label === 'Status' || f.label === 'Year') continue
      const v = normalize(f.value)
      if (!(` ${v} `.includes(` ${q} `) || v.startsWith(q))) continue
      const kind = f.label === 'Location' || f.label === 'Category' ? f.label : f.label === 'TDA team' ? 'TDA team' : 'Firm'
      if (!seen.has(f.href)) seen.set(f.href, { label: f.value, kind, href: f.href })
    }
  return [...seen.values()].slice(0, 8)
}
