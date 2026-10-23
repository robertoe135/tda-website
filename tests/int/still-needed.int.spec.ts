import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import { stillNeeded } from '@/fields/stillNeeded'

describe('Still needed (admin flag on projects)', () => {
  it('lists what a project is missing, and a photographer only once it has photos', () => {
    expect(stillNeeded({ status: 'completed' })).toEqual(['photos', 'category', 'year', 'location', 'architect', 'write-up'])
    expect(stillNeeded({ status: 'in-progress', heroImage: 3, typologies: [1], location: 2, architects: [4], description: { root: { children: [{ text: 'Light.' }] } } })).toEqual(['approval', 'photographer'])
  })

  let payload: Payload
  let id: number
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    const created = await payload.create({ collection: 'projects', data: { name: 'Still Needed Fixture Hall', status: 'completed', _status: 'published' } })
    id = created.id
  })
  afterAll(async () => {
    await payload.delete({ collection: 'projects', id })
  })

  it('is worked out on read for editors and hidden from the public', async () => {
    const editor = await payload.findByID({ collection: 'projects', id })
    expect(editor.stillNeeded).toEqual(expect.arrayContaining(['photos', 'category', 'write-up']))
    const visitor = await payload.findByID({ collection: 'projects', id, overrideAccess: false })
    expect(visitor.stillNeeded).toBeUndefined()
  })
})
