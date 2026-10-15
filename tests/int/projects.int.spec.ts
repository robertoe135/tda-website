import { getPayload, Payload } from 'payload'
import config from '@/payload.config'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

let payload: Payload
const prefix = `zz-test-${Date.now()}`

beforeAll(async () => {
  payload = await getPayload({ config: await config })
})

afterAll(async () => {
  await payload.delete({ collection: 'projects', where: { name: { like: prefix } } })
  await payload.delete({ collection: 'people', where: { name: { like: prefix } } })
  await payload.delete({ collection: 'firms', where: { name: { like: prefix } } })
})

const anon = { overrideAccess: false } as const

describe('projects', () => {
  it('saves an incomplete draft (as the import will) but requires status to publish', async () => {
    const draft = await payload.create({
      collection: 'projects',
      data: { name: `${prefix} Imported Draft` },
      draft: true,
    })
    expect(draft._status).toBe('draft')
    expect(draft.slug).toBe(`${prefix}-imported-draft`)

    await expect(
      payload.update({
        collection: 'projects',
        id: draft.id,
        data: { _status: 'published' },
      }),
    ).rejects.toThrow()
  })

  it('hides drafts from the public', async () => {
    await payload.create({
      collection: 'projects',
      data: { name: `${prefix} Hidden Draft`, status: 'completed' },
      draft: true,
    })
    const result = await payload.find({
      collection: 'projects',
      where: { name: { equals: `${prefix} Hidden Draft` } },
      ...anon,
    })
    expect(result.docs).toHaveLength(0)
  })

  it('hides the client of a confidential project from the public API', async () => {
    const open = await payload.create({
      collection: 'projects',
      data: { name: `${prefix} Open`, status: 'completed', client: 'Open Client', _status: 'published' },
    })
    const secret = await payload.create({
      collection: 'projects',
      data: {
        name: `${prefix} Residence`,
        status: 'completed',
        client: 'Private Client',
        confidential: true,
        _status: 'published',
      },
    })

    const publicOpen = await payload.findByID({ collection: 'projects', id: open.id, ...anon })
    const publicSecret = await payload.findByID({ collection: 'projects', id: secret.id, ...anon })
    expect(publicOpen.client).toBe('Open Client')
    expect(publicSecret.client).toBeUndefined()

    const adminSecret = await payload.findByID({ collection: 'projects', id: secret.id })
    expect(adminSecret.client).toBe('Private Client')
  })

  it('only accepts team members who are shown on the site', async () => {
    const hidden = await payload.create({ collection: 'people', data: { name: `${prefix} Hidden Person` } })
    const shown = await payload.create({
      collection: 'people',
      data: { name: `${prefix} Shown Person`, showOnSite: true, _status: 'published' },
    })

    await expect(
      payload.create({
        collection: 'projects',
        data: { name: `${prefix} Bad Team`, status: 'completed', team: [hidden.id] },
      }),
    ).rejects.toThrow()

    const ok = await payload.create({
      collection: 'projects',
      data: { name: `${prefix} Good Team`, status: 'completed', team: [shown.id], _status: 'published' },
    })
    const person = await payload.findByID({ collection: 'people', id: shown.id, ...anon })
    expect(person.projects?.docs?.map((d) => (typeof d === 'object' ? d.id : d))).toContain(ok.id)
  })

  it("lists a firm's published projects through the join, not its drafts", async () => {
    const firm = await payload.create({ collection: 'firms', data: { name: `${prefix} Architects` } })
    const live = await payload.create({
      collection: 'projects',
      data: { name: `${prefix} Live`, status: 'completed', architects: [firm.id], _status: 'published' },
    })
    const draft = await payload.create({
      collection: 'projects',
      data: { name: `${prefix} Unpublished`, status: 'completed', architects: [firm.id] },
      draft: true,
    })

    const publicFirm = await payload.findByID({ collection: 'firms', id: firm.id, ...anon })
    const ids = publicFirm.projects?.docs?.map((d) => (typeof d === 'object' ? d.id : d))
    expect(ids).toContain(live.id)
    expect(ids).not.toContain(draft.id)
  })

  it('rejects an old address that is a full URL', async () => {
    await expect(
      payload.create({
        collection: 'projects',
        data: {
          name: `${prefix} Bad Legacy`,
          status: 'completed',
          legacyUrls: [{ path: 'https://tillotsondesign.com/corporate/x' }],
        },
      }),
    ).rejects.toThrow()
  })
})
