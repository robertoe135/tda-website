import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { config, GATE_COOKIE, gateToken, proxy } from '@/proxy'

const url = (path: string) => `http://localhost:3000${path}`
const post = (fields: Record<string, string>) =>
  new NextRequest(url('/unlock'), { method: 'POST', body: new URLSearchParams(fields) })

describe('the password on the site before launch', () => {
  beforeEach(() => {
    process.env.SITE_PASSWORD = 'lumen'
  })
  afterEach(() => {
    delete process.env.SITE_PASSWORD
  })

  it('is off when no password is set', async () => {
    delete process.env.SITE_PASSWORD
    const res = await proxy(new NextRequest(url('/projects')))
    expect(res.headers.get('x-middleware-rewrite')).toBeNull()
    expect(res.status).toBe(200)
  })

  it('shows the password page at the address asked for, not indexed', async () => {
    const res = await proxy(new NextRequest(url('/projects?view=map')))
    expect(res.status).toBe(401)
    const to = new URL(res.headers.get('x-middleware-rewrite')!)
    expect(to.pathname).toBe('/unlock')
    expect(to.searchParams.get('next')).toBe('/projects?view=map')
    expect(res.headers.get('x-robots-tag')).toBe('noindex')
  })

  it('lets the right password in for 30 days, and sends them on', async () => {
    const res = await proxy(post({ password: 'lumen', next: '/about/team' }))
    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toBe(url('/about/team'))
    const cookie = res.cookies.get(GATE_COOKIE)!
    expect(cookie.value).toBe(await gateToken('lumen'))
    expect(cookie.value).not.toContain('lumen')
    expect(cookie.httpOnly).toBe(true)
    expect(cookie.maxAge).toBe(30 * 24 * 60 * 60)
    const back = new NextRequest(url('/about/team'), {
      headers: { cookie: `${GATE_COOKIE}=${cookie.value}` },
    })
    expect((await proxy(back)).status).toBe(200)
  })

  it('turns a wrong password back, and a forged or old cookie away', async () => {
    const res = await proxy(post({ password: 'nope', next: '/careers' }))
    expect(res.headers.get('location')).toBe(url('/unlock?next=%2Fcareers&error=1'))
    expect(res.cookies.get(GATE_COOKIE)).toBeUndefined()
    const old = await gateToken('an-earlier-password')
    for (const value of ['forged', old]) {
      const req = new NextRequest(url('/'), { headers: { cookie: `${GATE_COOKIE}=${value}` } })
      expect((await proxy(req)).status).toBe(401)
    }
  })

  it('only sends people on to a page of this site', async () => {
    for (const next of ['//evil.com', 'https://evil.com', '/\\evil.com']) {
      const res = await proxy(post({ password: 'lumen', next }))
      expect(res.headers.get('location')).toBe(url('/'))
    }
  })

  it('never stands in front of the admin, its API, the cleanup job or files', () => {
    const re = new RegExp(`^${config.matcher[0]}$`)
    for (const path of ['/', '/projects', '/about/team', '/unlock'])
      expect(re.test(path)).toBe(true)
    for (const path of [
      '/admin',
      '/admin/collections/projects',
      '/api/users/me',
      '/cron/purge-leads',
      '/tda-logo.svg',
      '/robots.txt',
    ])
      expect(re.test(path)).toBe(false)
  })
})
