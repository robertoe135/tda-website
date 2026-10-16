/**
 * Step 2 of the Squarespace migration: download every old page once, politely, to disk.
 *
 *   pnpm migrate:fetch                 # every URL in out/url-inventory.csv
 *   pnpm migrate:fetch --limit 5       # try a few first
 *   pnpm migrate:fetch --delay 4000    # slower (milliseconds between requests)
 *
 * Run on a normal internet connection (a laptop, not a cloud server: Squarespace blocks
 * many cloud IPs). Needs no database. Safe to stop and rerun: pages already saved are skipped.
 *
 * Saves each page's Squarespace JSON (`?format=json`) to cache/<site>/pages/, and falls back to the
 * page's HTML when JSON is unavailable. Does not download images; originals come from TDA's
 * file server. Everything goes to the gitignored cache because page data includes raw image
 * filenames, some of which name private clients.
 */
import { mkdir, readFile, stat, writeFile, appendFile } from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

// MIGRATE_SITE points the script at a local test server; leave unset for the real site.
export const SITE = process.env.MIGRATE_SITE ?? 'https://www.tillotsondesign.com'
export const USER_AGENT = 'TDA-website-migration/1.0 (one-time content migration by Tillotson Design Associates)'
const UA_TOKEN = 'tda-website-migration'

const here = path.dirname(fileURLToPath(import.meta.url))
const cacheDir = path.join(here, 'cache')
// One folder per site, so a test run against a local server can never pass for real pages.
const siteDir = path.join(cacheDir, new URL(SITE).host.replace(/[^a-z0-9.-]/gi, '_'))
const pagesDir = path.join(siteDir, 'pages')
const logFile = path.join(siteDir, 'fetch-log.csv')

// Pages search engines know about that the sitemap leaves out (site-audit.md, section 2).
const EXTRA_PATHS = ['/', '/nyu-steinhardt', '/upper-east-side-townhouse']

// ── robots.txt ───────────────────────────────────────────────────────────────

type Rule = { allow: boolean; pattern: string }

/** Rules from the group for our user agent, else the `*` group (RFC 9309). */
export function parseRobots(text: string, uaToken = UA_TOKEN): Rule[] {
  const groups: { agents: string[]; rules: Rule[] }[] = []
  let current: { agents: string[]; rules: Rule[] } | undefined
  let lastWasAgent = false
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim()
    const match = line.match(/^([a-z-]+)\s*:\s*(.*)$/i)
    if (!match) continue
    const key = match[1].toLowerCase()
    const value = match[2].trim()
    if (key === 'user-agent') {
      if (!current || !lastWasAgent) groups.push((current = { agents: [], rules: [] }))
      current.agents.push(value.toLowerCase())
      lastWasAgent = true
    } else {
      lastWasAgent = false
      if (current && (key === 'allow' || key === 'disallow') && value) {
        current.rules.push({ allow: key === 'allow', pattern: value })
      }
    }
  }
  const mine = groups.find((g) => g.agents.some((a) => a !== '*' && uaToken.includes(a)))
  return (mine ?? groups.find((g) => g.agents.includes('*')))?.rules ?? []
}

const toRegExp = (pattern: string) =>
  new RegExp(
    '^' +
      pattern
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*')
        .replace(/\\\$$/, '$'),
  )

/** Longest matching rule wins; Allow wins a tie. Path includes the query string. */
export function isAllowed(rules: Rule[], pathAndQuery: string): boolean {
  let best: Rule | undefined
  for (const rule of rules) {
    if (!toRegExp(rule.pattern).test(pathAndQuery)) continue
    if (
      !best ||
      rule.pattern.length > best.pattern.length ||
      (rule.pattern.length === best.pattern.length && rule.allow)
    ) {
      best = rule
    }
  }
  return best ? best.allow : true
}

// ── polite fetching ──────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export class RateLimited extends Error {}

/**
 * GET with backoff on 429/503 (honouring Retry-After). Gives up after `retries` attempts so
 * a blocked run stops instead of hammering the site.
 */
export async function politeGet(
  url: string,
  { retries = 4, baseBackoffMs = 30_000 }: { retries?: number; baseBackoffMs?: number } = {},
): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, redirect: 'follow' })
    if (res.status !== 429 && res.status !== 503) return res
    if (attempt >= retries) throw new RateLimited(`${res.status} after ${retries + 1} attempts: ${url}`)
    const retryAfter = Number(res.headers.get('retry-after'))
    const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : baseBackoffMs * 2 ** attempt
    console.log(`  ${res.status}; waiting ${Math.round(wait / 1000)}s before retrying`)
    await res.body?.cancel()
    await sleep(wait)
  }
}

