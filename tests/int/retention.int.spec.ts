import { getPayload, Payload } from 'payload'
import config from '@/payload.config'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { GET } from '@/app/cron/purge-leads/route'
import { purgeOldLeads, retentionCutoff } from '@/lib/retention'

let payload: Payload
const prefix = `zz-retain-${Date.now()}`

beforeAll(async () => {
  payload = await getPayload({ config: await config })
})

afterAll(async () => {
  await payload.delete({ collection: 'leads', where: { name: { like: prefix } } })
})

describe('lead retention', () => {
  it('counts six calendar months back', () => {
    expect(retentionCutoff(new Date('2026-10-17T12:00:00Z')).toISOString()).toBe('2026-04-17T12:00:00.000Z')
  })

  it('deletes only leads older than six months', async () => {
    const lead = await payload.create({ collection: 'leads', data: { type: 'career', status: 'new', name: `${prefix} Applicant`, email: 'a@example.com' } })
    // Today: too recent to delete.
    await purgeOldLeads(payload)
    expect((await payload.count({ collection: 'leads', where: { id: { equals: lead.id } } })).totalDocs).toBe(1)
    // Seven months from now: gone.
    const later = new Date(Date.now() + 7 * 31 * 24 * 3600_000)
    expect(await purgeOldLeads(payload, later)).toBeGreaterThanOrEqual(1)
    expect((await payload.count({ collection: 'leads', where: { id: { equals: lead.id } } })).totalDocs).toBe(0)
  })

  it('runs only for Vercel Cron, with the secret', async () => {
    const before = process.env.CRON_SECRET
    delete process.env.CRON_SECRET
    expect((await GET(new Request('http://x/cron/purge-leads'))).status).toBe(503)
    process.env.CRON_SECRET = 'test-secret'
    expect((await GET(new Request('http://x/cron/purge-leads', { headers: { authorization: 'Bearer wrong' } }))).status).toBe(401)
    const ok = await GET(new Request('http://x/cron/purge-leads', { headers: { authorization: 'Bearer test-secret' } }))
    expect(ok.status).toBe(200)
    expect(await ok.json()).toMatchObject({ ok: true })
    if (before === undefined) delete process.env.CRON_SECRET
    else process.env.CRON_SECRET = before
  })
})
