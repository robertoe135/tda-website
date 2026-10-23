import { createLocalReq, getPayload, type Payload, type PayloadRequest } from 'payload'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { sendNewsletter, sendTest } from '@/collections/newsletters/endpoints'
import { RESEND_UNSUBSCRIBE, renderNewsletter } from '@/emails/Newsletter'
import { buildIssue, buildItems, type Lookups, toParagraphs } from '@/lib/newsletter'
import { sendBroadcast } from '@/lib/resend'
import config from '@/payload.config'
import type { Award, Media, Newsletter, Press, Project, User } from '@/payload-types'

const site = 'https://example.test'
const project = (id: number, extra: Partial<Project> = {}): Project =>
  ({
    id,
    name: `Project ${id}`,
    slug: `project-${id}`,
    location: { id: 1, displayName: 'New York, NY' },
    architects: [{ id: 10, name: 'Firm A' }],
    clients: [{ id: 11, name: 'Owner B' }],
    photographers: [{ id: 12, name: 'Photographer C' }],
    summary: 'Summary from the site.',
    ...extra,
  }) as unknown as Project
const lookups = (projects: Project[] = [], extra: Partial<Lookups> = {}): Lookups => ({
  projects: new Map(projects.map((p) => [p.id, p])),
  awards: new Map(),
  press: new Map(),
  media: new Map(),
  ...extra,
})
type Blocks = NonNullable<Newsletter['content']>

