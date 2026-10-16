/**
 * Step 1 of the Squarespace migration: inventory the old site from its sitemap.
 *
 *   pnpm migrate:inventory                      # fetch https://www.tillotsondesign.com/sitemap.xml
 *   pnpm migrate:inventory path/to/sitemap.xml  # or read a saved copy
 *
 * Reads only the sitemap. Writes:
 *   scripts/migrate/out/url-inventory.csv  every old URL, what kind of page it is, and for
 *                                          project pages the matching "full project credits" page
 *   scripts/migrate/out/review-inventory.csv anomalies for marketing, merged into review.csv
 *   scripts/migrate/cache/                 gitignored: sitemap snapshot and the image report,
 *                                          which contains raw filenames (some name private clients)
 *
 * Nothing here corrects a name. Suggestions in review.csv are for a person to accept or reject.
 */
import { mkdir, readFile, writeFile } from 'fs/promises'
import path from 'path'

import { XMLParser } from 'fast-xml-parser'

import { cacheDir, csv, jaccard, outDir, type ReviewRow, similarity, SITE, tokens, writeReview } from './lib'

type SitemapImage = { loc: string; title?: string; caption?: string }
type Page = { path: string; lastmod?: string; images: SitemapImage[] }
type Kind = 'typology-index' | 'project' | 'credits' | 'page'

const CREDITS_SUFFIX = /-(full-)?(project-|projects-)?credits$/

// ── input ────────────────────────────────────────────────────────────────────

async function loadSitemap(source?: string): Promise<string> {
  await mkdir(cacheDir, { recursive: true })
  if (source) return readFile(source, 'utf8')
  const res = await fetch(`${SITE}/sitemap.xml`, {
    headers: { 'User-Agent': 'TDA website migration (one request; contact marketing)' },
  })
  if (!res.ok) throw new Error(`Sitemap request failed: HTTP ${res.status}`)
  const xml = await res.text()
  await writeFile(path.join(cacheDir, `sitemap-${new Date().toISOString().slice(0, 10)}.xml`), xml)
  return xml
}

function parseSitemap(xml: string): Page[] {
  const parser = new XMLParser({
    ignoreAttributes: true,
    removeNSPrefix: true,
    isArray: (name) => name === 'url' || name === 'image',
  })
  const doc = parser.parse(xml) as {
    urlset: { url: { loc: string; lastmod?: string; image?: SitemapImage[] }[] }
  }
  return doc.urlset.url.map((u) => ({
    path: new URL(u.loc).pathname.replace(/\/$/, '') || '/',
    lastmod: u.lastmod,
    images: (u.image ?? []).map((i) => ({
      loc: String(i.loc),
      title: i.title ? String(i.title) : undefined,
      caption: i.caption ? String(i.caption) : undefined,
    })),
  }))
}

// ── helpers ──────────────────────────────────────────────────────────────────

const fileName = (loc: string) => decodeURIComponent(loc.split('/').pop() ?? '').replace(/\+/g, ' ')

// ── analysis ─────────────────────────────────────────────────────────────────

function classify(pages: Page[]) {
  const nested = pages.filter((p) => p.path.split('/').length === 3)
  const typologySlugs = [...new Set(nested.map((p) => p.path.split('/')[1]))].sort()
  const kindOf = (p: Page): Kind => {
    const parts = p.path.split('/')
    if (parts.length === 3) return 'project'
    if (CREDITS_SUFFIX.test(p.path)) return 'credits'
    if (typologySlugs.includes(parts[1])) return 'typology-index'
    return 'page'
  }
  return { typologySlugs, kindOf }
}

/**
 * Guesses which project each credits page belongs to, by shared words. Only a strong match
 * that clearly beats the runner-up is accepted; everything else is left for the fetch step,
 * which reads the "full project credits" link on each project page and is authoritative.
 */
