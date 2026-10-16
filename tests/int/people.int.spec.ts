import { getPayload, Payload } from 'payload'
import config from '@/payload.config'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

let payload: Payload
const prefix = `zz-test-${Date.now()}`

// What an anonymous visitor (REST/GraphQL, or Local API with access enforced) can see.
const publicFind = () =>
  payload.find({
    collection: 'people',
    overrideAccess: false,
    where: { name: { like: prefix } },
  })

beforeAll(async () => {
  payload = await getPayload({ config: await config })
})

afterAll(async () => {
  await payload.delete({ collection: 'people', where: { name: { like: prefix } } })
})

describe('people', () => {
  it('defaults to hidden from the site and to current staff', async () => {
    const doc = await payload.create({ collection: 'people', data: { name: `${prefix} Default` } })
    expect(doc.showOnSite).toBe(false)
    expect(doc.isCurrent).toBe(true)
    expect(doc.bio ?? null).toBeNull()
  })

  it('shows the public only published people with showOnSite on', async () => {
    await payload.create({
      collection: 'people',
      data: { name: `${prefix} Published Hidden`, showOnSite: false, _status: 'published' },
    })
    await payload.create({
      collection: 'people',
      data: { name: `${prefix} Draft Shown`, showOnSite: true },
      draft: true,
    })
    await payload.create({
      collection: 'people',
      data: { name: `${prefix} Published Shown`, showOnSite: true, _status: 'published' },
    })

    const result = await publicFind()
    expect(result.docs.map((d) => d.name)).toEqual([`${prefix} Published Shown`])
  })

  it('lets a script create a draft without a slug', async () => {
    const doc = await payload.create({
      collection: 'people',
      data: { name: `${prefix} Draft Import` },
      draft: true,
    })
    expect(doc.slug).toBe(`${prefix}-draft-import`)
    expect(doc._status).toBe('draft')
  })
})