describe('building an issue', () => {
  it('splits text into paragraphs at empty lines', () => {
    expect(toParagraphs('One\nstill one\n\n  Two  \n\n\n')).toEqual(['One\nstill one', 'Two'])
  })

  it('leaves out empty blocks and headings with nothing under them, and numbers the rest', () => {
    const blocks = [
      { blockType: 'letter', body: '' },
      { blockType: 'section', title: 'Recent work' },
      { blockType: 'project', project: 1 },
      { blockType: 'section', title: 'Conversation' },
      { blockType: 'conversation' },
      { blockType: 'section', title: 'Recognition' },
      { blockType: 'press', items: [] },
      { blockType: 'section', title: 'In progress' },
      { blockType: 'projectGrid', projects: [2, 99] }, // 99: not published, not in the lookups
    ] as unknown as Blocks
    const items = buildItems(blocks, lookups([project(1), project(2)]), site)
    expect(items.map((i) => (i.kind === 'section' ? `${i.number} ${i.title}` : i.kind))).toEqual([
      '01 Recent work',
      'project',
      '02 In progress',
      'grid',
    ])
    const grid = items[3]
    expect(grid.kind === 'grid' && grid.projects.map((p) => p.name)).toEqual(['Project 2'])
  })

  it('gives projects side by side photos of one shape: the main image, else the first gallery photo', () => {
    const photo = (id: number) => ({ id, alt: `Photo ${id}`, filename: `p${id}.jpg`, updatedAt: '2026-10-23T10:00:00.000Z' }) as unknown as Media
    const blocks = [{ blockType: 'projectGrid', projects: [1, 2, 3] }] as unknown as Blocks
    const items = buildItems(
      blocks,
      lookups([project(1, { heroImage: photo(5) }), project(2, { gallery: [{ image: photo(6) }] }), project(3)]),
      site,
    )
    const grid = items[0]
    expect(grid.kind === 'grid' && grid.projects.map((p) => p.image?.src)).toEqual([
      `${site}/api/media/5/email-tile?v=${Date.parse('2026-10-23T10:00:00.000Z')}`,
      `${site}/api/media/6/email-tile?v=${Date.parse('2026-10-23T10:00:00.000Z')}`,
      undefined, // no photo yet: a grey tile of the same shape
    ])
  })

  it('fills a project from the site, with credits, and falls back to its summary', () => {
    const [item] = buildItems(
      [{ blockType: 'project', project: 1, showCredits: true }] as unknown as Blocks,
      lookups([project(1)]),
      site,
    )
    expect(item).toMatchObject({
      kind: 'project',
      name: 'Project 1',
      city: 'New York, NY',
      href: `${site}/projects/project-1`,
      paragraphs: ['Summary from the site.'],
      credits: [
        { label: 'Architect', value: 'Firm A' },
        { label: 'Client', value: 'Owner B' },
        { label: 'Photography', value: 'Photographer C' },
      ],
    })
  })

  it('never shows the client of a confidential project, and hides credits when asked', () => {
    const secret = project(1, { confidential: true })
    const [a] = buildItems(
      [{ blockType: 'project', project: 1 }] as unknown as Blocks,
      lookups([secret]),
      site,
    )
    expect(a.kind === 'project' && a.credits.map((c) => c.label)).toEqual([
      'Architect',
      'Photography',
    ])
    const [b] = buildItems(
      [
        { blockType: 'project', project: 1, showCredits: false, note: 'Our note.' },
      ] as unknown as Blocks,
      lookups([project(1)]),
      site,
    )
    expect(b).toMatchObject({ credits: [], paragraphs: ['Our note.'] })
  })

  it('links an award to its project only when the project is published', () => {
    const awards = new Map<number, Award>([
      [1, { id: 1, name: 'Award of Merit', year: 2024, project: project(5) } as unknown as Award],
      [2, { id: 2, name: 'Citation', year: 2023, project: 6 } as unknown as Award], // a draft: an id only
    ])
    const [item] = buildItems(
      [{ blockType: 'awards', awards: [1, 2] }] as unknown as Blocks,
      lookups([], { awards }),
      site,
    )
    expect(item).toMatchObject({
      kind: 'awards',
      rows: [
        {
          year: 2024,
          name: 'Award of Merit',
          project: 'Project 5',
          href: `${site}/projects/project-5`,
        },
        { year: 2023, name: 'Citation', project: undefined, href: undefined },
      ],
    })
  })

  it('puts the masthead, issue line and the studio footer together', () => {
    const issue = buildIssue(
      {
        id: 1,
        subject: 'S',
        masthead: 'Journal',
        issueNumber: 3,
        theme: 'Heritage',
        season: 'Autumn 2026',
        content: [],
      } as unknown as Newsletter,
      lookups(),
      {
        address: {
          street: '40 Worth Street',
          suite: 'Ste. 703',
          city: 'New York',
          region: 'NY',
          postalCode: '10013',
        },
        socialLinks: [{ platform: 'instagram', url: 'https://instagram.com/x' }],
      },
      site,
    )
    expect(issue.issueLine).toBe('No. 3 · Heritage · Autumn 2026')
    expect(issue.footer.addressLines).toEqual(['40 Worth Street Ste. 703', 'New York, NY 10013'])
    expect(issue.footer.social).toEqual([{ label: 'Instagram', url: 'https://instagram.com/x' }])
  })
})

