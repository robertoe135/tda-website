/**
 * Projects sent from the internal TDA app's Marketing tab ("Send to website").
 *
 * The app pushes; the website never connects to the app. What arrives is an allowlist of public
 * facts (below): anything else in the request is ignored, so fees, contacts and internal notes
 * cannot land here even if the app sent them. The project is matched by its TDA project number
 * and saved as a draft: a new project is created, an existing one only gets the fields that are
 * still empty here, so nothing marketing already wrote on the website is replaced. Names (firms,
 * people, places, owners, credit roles) must match a record that exists; anything that doesn't
 * is listed for a person to add, never created or guessed.
 */
import type { Payload } from 'payload'

import { normalizeName } from '@/hooks/preventNearDuplicates'
import { toSlug } from '@/fields/slug'

import { ROLE_LABELS, sortTeam, type TeamRole } from './team-credits'

// ── what the app may send ────────────────────────────────────────────────────

export type AppProject = {
  projectNumber: string
  name: string
  year?: number
  areaSqFt?: number
  location?: string
  /** The project's architect(s), as the website lists them (the design architect when there is one). */
  architects?: string[]
  /** Everyone else, by role name as written under Credit roles. */
  credits?: { role: string; firm: string }[]
  client?: string
  /** The app has confidentiality notes for this project. The notes themselves never leave the app. */
  hasConfidentialityNotes?: boolean
  summary?: string
  /** Paragraphs for the write-up, in order. */
  description?: string[]
  team?: { name: string; role: TeamRole }[]
  /** Who pressed Send in the app, for the reply only. */
  sentBy?: string
}

const ROLES = new Set<TeamRole>(['principal', 'project-manager', 'designer'])
const LIMIT = 4000 // per text field; a write-up longer than this is a paste mistake

const text = (v: unknown, max = 300): string | undefined => {
  if (typeof v !== 'string') return undefined
  const s = v.replace(/\r\n/g, '\n').trim()
  return s ? s.slice(0, max) : undefined
}
const line = (v: unknown) => text(v, 200)?.replace(/\s+/g, ' ')
const num = (v: unknown, min: number, max: number) =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : undefined

/** Reads a request body down to the allowlist. Unknown keys are dropped, not stored. */
export function readAppProject(body: unknown): { project?: AppProject; problems: string[] } {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>
  const projectNumber = line(b.projectNumber)
  const name = line(b.name)
  const problems: string[] = []
  if (!projectNumber) problems.push('The project has no TDA project number.')
  if (!name) problems.push('The project has no name.')
  if (problems.length) return { problems }

  const list = (v: unknown) => (Array.isArray(v) ? v : []).map(line).filter((s): s is string => Boolean(s))
  const credits = (Array.isArray(b.credits) ? b.credits : [])
    .map((c) => ({ role: line((c as Record<string, unknown>)?.role), firm: line((c as Record<string, unknown>)?.firm) }))
    .filter((c): c is { role: string; firm: string } => Boolean(c.role && c.firm))
  const team = (Array.isArray(b.team) ? b.team : [])
    .map((m) => ({ name: line((m as Record<string, unknown>)?.name), role: (m as Record<string, unknown>)?.role as TeamRole }))
    .filter((m): m is { name: string; role: TeamRole } => Boolean(m.name) && ROLES.has(m.role))
  const description = (Array.isArray(b.description) ? b.description : [])
    .map((p) => text(p, LIMIT))
    .filter((s): s is string => Boolean(s))

  return {
    problems,
    project: {
      projectNumber: projectNumber!,
      name: name!,
      year: num(b.year, 1900, 2100),
      areaSqFt: num(b.areaSqFt, 1, 100_000_000),
      location: line(b.location),
      architects: list(b.architects),
      credits,
      client: line(b.client),
      hasConfidentialityNotes: b.hasConfidentialityNotes === true,
      summary: text(b.summary, LIMIT),
      description,
      team,
      sentBy: line(b.sentBy),
    },
  }
}

// ── rich text ────────────────────────────────────────────────────────────────

