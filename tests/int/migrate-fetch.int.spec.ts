import { createServer, type Server } from 'http'
import type { AddressInfo } from 'net'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { cacheName, isAllowed, parseRobots, politeGet, RateLimited } from '../../scripts/migrate/fetch'

describe('robots.txt', () => {
  const robots = `
User-agent: *
Disallow: /config
Disallow: /*?format=json
Allow: /config/public

User-agent: GPTBot
Disallow: /
`
  const rules = parseRobots(robots)

  it('uses the * group when no group names us', () => {
    expect(isAllowed(rules, '/corporate/one-vanderbilt')).toBe(true)
    expect(isAllowed(rules, '/config/settings')).toBe(false)
  })

  it('applies wildcards and the longest match', () => {
    expect(isAllowed(rules, '/corporate/one-vanderbilt?format=json')).toBe(false)
    expect(isAllowed(rules, '/config/public/x')).toBe(true)
  })

  it('treats an empty robots.txt as allowing everything', () => {
    expect(isAllowed(parseRobots(''), '/anything?format=json')).toBe(true)
  })
})

describe('cache file names', () => {
  it('flattens paths into safe names', () => {
    expect(cacheName('/')).toBe('index')
    expect(cacheName('/corporate/one-vanderbilt')).toBe('corporate__one-vanderbilt')
  })
})

describe('politeGet', () => {
  let server: Server
  let base: string
  const hits = new Map<string, number>()

  beforeAll(async () => {
    server = createServer((req, res) => {
      const n = (hits.get(req.url!) ?? 0) + 1
      hits.set(req.url!, n)
      if (req.url === '/flaky' && n === 1) {
        res.writeHead(429, { 'Retry-After': '0' }).end()
      } else if (req.url === '/blocked') {
        res.writeHead(429).end()
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' }).end('{"ok":true}')
      }
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  })

  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())))

  it('retries after a 429 and returns the page', async () => {
    const res = await politeGet(`${base}/flaky`, { baseBackoffMs: 10 })
    expect(res.status).toBe(200)
    expect(hits.get('/flaky')).toBe(2)
  })

  it('gives up with RateLimited instead of hammering a blocking site', async () => {
    await expect(politeGet(`${base}/blocked`, { retries: 2, baseBackoffMs: 10 })).rejects.toBeInstanceOf(RateLimited)
    expect(hits.get('/blocked')).toBe(3)
  })
})
