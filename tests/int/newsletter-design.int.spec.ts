import { createLocalReq, getPayload, type Payload, type PayloadRequest } from 'payload'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { previewBlocks } from '@/collections/newsletters/endpoints'
import { blocksToPuck, puckToBlocks, toRef } from '@/lib/newsletter-puck'
import config from '@/payload.config'
import type { User } from '@/payload-types'

const putMock = vi.fn(async (name: string) => ({
  url: `https://store.public.blob.vercel-storage.com/${name}`,
}))
vi.mock('@vercel/blob', () => ({ put: (name: string) => putMock(name) }))

describe('the visual editor’s data', () => {
  const blocks = [
    { blockType: 'letter', id: 'b1', body: 'Hello', signatureName: 'A' },
    {
      blockType: 'project',
      id: 'b2',
      project: { id: 5, name: 'The Hall' },
      image: { id: 9, alt: 'Lobby', thumbnailURL: '/t.jpg' },
      showCredits: false,
      note: null,
    },
    { blockType: 'projectGrid', id: 'b3', projects: [{ id: 6, name: 'One' }, 7] },
    {
      blockType: 'awards',
      id: 'b4',
      awards: [{ id: 3, name: 'Merit', year: 2024, project: { id: 5, name: 'The Hall' } }],
    },
    { blockType: 'press', id: 'b5', items: [{ id: 4, title: 'A headline', outlet: 'Paper' }] },
    {
      blockType: 'events',
      id: 'b6',
      events: [
        { id: 'e1', title: 'Talk', date: 'May 20' },
        { id: 'e2', title: '' },
      ],
    },
    { blockType: 'unknown', id: 'b7' },
  ]

  it('shows what blocks point at by name, with a thumbnail for images', () => {
    const { content } = blocksToPuck(blocks)
    expect(content.map((c) => c.type)).toEqual([
      'letter',
      'project',
      'projectGrid',
      'awards',
      'press',
      'events',
    ])
    expect(content[1].props).toMatchObject({
      id: 'b2',
      project: { id: 5, label: 'The Hall' },
      image: { id: 9, label: 'Lobby', thumb: '/t.jpg' },
      showCredits: false,
    })
    expect(content[2].props.projects).toEqual([
      { project: { id: 6, label: 'One' } },
      { project: { id: 7, label: '#7' } },
    ])
    expect(content[3].props.awards).toEqual([{ award: { id: 3, label: '2024 Merit (The Hall)' } }])
    expect(content[4].props.items).toEqual([{ item: { id: 4, label: 'Paper: A headline' } }])
    expect(toRef(null, 'projects')).toBeNull()
  })

  it('saves them back as ids, keeping each block’s id and dropping empty events', () => {
    const back = puckToBlocks(blocksToPuck(blocks))
    expect(back).toEqual([
      { blockType: 'letter', id: 'b1', body: 'Hello', signatureName: 'A' },
      { blockType: 'project', id: 'b2', project: 5, image: 9, showCredits: false, note: null },
      { blockType: 'projectGrid', id: 'b3', projects: [6, 7] },
      { blockType: 'awards', id: 'b4', awards: [3] },
      { blockType: 'press', id: 'b5', items: [4] },
      { blockType: 'events', id: 'b6', events: [{ title: 'Talk', date: 'May 20' }] },
    ])
  })
})

describe('the email logo', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.resetModules()
    putMock.mockClear()
  })

  it('comes from the site itself without Blob storage (local development)', async () => {
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', '')
    const { emailLogo } = await import('@/lib/email-logo')
    expect(await emailLogo('https://tda.test')).toBe('https://tda.test/tda-logo-email.png')
  })

  it('is uploaded to Blob storage once, next to the photos, then reused', async () => {
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'vercel_blob_rw_abc123_secret')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 404 })),
    )
    const { emailLogo } = await import('@/lib/email-logo')
    const url = await emailLogo('https://tda.test')
    expect(url).toBe('https://store.public.blob.vercel-storage.com/tda-email-logo-2026.png') // as put() answered
    await emailLogo('https://tda.test')
    expect(putMock).toHaveBeenCalledTimes(1)
  })

  it('is not uploaded again when it is already there', async () => {
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'vercel_blob_rw_abc123_secret')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 200 })),
    )
    const { emailLogo } = await import('@/lib/email-logo')
    expect(await emailLogo()).toBe(
      'https://abc123.public.blob.vercel-storage.com/tda-email-logo-2026.png',
    )
    expect(putMock).not.toHaveBeenCalled()
  })
})

describe('the canvas', () => {
  let payload: Payload
  let user: User
  const email = `zz-design-${Date.now()}@example.com`

  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    user = (await payload.create({
      collection: 'users',
      data: { email, password: 'x-test-only-1', role: 'editor' },
    })) as User
  })
  afterAll(async () => {
    await payload.delete({ collection: 'users', where: { email: { equals: email } } })
  })

  const req = async (body: unknown, who: User | null = user) => {
    const r = (await createLocalReq(
      { user: who ? { ...who, collection: 'users' } : undefined },
      payload,
    )) as PayloadRequest
    r.json = async () => body
    return r
  }

  it('draws each block as the email will, numbering sections and leaving empty ones out', async () => {
    const res = await previewBlocks(
      await req({
        content: [
          { blockType: 'section', id: 's0', title: 'Nothing under me' },
          { blockType: 'section', id: 's1', title: 'Recent work' },
          { blockType: 'text', id: 't1', body: 'Some words.' },
          { blockType: 'letter', id: 'l1', body: '' },
        ],
        issue: { masthead: 'Journal', issueNumber: 4 },
      }),
    )
    expect(res.status).toBe(200)
    const { blocks, header, footer } = await res.json()
    expect(Object.keys(blocks)).toEqual(['s1', 't1'])
    expect(blocks.s1).toContain('01')
    expect(blocks.s1).toContain('Recent work')
    expect(blocks.t1).toContain('Some words.')
    expect(blocks.t1).not.toMatch(/<!DOCTYPE/i)
    expect(header).toContain('Journal')
    expect(header).toContain('No. 4')
    expect(footer).toContain('Unsubscribe')
  })

  it('is for logged-in editors only', async () => {
    expect((await previewBlocks(await req({ content: [] }, null))).status).toBe(401)
  })
})
