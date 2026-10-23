import type { Payload } from 'payload'

import type {
  Award,
  Firm,
  Location,
  Media,
  Newsletter,
  Photographer,
  Press,
  Project,
  SiteSetting,
} from '../payload-types'
import { blobFileURL } from './blob'
import { emailTileURL } from './email-tile'
import { emailLogo } from './email-logo'
import { siteUrl } from './seo'
import { formatAddress } from './address'

/**
 * A newsletter issue as plain data, ready to draw (src/emails/Newsletter.tsx): projects, awards
 * and press filled in from the site, empty blocks left out, sections numbered. Kept apart from
 * the database (loadIssue) so it can be tested on its own.
 */

export type EmailImage = { src: string; alt: string }
export type Credit = { label: string; value: string }
export type IssueItem = (
  | { kind: 'letter'; paragraphs: string[]; signatureName?: string; signatureTitle?: string }
  | { kind: 'section'; number: string; title: string }
  | {
      kind: 'project'
      name: string
      city?: string
      href: string
      image?: EmailImage
      paragraphs: string[]
      credits: Credit[]
    }
  | { kind: 'grid'; projects: { name: string; city?: string; href: string; image?: EmailImage }[] }
  | {
      kind: 'conversation'
      name?: string
      role?: string
      portrait?: EmailImage
      question?: string
      answer: string[]
      href?: string
      linkLabel: string
    }
  | { kind: 'awards'; rows: { year?: number; name: string; project?: string; href?: string }[] }
  | { kind: 'press'; rows: { outlet?: string; title: string; href: string }[] }
  | { kind: 'events'; rows: { date?: string; title: string; place?: string; href?: string }[] }
  | { kind: 'text'; heading?: string; paragraphs: string[]; href?: string; linkLabel: string }
  | { kind: 'image'; image: EmailImage; caption?: string; href?: string }
) & {
  /** The block it was built from, so the visual editor can show each block's part. */
  blockId?: string
}

export type Issue = {
  subject: string
  /** The logo's address: Blob storage when available (lib/email-logo.ts). */
  logo: string
  preheader?: string
  masthead?: string
  issueLine?: string
  items: IssueItem[]
  site: string
  footer: {
    addressLines: string[]
    phone?: string
    generalEmail?: string
    pressEmail?: string
    social: { label: string; url: string }[]
  }
}

/** What the issue's blocks point at, already read from the site (public view only). */
export type Lookups = {
  projects: Map<number, Project>
  awards: Map<number, Award>
  press: Map<number, Press>
  media: Map<number, Media>
}

type Rel = number | { id: number } | null | undefined
const idOf = (v: Rel): number | undefined =>
  v == null ? undefined : typeof v === 'object' ? v.id : v
const ids = (v: Rel[] | null | undefined): number[] =>
  (v ?? []).map(idOf).filter((n): n is number => n != null)
const isObj = <T extends object>(v: unknown): v is T => typeof v === 'object' && v !== null
const clean = (s: string | null | undefined) => s?.trim() || undefined

/** Text with empty lines between paragraphs, as typed in the admin. */
export const toParagraphs = (s: string | null | undefined) =>
  (s ?? '')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)

/** An absolute address for an image, at a size that suits an email (2× the drawn width). */
export function emailImage(
  m: Media | undefined,
  size: 'card' | 'gallery',
  site = siteUrl(),
): EmailImage | undefined {
  if (!m) return undefined
  const filename = m.sizes?.[size]?.filename || m.filename
  if (!filename) return undefined
  const src = blobFileURL(filename)
  return { src: src.startsWith('http') ? src : `${site}${src}`, alt: m.alt }
}

const names = (v: unknown[] | null | undefined) =>
  (v ?? [])
    .filter(isObj<Firm | Photographer>)
    .map((f) => f.name)
    .filter(Boolean)
    .join(', ')

function projectCredits(p: Project): Credit[] {
  const out: Credit[] = []
  const architects = names(p.architects)
  if (architects)
    out.push({
      label: (p.architects?.length ?? 0) > 1 ? 'Architects' : 'Architect',
      value: architects,
    })
  // Absent on confidential projects: the public read removes them (Projects.ts, field access).
  const clients = p.confidential ? '' : names(p.clients)
  if (clients) out.push({ label: 'Client', value: clients })
  const photographers = names(p.photographers)
  if (photographers) out.push({ label: 'Photography', value: photographers })
  return out
}

const city = (p: Project) =>
  isObj<Location>(p.location) ? clean(p.location.displayName) : undefined