/** Plain paragraphs as Lexical rich text. A blank line inside a paragraph starts a new one. */
export function paragraphsToRichText(paragraphs: string[]) {
  const parts = paragraphs.flatMap((p) => p.split(/\n\s*\n/)).map((p) => p.replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean)
  return {
    root: {
      type: 'root',
      format: '' as const,
      indent: 0,
      version: 1,
      direction: 'ltr' as const,
      children: parts.map((p) => ({
        type: 'paragraph',
        format: '' as const,
        indent: 0,
        version: 1,
        direction: 'ltr' as const,
        textFormat: 0,
        textStyle: '',
        children: [{ type: 'text', text: p, format: 0, detail: 0, mode: 'normal', style: '', version: 1 }],
      })),
    },
  }
}

const hasValue = (v: unknown): boolean => {
  if (Array.isArray(v)) return v.length > 0
  if (v && typeof v === 'object' && 'root' in (v as object)) {
    const walk = (n: { text?: string; children?: unknown[] }): boolean =>
      Boolean(n.text?.trim()) || (n.children ?? []).some((c) => walk(c as { text?: string; children?: unknown[] }))
    return walk((v as { root: { children?: unknown[] } }).root)
  }
  return v !== null && v !== undefined && v !== ''
}

// ── matching names ───────────────────────────────────────────────────────────

/**
 * How one name the app sent was matched:
 * - matched: the same name (or a firm's other name) as one record here
 * - suggested: no exact match, so the closest record was used. Shown on the draft for a person
 *   to confirm before publishing; never a rename of either record.
 * - missing: nothing close enough; left empty for a person to add
 */
export type MatchStatus = 'matched' | 'suggested' | 'missing'
export type Match = {
  field: string
  sent: string
  status: MatchStatus
  /** The record used, for matched and suggested. */
  usedName?: string
  usedId?: number
  /** Why it is missing, or what to check. */
  note?: string
}

/** What the app sent and how each name was matched, kept on the draft (staff only). */
export type FromApp = {
  sentAt: string
  sentBy?: string
  sent: AppProject
  matches: Match[]
  warnings: string[]
}

type Candidate = { id: number; name: string; keys: string[]; extra?: Record<string, unknown> }

/** Levenshtein ratio between two normalized names (as in lib/team-credits). */
export function similarity(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]
    row[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j]
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = tmp
    }
  }
  return 1 - row[b.length] / Math.max(a.length, b.length, 1)
}

/** Closer than this counts as a suggestion. */
export const SUGGEST_AT = 0.8

/**
 * Picks the record for a sent name: an exact match (several exact matches: none, a person
 * decides), else the single closest record at or above SUGGEST_AT, else none. A tie for closest
 * is no suggestion.
 */
export function pick(candidates: Candidate[], sent: string): { status: MatchStatus; candidate?: Candidate; note?: string } {
  const key = normalizeName(sent)
  if (!key) return { status: 'missing' }
  const exact = candidates.filter((c) => c.keys.includes(key))
  if (exact.length === 1) return { status: 'matched', candidate: exact[0] }
  if (exact.length > 1) return { status: 'missing', note: `${exact.length} records have this name; pick one.` }
  let best: Candidate | undefined
  let bestScore = 0
  let tie = false
  for (const c of candidates) {
    const score = Math.max(...c.keys.map((k) => similarity(k, key)))
    if (score > bestScore) {
      best = c
      bestScore = score
      tie = false
    } else if (score === bestScore) tie = true
  }
  if (best && bestScore >= SUGGEST_AT && !tie) return { status: 'suggested', candidate: best, note: 'Closest name here; check it is the same before publishing.' }
  return { status: 'missing' }
}

async function candidates(payload: Payload, collection: 'firms' | 'clients' | 'creditRoles' | 'locations' | 'people'): Promise<Candidate[]> {
  if (collection === 'people') {
    const res = await payload.find({ collection, draft: true, depth: 0, pagination: false, select: { name: true, showOnSite: true } })
    return res.docs.map((d) => ({ id: d.id, name: d.name, keys: [normalizeName(d.name)], extra: { showOnSite: d.showOnSite } }))
  }
  if (collection === 'locations') {
    const res = await payload.find({ collection, depth: 0, pagination: false, select: { displayName: true, city: true } })
    // "New York, NY" or just "New York".
    return res.docs.map((d) => ({ id: d.id, name: d.displayName ?? d.city, keys: [normalizeName(d.displayName ?? ''), normalizeName(d.city ?? '')].filter(Boolean) }))
  }
  if (collection === 'firms') {
    const res = await payload.find({ collection, depth: 0, pagination: false, select: { name: true, aliases: true } })
    return res.docs.map((d) => ({ id: d.id, name: d.name, keys: [normalizeName(d.name), ...(d.aliases ?? []).map((a) => normalizeName(a.name))] }))
  }
  const res = await payload.find({ collection, depth: 0, pagination: false, select: { name: true } })
  return res.docs.map((d) => ({ id: d.id, name: (d as { name: string }).name, keys: [normalizeName((d as { name: string }).name)] }))
}

