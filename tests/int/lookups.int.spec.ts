import { getPayload, Payload } from 'payload'
import config from '@/payload.config'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { normalizeName } from '@/hooks/preventNearDuplicates'

let payload: Payload
const prefix = `zz-test-${Date.now()}`

beforeAll(async () => {
  payload = await getPayload({ config: await config })
})

afterAll(async () => {
  for (const collection of ['typologies'] as const) {
    await payload.delete({ collection, where: { name: { like: prefix } } })
  }
})

describe('normalizeName', () => {
  it('collides spelling-only variants', () => {
    expect(normalizeName('OMA-Office for Metropolitan Architecture')).toBe(
      normalizeName('OMA - Office for Metropolitan Architecture'),
    )
    expect(normalizeName('Museums + Galleries')).toBe(normalizeName('museums+galleries'))
    expect(normalizeName('Café')).toBe(normalizeName('Cafe'))
  })

  it('keeps genuinely different names apart', () => {
    expect(normalizeName('Four Season')).not.toBe(normalizeName('Four Seasons'))
  })
})

describe('typologies', () => {
  it('generates a slug from the name and keeps it when the name changes', async () => {
    const created = await payload.create({
      collection: 'typologies',
      data: { name: `${prefix} Performing Arts` },
    })
    expect(created.slug).toBe(`${prefix}-performing-arts`)

    const renamed = await payload.update({
      collection: 'typologies',
      id: created.id,
      data: { name: `${prefix} Performing Arts + Music` },
    })
    expect(renamed.slug).toBe(`${prefix}-performing-arts`)
  })

  it('refuses a near-duplicate name and names the existing record', async () => {
    await payload.create({ collection: 'typologies', data: { name: `${prefix} Houses of Worship` } })

    await expect(
      payload.create({ collection: 'typologies', data: { name: `${prefix} houses-of worship` } }),
    ).rejects.toThrow()

    try {
      await payload.create({ collection: 'typologies', data: { name: `${prefix} HOUSES OF WORSHIP` } })
    } catch (error) {
      const data = (error as { data?: { errors?: { message: string }[] } }).data
      expect(data?.errors?.[0]?.message).toContain(`"${prefix} Houses of Worship" already exists`)
    }
  })

  it('allows saving an existing record without tripping on itself', async () => {
    const doc = await payload.create({ collection: 'typologies', data: { name: `${prefix} Retail` } })
    const updated = await payload.update({
      collection: 'typologies',
      id: doc.id,
      data: { order: 5 },
    })
    expect(updated.order).toBe(5)
  })
})

describe('toSlug', () => {
  it('makes clean URL segments', async () => {
    const { toSlug } = await import('@/fields/slug')
    expect(toSlug('Museums + Galleries')).toBe('museums-galleries')
    expect(toSlug('Café Boulud')).toBe('cafe-boulud')
    expect(toSlug('Restaurants & Hospitality')).toBe('restaurants-and-hospitality')
    expect(toSlug('New York, NY')).toBe('new-york-ny')
    expect(toSlug('  ')).toBeUndefined()
  })
})