export const cacheName = (pagePath: string) =>
  (pagePath === '/' ? 'index' : pagePath.slice(1).replace(/\//g, '__')).replace(/[^a-z0-9_.-]/gi, '_')

const exists = (file: string) =>
  stat(file).then(
    () => true,
    () => false,
  )

// ── main ─────────────────────────────────────────────────────────────────────

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`)
  return i > -1 ? process.argv[i + 1] : undefined
}

async function readInventory(): Promise<string[]> {
  const file = path.join(here, 'out', 'url-inventory.csv')
  const text = await readFile(file, 'utf8').catch(() => {
    throw new Error(`Missing ${file}. Run pnpm migrate:inventory first.`)
  })
  return text
    .split('\n')
    .slice(1)
    .map((line) => line.split(',')[0])
    .filter(Boolean)
}

async function main() {
  const delay = Number(arg('delay') ?? 2000)
  const limit = Number(arg('limit') ?? Infinity)
  const ignoreRobots = process.argv.includes('--ignore-robots')

  await mkdir(pagesDir, { recursive: true })
  if (!(await exists(logFile))) await writeFile(logFile, 'path,status,format,bytes,fetchedAt\n')

  const paths = [...new Set([...EXTRA_PATHS, ...(await readInventory())])]

  const robotsRes = await politeGet(`${SITE}/robots.txt`)
  const robotsText = robotsRes.ok ? await robotsRes.text() : ''
  await writeFile(path.join(siteDir, 'robots.txt'), robotsText)
  const rules = parseRobots(robotsText)

  let fetched = 0
  let skipped = 0
  let blocked = 0
  const failures: string[] = []

  for (const pagePath of paths) {
    if (fetched >= limit) break
    const base = path.join(pagesDir, cacheName(pagePath))
    if ((await exists(`${base}.json`)) || (await exists(`${base}.html`))) {
      skipped++
      continue
    }

    const jsonPath = `${pagePath}?format=json`
    const jsonAllowed = ignoreRobots || isAllowed(rules, jsonPath)
    const htmlAllowed = ignoreRobots || isAllowed(rules, pagePath)
    if (!jsonAllowed && !htmlAllowed) {
      blocked++
      await appendFile(logFile, `${pagePath},robots,,0,${new Date().toISOString()}\n`)
      continue
    }

    try {
      let saved = false
      if (jsonAllowed) {
        const res = await politeGet(`${SITE}${jsonPath}`)
        const body = await res.text()
        if (res.ok && body.trimStart().startsWith('{')) {
          await writeFile(`${base}.json`, body)
          await appendFile(logFile, `${pagePath},${res.status},json,${body.length},${new Date().toISOString()}\n`)
          saved = true
        } else if (res.status === 404) {
          await appendFile(logFile, `${pagePath},404,json,0,${new Date().toISOString()}\n`)
          failures.push(`${pagePath} (404)`)
          saved = true // a missing page is a result, not something to retry as HTML
        }
        await sleep(delay + Math.random() * 500)
      }
      if (!saved && htmlAllowed) {
        const res = await politeGet(`${SITE}${pagePath}`)
        const body = await res.text()
        await appendFile(logFile, `${pagePath},${res.status},html,${body.length},${new Date().toISOString()}\n`)
        if (res.ok) await writeFile(`${base}.html`, body)
        else failures.push(`${pagePath} (${res.status})`)
        await sleep(delay + Math.random() * 500)
      }
      fetched++
      if (fetched % 10 === 0) console.log(`  ${fetched} fetched, ${skipped} already saved`)
    } catch (error) {
      if (error instanceof RateLimited) {
        console.error(`\nStopped: the site is rate-limiting this computer (${error.message}).`)
        console.error('Wait an hour and run the same command again; saved pages are kept.')
        process.exitCode = 2
        break
      }
      throw error
    }
  }

  console.log(`\nDone. ${fetched} fetched, ${skipped} already saved, ${blocked} skipped by robots.txt.`)
  if (blocked) console.log('robots.txt disallows those addresses. It is TDA’s own site; rerun with --ignore-robots if marketing agrees.')
  if (failures.length) console.log(`${failures.length} not found or failed:\n  ${failures.join('\n  ')}`)
  console.log(`Saved to ${path.relative(process.cwd(), pagesDir)}. Log: ${path.relative(process.cwd(), logFile)}`)
}

// Run only when executed directly, so tests can import the helpers.
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
