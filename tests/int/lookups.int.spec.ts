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
  await payload.delete({ collection: 'typologies', where: { name: { like: prefix } } })
  await payload.delete({ collection: 'locations', where: { city: { like: prefix } } })
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

describe('locations', () => {
  it('builds the display name and slug from city and state', async () => {
    const doc = await payload.create({
      collection: 'locations',
      data: { city: `${prefix} New York`, region: 'NY', country: 'United States' },
    })
    expect(doc.displayName).toBe(`${prefix} New York, NY`)
    expect(doc.slug).toBe(`${prefix}-new-york-ny`)
  })

  it('falls back to the country when there is no region', async () => {
    const doc = await payload.create({
      collection: 'locations',
      data: { city: `${prefix} London`, country: 'United Kingdom' },
    })
    expect(doc.displayName).toBe(`${prefix} London, United Kingdom`)
  })

  it('updates the display name on a partial update but keeps the slug', async () => {
    const doc = await payload.create({
      collection: 'locations',
      data: { city: `${prefix} Portland`, region: 'OR', country: 'United States' },
    })
    const updated = await payload.update({
      collection: 'locations',
      id: doc.id,
      data: { region: 'Oregon' },
    })
    expect(updated.displayName).toBe(`${prefix} Portland, Oregon`)
    expect(updated.slug).toBe(`${prefix}-portland-or`)
  })

  it('allows the same city name in different states', async () => {
    await payload.create({
      collection: 'locations',
      data: { city: `${prefix} Springfield`, region: 'IL', country: 'United States' },
    })
    const other = await payload.create({
      collection: 'locations',
      data: { city: `${prefix} Springfield`, region: 'MA', country: 'United States' },
    })
    expect(other.slug).toBe(`${prefix}-springfield-ma`)
  })

  it('refuses a near-duplicate city', async () => {
    await payload.create({
      collection: 'locations',
      data: { city: `${prefix} Minneapolis`, region: 'MN', country: 'United States' },
    })
    await expect(
      payload.create({
        collection: 'locations',
        data: { city: `${prefix} minneapolis`, region: 'mn', country: 'United States' },
      }),
    ).rejects.toThrow()
  })
})