const media = (l: Lookups, v: Rel) => {
  const id = idOf(v)
  return id == null ? undefined : l.media.get(id)
}
const projectImage = (l: Lookups, p: Project, size: 'card' | 'gallery') =>
  emailImage(isObj<Media>(p.heroImage) ? p.heroImage : media(l, p.heroImage as Rel), size)

/**
 * A tile photo for projects side by side: the main image, else the first gallery photo (as on
 * the site), cropped to one shape so the tiles line up (lib/email-tile).
 */
const tileImage = (l: Lookups, p: Project, site: string): EmailImage | undefined => {
  const m = [p.heroImage, ...(p.gallery ?? []).map((g) => g.image)]
    .map((r) => (isObj<Media>(r) ? r : media(l, r as Rel)))
    .find((x): x is Media => Boolean(x?.filename))
  return m ? { src: emailTileURL(m, site), alt: m.alt } : undefined
}

type Block = NonNullable<Newsletter['content']>[number]

/** The issue's blocks, filled in; empty ones dropped and sections without content removed. */
export function buildItems(
  blocks: Block[] | null | undefined,
  l: Lookups,
  site = siteUrl(),
): IssueItem[] {
  const out: (IssueItem | { kind: 'section'; title: string })[] = []
  const href = (p: Project) => `${site}/projects/${p.slug}`
  for (const b of blocks ?? []) {
    const before = out.length
    switch (b.blockType) {
      case 'letter': {
        const paragraphs = toParagraphs(b.body)
        if (paragraphs.length)
          out.push({
            kind: 'letter',
            paragraphs,
            signatureName: clean(b.signatureName),
            signatureTitle: clean(b.signatureTitle),
          })
        break
      }
      case 'section':
        if (clean(b.title)) out.push({ kind: 'section', title: b.title!.trim() })
        break
      case 'project': {
        const id = idOf(b.project as Rel)
        const p = id == null ? undefined : l.projects.get(id)
        if (!p) break // not chosen, or not published
        out.push({
          kind: 'project',
          name: p.name,
          city: city(p),
          href: href(p),
          image: b.image
            ? emailImage(media(l, b.image as Rel), 'gallery', site)
            : projectImage(l, p, 'gallery'),
          paragraphs: toParagraphs(b.note || p.summary),
          credits: b.showCredits === false ? [] : projectCredits(p),
        })
        break
      }
      case 'projectGrid': {
        const projects = ids(b.projects as Rel[])
          .map((id) => l.projects.get(id))
          .filter((p): p is Project => Boolean(p))
          .map((p) => ({
            name: p.name,
            city: city(p),
            href: href(p),
            image: tileImage(l, p, site),
          }))
        if (projects.length) out.push({ kind: 'grid', projects })
        break
      }
      case 'conversation': {
        const answer = toParagraphs(b.answer)
        if (!clean(b.name) && !clean(b.question) && !answer.length) break
        out.push({
          kind: 'conversation',
          name: clean(b.name),
          role: clean(b.role),
          portrait: emailImage(media(l, b.portrait as Rel), 'card', site),
          question: clean(b.question),
          answer,
          href: clean(b.url),
          linkLabel: clean(b.linkLabel) ?? 'Read the conversation',
        })
        break
      }
      case 'awards': {
        const rows = ids(b.awards as Rel[])
          .map((id) => l.awards.get(id))
          .filter((a): a is Award => Boolean(a))
          .map((a) => {
            // Only a published project is filled in by the public read; a draft one stays an id.
            const p = isObj<Project>(a.project) ? a.project : undefined
            return {
              year: a.year ?? undefined,
              name: a.name,
              project: p?.name,
              href: p ? href(p) : undefined,
            }
          })
        if (rows.length) out.push({ kind: 'awards', rows })
        break
      }
      case 'press': {
        const rows = ids(b.items as Rel[])
          .map((id) => l.press.get(id))
          .filter((p): p is Press => Boolean(p))
          .map((p) => ({ outlet: clean(p.outlet), title: p.title, href: p.url }))
        if (rows.length) out.push({ kind: 'press', rows })
        break
      }
      case 'events': {
        const rows = (b.events ?? [])
          .filter((e) => clean(e.title))
          .map((e) => ({
            date: clean(e.date),
            title: e.title.trim(),
            place: clean(e.place),
            href: clean(e.url),
          }))
        if (rows.length) out.push({ kind: 'events', rows })
        break
      }
      case 'text': {
        const paragraphs = toParagraphs(b.body)
        if (!paragraphs.length && !clean(b.heading)) break
        out.push({
          kind: 'text',
          heading: clean(b.heading),
          paragraphs,
          href: clean(b.url),
          linkLabel: clean(b.linkLabel) ?? 'Read more',
        })
        break
      }
      case 'image': {
        const image = emailImage(media(l, b.image as Rel), 'gallery', site)
        if (image) out.push({ kind: 'image', image, caption: clean(b.caption), href: clean(b.url) })
        break
      }
    }
    if (out.length > before && b.id) (out[out.length - 1] as { blockId?: string }).blockId = b.id
  }
  // A heading with nothing under it (before the next heading, or at the end) is dropped; the rest
  // are numbered in order.
  const kept = out.filter(
    (item, i) => item.kind !== 'section' || (out[i + 1] && out[i + 1].kind !== 'section'),
  )
  let n = 0
  return kept.map((item) =>
    item.kind === 'section'
      ? { ...item, number: String(++n).padStart(2, '0') }
      : (item as IssueItem),
  )
}