// ── against the database ─────────────────────────────────────────────────────

export type AppSyncPlan = {
  existing?: { id: number; name: string; status: string }
  name: string
  /** The fields this send writes, as stored. */
  data: Record<string, unknown>
  /** Labels of the fields written. */
  filled: string[]
  /** Labels of fields the website already has, left as they are. */
  kept: string[]
  /** Every name sent, and how it was matched. */
  matches: Match[]
  /** Things a person should look at before publishing. */
  warnings: string[]
}

const LABELS: Record<string, string> = {
  name: 'Name',
  slug: 'Web address',
  projectNumber: 'TDA project number',
  status: 'Project status',
  year: 'Year',
  areaSqFt: 'Area',
  location: 'Location',
  architects: 'Architects',
  credits: 'Credits',
  clients: 'Client',
  confidential: 'Confidential',
  summary: 'Summary',
  description: 'Write-up',
  team: 'TDA team',
  fromApp: 'From the TDA app',
}

const MISSING_HINT: Record<Parameters<typeof candidates>[1], string> = {
  locations: 'Add it under Locations (with its map position), then pick it on the Facts tab or send again.',
  firms: 'Add it under Firms, or as an other name of the right firm, then send again.',
  creditRoles: 'Add it under Credit roles, then send again.',
  clients: 'Add the owner under Clients, then send again.',
  people: 'Add them under People, then send again.',
}