describe('the email', () => {
  const media = new Map<number, Media>([
    [
      7,
      {
        id: 7,
        alt: 'Lobby at night',
        filename: 'lobby.jpg',
        sizes: { gallery: { filename: 'lobby-1600.jpg' } },
      } as unknown as Media,
    ],
  ])
  const press = new Map<number, Press>([
    [3, { id: 3, title: 'A headline', outlet: 'Paper', url: 'https://paper.test/a' } as Press],
  ])
  const issue = buildIssue(
    {
      id: 1,
      subject: 'Subject',
      preheader: 'Three headlines',
      masthead: 'Journal',
      content: [
        { blockType: 'section', title: 'Recent work' },
        { blockType: 'project', project: 1, image: 7 },
        { blockType: 'press', items: [3] },
      ],
    } as unknown as Newsletter,
    lookups([project(1)], { media, press }),
    {},
    site,
  )

  it('is email HTML with absolute links and images, a PNG logo and the preview line', async () => {
    const { html, text } = await renderNewsletter(issue, { unsubscribeHref: RESEND_UNSUBSCRIBE })
    expect(html).toMatch(/^<!DOCTYPE html/i)
    expect(html).toContain('Three headlines')
    expect(html).toContain(`href="${site}/projects/project-1"`)
    expect(html).toMatch(/src="[^"]*\/api\/media\/file\/lobby-1600\.jpg"/)
    expect(html).toContain('alt="Lobby at night"')
    expect(html).toContain(`${site}/tda-logo-email.png`)
    expect(html).not.toMatch(/\.svg"/)
    expect(html).toContain(RESEND_UNSUBSCRIBE)
    expect(text).toContain('Project 1')
    expect(text).toContain('A headline')
  })

  it('has no unsubscribe line in the browser version', async () => {
    const { html } = await renderNewsletter(issue)
    expect(html).not.toContain('Unsubscribe')
  })
})

describe('Resend', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('sends a broadcast to the segment at once', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test')
    const fake = vi.fn(async () => Response.json({ id: 'b_1' }))
    const out = await sendBroadcast(
      { segmentId: 'seg', from: 'TDA <n@x.test>', subject: 'S', html: '<p>', name: 'No. 1' },
      fake as unknown as typeof fetch,
    )
    expect(out.id).toBe('b_1')
    const [url, init] = fake.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.resend.com/broadcasts')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer re_test')
    expect(JSON.parse(String(init.body))).toEqual({
      segment_id: 'seg',
      from: 'TDA <n@x.test>',
      subject: 'S',
      html: '<p>',
      name: 'No. 1',
      send: true,
    })
  })

  it('says why Resend refused', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test')
    const fake = async () =>
      Response.json({ message: 'The domain is not verified.' }, { status: 403 })
    await expect(
      sendBroadcast(
        { segmentId: 's', from: 'f', subject: 's', html: 'h', name: 'n' },
        fake as unknown as typeof fetch,
      ),
    ).rejects.toThrow('The domain is not verified.')
  })
})

