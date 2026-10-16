import { getPayload, Payload } from 'payload'
import config from '@/payload.config'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

let payload: Payload
const prefix = `zz-test-${Date.now()}`

beforeAll(async () => {
  payload = await getPayload({ config: await config })
})

afterAll(async () => {
  await payload.delete({ collection: 'creditRoles', where: { name: { like: prefix } } })
  await payload.delete({ collection: 'awards', where: { name: { like: prefix } } })
  await payload.delete({ collection: 'press', where: { title: { like: prefix } } })
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

  it('hides the clients of a confidential project from the public API', async () => {
    const owner = await payload.create({ collection: 'firms', data: { name: `${prefix} Open Owner` } })
    const privateOwner = await payload.create({ collection: 'firms', data: { name: `${prefix} Private Owner` } })
    const open = await payload.create({
      collection: 'projects',
      data: { name: `${prefix} Open`, status: 'completed', clients: [owner.id], _status: 'published' },
    })
    const secret = await payload.create({
      collection: 'projects',
      data: {
        name: `${prefix} Residence`,
        status: 'completed',
        clients: [privateOwner.id],
        confidential: true,
        _status: 'published',
      },
    })
    const ids = (v: unknown) => (Array.isArray(v) ? v.map((c) => (typeof c === 'object' ? c.id : c)) : v)

    const publicOpen = await payload.findByID({ collection: 'projects', id: open.id, ...anon })
    const publicSecret = await payload.findByID({ collection: 'projects', id: secret.id, ...anon })
    expect(ids(publicOpen.clients)).toEqual([owner.id])
    expect(publicSecret.clients).toBeUndefined()

    const adminSecret = await payload.findByID({ collection: 'projects', id: secret.id })
    expect(ids(adminSecret.clients)).toEqual([privateOwner.id])
  })

  it('lists consultants in credits with an editable role', async () => {
    const role = await payload.create({ collection: 'creditRoles', data: { name: `${prefix} Structural Engineer` } })
    const firm = await payload.create({ collection: 'firms', data: { name: `${prefix} Severud` } })
    const doc = await payload.create({
      collection: 'projects',
      data: {
        name: `${prefix} Credited`,
        status: 'completed',
        areaSqFt: 1750000,
        certifications: [{ system: 'leed', level: 'platinum' }],
        credits: [{ role: role.id, firms: [firm.id] }],
      },
    })
    expect(doc.credits?.[0].firms).toHaveLength(1)
    expect(doc.areaSqFt).toBe(1750000)
    await expect(
      payload.create({ collection: 'creditRoles', data: { name: `${prefix} structural-engineer` } }),
    ).rejects.toThrow()
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
        data: { name: `${prefix} Bad Team`, status: 'completed', team: [{ person: hidden.id, role: 'designer' }] },
      }),
    ).rejects.toThrow()

    const ok = await payload.create({
      collection: 'projects',
      data: { name: `${prefix} Good Team`, status: 'completed', team: [{ person: shown.id, role: 'principal' }], _status: 'published' },
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

  it('shows awards and press on the project through joins', async () => {
    const project = await payload.create({
      collection: 'projects',
      data: { name: `${prefix} Awarded`, status: 'completed', _status: 'published' },
    })
    const award = await payload.create({
      collection: 'awards',
      data: { name: `${prefix} Award of Excellence`, year: 2024, project: project.id },
    })
    const article = await payload.create({
      collection: 'press',
      data: { title: `${prefix} Headline`, url: 'https://example.com/a', projects: [project.id] },
    })

    const doc = await payload.findByID({ collection: 'projects', id: project.id, ...anon })
    const idsOf = (docs?: unknown[]) => docs?.map((d) => (typeof d === 'object' && d ? (d as { id: unknown }).id : d))
    expect(idsOf(doc.awards?.docs)).toContain(award.id)
    expect(idsOf(doc.press?.docs)).toContain(article.id)
  })
})
