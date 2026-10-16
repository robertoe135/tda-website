/**
 * Does every address of the old site have somewhere to go? Reads out/url-inventory.csv and
 * checks each project and credits address against the projects' old addresses, and each
 * page against the redirects in next.config.ts and src/lib/legacy.ts. Reads only.
 *
 *   pnpm migrate:check-redirects            # all projects, published or not
 *   pnpm migrate:check-redirects --live     # only what redirects today (published projects)
 */
import '../env'

import { readFile } from 'fs/promises'
import path from 'path'

import { getPayload } from 'payload'

import config from '../../src/payload.config'
import { ALIASES, resolveLegacyPath } from '../../src/lib/legacy'
import { parseCsv } from '../team/lib'

import { outDir } from './lib'

// Pages handled in next.config.ts redirects, or deliberately left to 404 (see review-notes.csv).
const PAGES: Record<string, string> = {
  '/about-5': '/about',
  '/team': '/about/team',
  '/collaborators': '/about/collaborators',
  '/timeline': '/timeline',
  '/contact': '/contact',
}

async function main() {
  const live = process.argv.includes('--live')
  const [header, ...rows] = parseCsv(await readFile(path.join(outDir, 'url-inventory.csv'), 'utf8'))
  const col = (name: string) => header.indexOf(name)
  const payload = await getPayload({ config })
  const all = await payload.find({ collection: 'projects', draft: true, pagination: false, depth: 0, select: { legacyUrls: true } })
  const stored = new Set(all.docs.flatMap((p) => (p.legacyUrls ?? []).map((u) => u.path.toLowerCase())))

  const missing: string[] = []
  for (const row of rows) {
    const [p, kind] = [row[col('path')], row[col('kind')]]
    let ok: boolean
    const alias = ALIASES[p.toLowerCase()]
    if (live || kind === 'typology-index') ok = Boolean(PAGES[p] ?? (await resolveLegacyPath(p)))
    else if (kind === 'page') ok = Boolean(PAGES[p] ?? (alias && stored.has(alias)) ?? false) || Boolean(await resolveLegacyPath(p))
    else ok = stored.has(p.toLowerCase())
    if (!ok) missing.push(`${kind.padEnd(14)} ${p}`)
  }
  for (const m of missing) console.log(m)
  console.log(`\n${rows.length - missing.length} of ${rows.length} old addresses have a destination${live ? ' today' : ''}.`)
  process.exit(0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