function pairCredits(projectSlugs: string[], creditPaths: string[]) {
  return creditPaths.map((creditsPath) => {
    const base = creditsPath.slice(1).replace(CREDITS_SUFFIX, '')
    const ranked = projectSlugs
      .map((slug) => ({ slug, score: jaccard(tokens(base), tokens(slug)) }))
      .sort((a, b) => b.score - a.score)
    const [best, runnerUp] = ranked
    const confident = best.score >= 0.5 && best.score - (runnerUp?.score ?? 0) >= 0.2
    return { creditsPath, base, best, confident }
  })
}

function nearDuplicates(items: string[], label: string): ReviewRow[] {
  const rows: ReviewRow[] = []
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i]
      const b = items[j]
      const score = Math.max(jaccard(tokens(a), tokens(b)), similarity(a, b))
      if (score >= 0.75) {
        rows.push({
          url: `${SITE}/${a}`,
          field: label,
          asWritten: `${a} | ${b}`,
          suggested: '',
          note: `Two ${label.replace(/s$/, '')} pages with near-identical addresses (similarity ${score.toFixed(2)}). Same project twice, or two projects? Both old addresses must redirect.`,
        })
      }
    }
  }
  return rows
}

/** "Rhode Island School of Design" → "risd", so RISD_02.jpg counts as related. */
const initials = (s: string): string =>
  decodeURIComponent(s)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w && !['of', 'the', 'and', 'at', 'a', 'for'].includes(w))
    .map((w) => w[0])
    .join('')

/**
 * Images whose filename shares no word (or acronym) with the project they appear on. These
 * are wrong images, photographer job numbers, or (on residential pages) client surnames.
 * Number-only names (3.jpg, 6764.jpg) say nothing and are skipped. A file that appears on
 * many pages is site-wide (banner, footer) and is reported once rather than per page.
 * Filenames only go to the gitignored cache.
 */