/** Checks a sent project against the website, changing nothing. */
export async function planAppProject(payload: Payload, app: AppProject): Promise<AppSyncPlan> {
  const matches: Match[] = []
  const warnings: string[] = []
  const cache = new Map<string, Promise<Candidate[]>>()
  const list = (c: Parameters<typeof candidates>[1]) => {
    if (!cache.has(c)) cache.set(c, candidates(payload, c))
    return cache.get(c)!
  }
  /** Records the match and returns the record id to use, if any. */
  const find = async (field: string, collection: Parameters<typeof candidates>[1], sent: string, filter?: (c: Candidate) => boolean) => {
    const all = await list(collection)
    const got = pick(filter ? all.filter(filter) : all, sent)
    matches.push({
      field,
      sent,
      status: got.status,
      usedName: got.candidate?.name,
      usedId: got.candidate?.id,
      note: got.note ?? (got.status === 'missing' ? MISSING_HINT[collection] : undefined),
    })
    return got.candidate?.id
  }

  const existing = (
    await payload.find({
      collection: 'projects',
      draft: true,
      depth: 0,
      limit: 1,
      pagination: false,
      where: { projectNumber: { equals: app.projectNumber } },
    })
  ).docs[0] as unknown as (Record<string, unknown> & { id: number; name: string; status: string }) | undefined

  // What the app has, as website fields.
  const proposed: Record<string, unknown> = {}
  if (!existing) {
    proposed.name = app.name
    proposed.projectNumber = app.projectNumber
    // Two projects can share a public name ("Private Residence"); their addresses cannot.
    const base = toSlug(app.name) ?? toSlug(app.projectNumber) ?? 'project'
    let slug = base
    const taken = async (candidate: string) =>
      (await payload.find({ collection: 'projects', draft: true, depth: 0, limit: 1, pagination: false, select: {}, where: { slug: { equals: candidate } } })).docs.length > 0
    for (let n = 2; await taken(slug); n++) slug = `${base}-${n}`
    proposed.slug = slug
    if (slug !== base) warnings.push(`Another project already has the address /projects/${base}, so this draft is at /projects/${slug}. Change it under URL slug before publishing if you like.`)
    // New work stays off the public site until someone records approval to announce it.
    proposed.status = 'in-progress'
    // Owners stay hidden until marketing decides they may be named.
    proposed.confidential = true
  }
  if (app.year) proposed.year = app.year
  if (app.areaSqFt) proposed.areaSqFt = Math.round(app.areaSqFt)
  if (app.summary) {
    if (app.summary.length > 300) warnings.push(`The summary is ${app.summary.length} characters; the website allows 300. It was left out: shorten it in the app or write it here.`)
    else proposed.summary = app.summary
  }
  if (app.description?.length) proposed.description = paragraphsToRichText(app.description)

  if (app.location) {
    const id = await find('Location', 'locations', app.location)
    if (id) proposed.location = id
  }

  const architects: number[] = []
  for (const firm of app.architects ?? []) {
    const id = await find('Architects', 'firms', firm)
    if (id) architects.push(id)
  }
  if (architects.length) proposed.architects = [...new Set(architects)]

  const credits: { role: number; firms: number[] }[] = []
  for (const c of app.credits ?? []) {
    const role = await find('Credits', 'creditRoles', c.role)
    const firm = await find('Credits', 'firms', c.firm)
    if (role && firm) {
      const same = credits.find((x) => x.role === role)
      if (same) same.firms = [...new Set([...same.firms, firm])]
      else credits.push({ role, firms: [firm] })
    }
  }
  if (credits.length) proposed.credits = credits

  if (app.client) {
    const id = await find('Client', 'clients', app.client)
    if (id) proposed.clients = [id]
  }
  if (app.hasConfidentialityNotes) {
    if (existing && existing.confidential !== true)
      warnings.push('The app has confidentiality notes for this project, but here it is not marked Confidential. Check them before publishing.')
    else warnings.push('The app has confidentiality notes for this project. Read them in the app before publishing.')
  }

  if (app.team?.length) {
    const team: { person: number; role: TeamRole }[] = []
    const onSite = (c: Candidate) => c.extra?.showOnSite === true
    for (const m of app.team) {
      const all = await list('people')
      const exactOff = all.find((c) => !onSite(c) && c.keys.includes(normalizeName(m.name)))
      if (exactOff) {
        matches.push({ field: 'TDA team', sent: m.name, status: 'missing', note: `${ROLE_LABELS[m.role]}. "Show on site" is off for ${exactOff.name}; turn it on with their OK.` })
        continue
      }
      // Only people who may be shown can be picked, as in the admin.
      const id = await find('TDA team', 'people', m.name, onSite)
      const last = matches[matches.length - 1]
      last.note = [ROLE_LABELS[m.role], last.note].filter(Boolean).join('. ')
      if (id && !team.some((t) => t.person === id && t.role === m.role)) team.push({ person: id, role: m.role })
    }
    if (team.length) proposed.team = sortTeam(team)
  }

  // A new project takes everything; an existing one only what it is missing.
  const data: Record<string, unknown> = {}
  const filled: string[] = []
  const kept: string[] = []
  for (const [field, value] of Object.entries(proposed)) {
    if (!existing || !hasValue(existing[field])) {
      data[field] = value
      filled.push(LABELS[field] ?? field)
    } else {
      kept.push(LABELS[field] ?? field)
    }
  }
  // Always: what was sent and how it matched, for the "From the TDA app" panel.
  data.fromApp = { sentAt: new Date().toISOString(), sentBy: app.sentBy, sent: app, matches, warnings } satisfies FromApp
  return {
    existing: existing ? { id: existing.id, name: existing.name, status: existing.status } : undefined,
    name: existing?.name ?? app.name,
    data,
    filled,
    kept,
    matches,
    warnings,
  }
}

/** Saves a plan as a draft. The live site changes only when someone publishes it. */
export async function saveAppProject(payload: Payload, plan: AppSyncPlan): Promise<{ id: number; created: boolean }> {
  if (plan.existing) {
    // Always saves, even with nothing to fill: the "From the TDA app" panel shows the latest send.
    await payload.update({ collection: 'projects', id: plan.existing.id, data: plan.data, draft: true })
    return { id: plan.existing.id, created: false }
  }
  const doc = await payload.create({ collection: 'projects', data: { ...plan.data, _status: 'draft' } as never, draft: true })
  return { id: doc.id, created: true }
}