const SOCIAL_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  facebook: 'Facebook',
  vimeo: 'Vimeo',
  youtube: 'YouTube',
  x: 'X',
  other: 'Link',
}

export function buildIssue(
  doc: Newsletter,
  l: Lookups,
  settings: Partial<SiteSetting>,
  site = siteUrl(),
  logo = `${site}/tda-logo-email.png`,
): Issue {
  const issueLine = [
    doc.issueNumber ? `No. ${doc.issueNumber}` : undefined,
    clean(doc.theme),
    clean(doc.season),
  ]
    .filter(Boolean)
    .join(' · ')
  return {
    subject: doc.subject,
    logo,
    preheader: clean(doc.preheader),
    masthead: clean(doc.masthead),
    issueLine: issueLine || undefined,
    items: buildItems(doc.content, l, site),
    site,
    footer: {
      addressLines: settings.address ? formatAddress(settings.address).lines : [],
      phone: clean(settings.phone),
      generalEmail: clean(settings.generalEmail),
      pressEmail: clean(settings.pressEmail),
      social: (settings.socialLinks ?? []).map((s) => ({
        label: SOCIAL_LABELS[s.platform] ?? 'Link',
        url: s.url,
      })),
    },
  }
}

/**
 * Reads what an issue points at, as the public sees it: unpublished projects are left out and a
 * confidential project's client is never read. The issue itself is read by the caller.
 */
export async function loadIssue(payload: Payload, doc: Newsletter): Promise<Issue> {
  const { lookups, settings } = await loadLookups(payload, doc.content)
  return buildIssue(doc, lookups, settings, siteUrl(), await emailLogo())
}

/** What some blocks point at, and the studio's details for the footer, read as the public sees them. */
export async function loadLookups(payload: Payload, content: Newsletter['content']) {
  const blocks = content ?? []
  const want = {
    projects: new Set<number>(),
    awards: new Set<number>(),
    press: new Set<number>(),
    media: new Set<number>(),
  }
  for (const b of blocks) {
    if (b.blockType === 'project') {
      const id = idOf(b.project as Rel)
      if (id != null) want.projects.add(id)
      const m = idOf(b.image as Rel)
      if (m != null) want.media.add(m)
    }
    if (b.blockType === 'projectGrid')
      ids(b.projects as Rel[]).forEach((id) => want.projects.add(id))
    if (b.blockType === 'awards') ids(b.awards as Rel[]).forEach((id) => want.awards.add(id))
    if (b.blockType === 'press') ids(b.items as Rel[]).forEach((id) => want.press.add(id))
    if (b.blockType === 'conversation' || b.blockType === 'image') {
      const m = idOf((b.blockType === 'conversation' ? b.portrait : b.image) as Rel)
      if (m != null) want.media.add(m)
    }
  }
  const read = async <T extends { id: number }>(
    collection: 'projects' | 'awards' | 'press' | 'media',
    set: Set<number>,
    depth: number,
  ) => {
    if (!set.size) return new Map<number, T>()
    const res = await payload.find({
      collection,
      where: { id: { in: [...set] } },
      depth,
      limit: set.size,
      pagination: false,
      overrideAccess: false, // the public view: published projects, no confidential clients
    })
    return new Map((res.docs as unknown as T[]).map((d) => [d.id, d]))
  }
  const [projects, awards, press, mediaDocs, settings] = await Promise.all([
    read<Project>('projects', want.projects, 1),
    read<Award>('awards', want.awards, 1),
    read<Press>('press', want.press, 0),
    read<Media>('media', want.media, 0),
    payload.findGlobal({ slug: 'siteSettings', depth: 0, overrideAccess: false }),
  ])
  return { lookups: { projects, awards, press, media: mediaDocs } as Lookups, settings }
}