function suspiciousImages(projects: Page[]) {
  const pagesPerFile = new Map<string, Set<string>>()
  for (const p of projects)
    for (const img of p.images)
      pagesPerFile.set(img.loc, (pagesPerFile.get(img.loc) ?? new Set()).add(p.path))
  const shared = new Set([...pagesPerFile].filter(([, pages]) => pages.size >= 5).map(([loc]) => loc))

  const findings: { path: string; file: string; title: string }[] = []
  for (const p of projects) {
    const slug = p.path.split('/')[2]
    const slugTokens = tokens(slug)
    const slugJoined = slug.replace(/-/g, '')
    for (const img of p.images) {
      if (!img.title || shared.has(img.loc)) continue // untitled images are thumbnails of other projects
      const base = fileName(img.loc).replace(/\.[a-z0-9]+$/i, '')
      const fileTokens = [...tokens(base)].filter((t) => /[a-z]{3,}/.test(t))
      if (!fileTokens.length) continue
      const titleTokens = tokens(img.title)
      const acronyms = [initials(img.title.replace(/^[^-]+-\s*/, '')), initials(slug.replace(/-/g, ' '))]
      const related = fileTokens.some(
        (t) =>
          slugTokens.has(t) ||
          (t.length >= 4 && slugJoined.includes(t)) ||
          titleTokens.has(t) ||
          acronyms.some((a) => a.length >= 2 && (a.includes(t) || t.includes(a))),
      )
      if (!related) findings.push({ path: p.path, file: fileName(img.loc), title: img.title })
    }
  }
  const sharedFiles = [...shared].map((loc) => ({ file: fileName(loc), pages: pagesPerFile.get(loc)!.size }))
  return { findings, sharedFiles }
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  const pages = parseSitemap(await loadSitemap(process.argv[2]))
  const { typologySlugs, kindOf } = classify(pages)

  const projects = pages.filter((p) => kindOf(p) === 'project')
  const projectSlugs = [...new Set(projects.map((p) => p.path.split('/')[2]))].sort()
  const creditPages = pages.filter((p) => kindOf(p) === 'credits').map((p) => p.path)
  const pairs = pairCredits(projectSlugs, creditPages)
  const creditsFor = new Map<string, string[]>()
  for (const pair of pairs) {
    if (!pair.confident) continue
    creditsFor.set(pair.best.slug, [...(creditsFor.get(pair.best.slug) ?? []), pair.creditsPath])
  }
  const categoriesFor = new Map<string, string[]>()
  for (const p of projects) {
    const [, typology, slug] = p.path.split('/')
    categoriesFor.set(slug, [...(categoriesFor.get(slug) ?? []), typology])
  }

  // url-inventory.csv
  const inventory = pages
    .map((p) => {
      const kind = kindOf(p)
      const parts = p.path.split('/')
      const slug = kind === 'project' ? parts[2] : ''
      return {
        path: p.path,
        kind,
        typology: kind === 'project' ? parts[1] : kind === 'typology-index' ? parts[1] : '',
        projectSlug: slug,
        alsoListedUnder: slug ? (categoriesFor.get(slug) ?? []).filter((t) => t !== parts[1]).join(' ') : '',
        creditsPage: slug ? (creditsFor.get(slug) ?? []).join(' ') : '',
        images: p.images.length,
        lastmod: p.lastmod ?? '',
      }
    })
    .sort((a, b) => a.kind.localeCompare(b.kind) || a.path.localeCompare(b.path))

  // review.csv
  const review: ReviewRow[] = []
  for (const pair of pairs) {
    if (!pair.confident) {
      review.push({
        url: `${SITE}${pair.creditsPath}`,
        field: 'credits page',
        asWritten: pair.creditsPath,
        suggested: '',
        note:
          pair.best.score >= 0.3
            ? `Unconfirmed: possibly ${pair.best.slug}. The fetch step will check the project page's credits link.`
            : 'No project page has a similar address. A project that exists only as a credits page, or an orphaned page?',
      })
    }
  }
  for (const [slug, credits] of creditsFor) {
    if (credits.length > 1) {
      review.push({
        url: `${SITE}${credits[0]}`,
        field: 'credits page',
        asWritten: credits.join(' | '),
        suggested: '',
        note: `Project ${slug} has ${credits.length} credits pages. Which one is current? Both addresses must redirect.`,
      })
    }
  }
  review.push(...nearDuplicates(projectSlugs, 'project slugs'))
  const { findings: suspicious, sharedFiles } = suspiciousImages(projects)
  const suspiciousByPage = new Map<string, number>()
  for (const s of suspicious) suspiciousByPage.set(s.path, (suspiciousByPage.get(s.path) ?? 0) + 1)
  // Residential filenames are the privacy risk; elsewhere a mismatch is usually an
  // abbreviation or photographer name, so those stay in the cache report only.
  for (const [pagePath, count] of suspiciousByPage) {
    if (!pagePath.startsWith('/residential/')) continue
    review.push({
      url: `${SITE}${pagePath}`,
      field: 'image filename',
      asWritten: `${count} image(s); filenames in cache/image-report.csv (not committed)`,
      suggested: '',
      note: 'Filename does not match the project and may name a private client. It is public in the current sitemap: rename the file in Squarespace now, and never use it as a caption.',
    })
  }

  await mkdir(outDir, { recursive: true })
  await writeFile(
    path.join(outDir, 'url-inventory.csv'),
    csv(inventory, ['path', 'kind', 'typology', 'projectSlug', 'alsoListedUnder', 'creditsPage', 'images', 'lastmod']),
  )
  const totalReview = await writeReview('inventory', review)
  await writeFile(
    path.join(cacheDir, 'image-report.csv'),
    csv(suspicious, ['path', 'file', 'title']) +
      '\nImages on 5+ project pages (site-wide, not per project)\n' +
      csv(sharedFiles, ['file', 'pages']),
  )

  const counts = inventory.reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.kind]: (acc[r.kind] ?? 0) + 1 }), {})
  console.log(`${pages.length} URLs:`, counts)
  console.log(`${projectSlugs.length} unique project slugs across ${typologySlugs.length} typologies: ${typologySlugs.join(', ')}`)
  console.log(`${pairs.filter((p) => p.confident).length}/${pairs.length} credits pages confidently matched to a project`)
  console.log(`${review.length} inventory review rows; review.csv now has ${totalReview}`)
  console.log(`${suspicious.length} suspicious image filenames on ${suspiciousByPage.size} pages, ${sharedFiles.length} site-wide images (cache/image-report.csv)`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