describe('sending from the admin', () => {
  let payload: Payload
  let user: User
  let id: number
  const prefix = `zz-newsletter-${Date.now()}`
  const email = `${prefix}@example.com`
  let projectId: number
  let typologyId: number

  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    user = (await payload.create({
      collection: 'users',
      data: { email, password: 'x-test-only-1', role: 'admin' },
    })) as User
    // Its own published project: CI starts from an empty database.
    typologyId = (
      await payload.create({
        collection: 'typologies',
        data: { name: `${prefix} Halls`, slug: `${prefix}-halls` },
      })
    ).id
    projectId = (
      await payload.create({
        collection: 'projects',
        data: {
          name: `${prefix} Hall`,
          status: 'completed',
          typologies: [typologyId],
          _status: 'published',
        },
      })
    ).id
    const doc = await payload.create({
      collection: 'newsletters',
      draft: true,
      data: {
        subject: 'zz test issue',
        content: [{ blockType: 'project', project: projectId }],
      },
    })
    id = doc.id
  })

  afterAll(async () => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    await payload.delete({ collection: 'newsletters', id, overrideAccess: true }).catch(() => {})
    await payload.delete({ collection: 'users', where: { email: { equals: email } } })
    await payload.delete({ collection: 'projects', id: projectId, overrideAccess: true })
    await payload.delete({ collection: 'typologies', id: typologyId, overrideAccess: true })
  })

  const req = async (body: unknown = {}) => {
    const r = (await createLocalReq(
      { user: { ...user, collection: 'users' } },
      payload,
    )) as PayloadRequest
    r.routeParams = { id: String(id) }
    r.json = async () => body
    return r
  }

  it('refuses to send to the list until Resend is set up', async () => {
    vi.stubEnv('RESEND_API_KEY', '')
    expect((await sendNewsletter(await req())).status).toBe(503)
  })

  it('refuses an issue with unpublished changes', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test')
    vi.stubEnv('RESEND_SEGMENT_ID', 'seg')
    vi.stubEnv('NEWSLETTER_FROM', 'TDA <news@example.com>')
    const res = await sendNewsletter(await req())
    expect(res.status).toBe(409)
    expect((await res.json()).error).toContain('Publish')
  })

  it('sends the published issue once, then never again', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test')
    vi.stubEnv('RESEND_SEGMENT_ID', 'seg')
    vi.stubEnv('NEWSLETTER_FROM', 'TDA <news@example.com>')
    await payload.update({
      collection: 'newsletters',
      id,
      data: { _status: 'published' },
      overrideAccess: true,
    })
    const fake = vi.fn(async () => Response.json({ id: 'broadcast-1' }))
    vi.stubGlobal('fetch', fake)
    const res = await sendNewsletter(await req())
    expect(res.status).toBe(200)
    const sent = JSON.parse(
      String((fake.mock.calls[0] as unknown as [string, RequestInit])[1].body),
    )
    expect(sent.html).toContain(RESEND_UNSUBSCRIBE)
    expect(sent.html).toContain(`/newsletter/${id}`)
    const doc = await payload.findByID({ collection: 'newsletters', id, overrideAccess: true })
    expect(doc.sentAt).toBeTruthy()
    expect(doc.broadcastId).toBe('broadcast-1')
    expect((await sendNewsletter(await req())).status).toBe(409)
    expect(fake).toHaveBeenCalledTimes(1)

    // Sent: an editor can no longer change it (its browser page must match what went out)…
    const editor = { ...user, role: 'editor', collection: 'users' } as User & {
      collection: 'users'
    }
    await expect(
      payload.update({
        collection: 'newsletters',
        id,
        data: { subject: 'changed' },
        user: editor,
        overrideAccess: false,
      }),
    ).rejects.toThrow()
    // …and a duplicate, to send a correction, starts unsent.
    const copy = await payload.duplicate({ collection: 'newsletters', id, overrideAccess: true })
    expect(copy.sentAt ?? null).toBeNull()
    expect(copy.broadcastId ?? null).toBeNull()
    await payload.delete({ collection: 'newsletters', id: copy.id, overrideAccess: true })
  })

  it('takes the send back when Resend refuses', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test')
    vi.stubEnv('RESEND_SEGMENT_ID', 'seg')
    vi.stubEnv('NEWSLETTER_FROM', 'TDA <news@example.com>')
    await payload.update({
      collection: 'newsletters',
      id,
      data: { sentAt: null, broadcastId: null },
      overrideAccess: true,
    })
    vi.stubGlobal('fetch', async () => Response.json({ message: 'Rate limited' }, { status: 429 }))
    const res = await sendNewsletter(await req())
    expect(res.status).toBe(502)
    expect(
      (await payload.findByID({ collection: 'newsletters', id, overrideAccess: true })).sentAt,
    ).toBeFalsy()
  })

  it('sends a test only to real addresses, five at most', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test')
    vi.stubEnv('NEWSLETTER_FROM', 'TDA <news@example.com>')
    expect((await sendTest(await req({ to: 'not an address' }))).status).toBe(400)
    expect(
      (await sendTest(await req({ to: 'a@x.co,b@x.co,c@x.co,d@x.co,e@x.co,f@x.co' }))).status,
    ).toBe(400)
    const fake = vi.fn(async () => Response.json({ id: 'e1' }))
    vi.stubGlobal('fetch', fake)
    expect((await sendTest(await req({ to: 'me@example.com' }))).status).toBe(200)
    const body = JSON.parse(
      String((fake.mock.calls[0] as unknown as [string, RequestInit])[1].body),
    )
    expect(body).toMatchObject({ to: ['me@example.com'], subject: '[Test] zz test issue' })
    expect(body.html).not.toContain(RESEND_UNSUBSCRIBE)
  })
})
