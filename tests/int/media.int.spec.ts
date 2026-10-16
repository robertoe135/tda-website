import path from 'path'
import { getPayload, Payload } from 'payload'
import sharp from 'sharp'
import config from '@/payload.config'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

let payload: Payload
const prefix = `zz-test-${Date.now()}`
const ids: (number | string)[] = []

beforeAll(async () => {
  payload = await getPayload({ config: await config })
})

afterAll(async () => {
  for (const id of ids) await payload.delete({ collection: 'media', id })
  await payload.delete({ collection: 'photographers', where: { name: { like: prefix } } })
})

const jpegWithExif = () =>
  sharp({ create: { width: 64, height: 48, channels: 3, background: '#888' } })
    .jpeg()
    .withExif({ IFD0: { Artist: 'Private Client', ImageDescription: 'Smith Residence' } })
    .toBuffer()

describe('media uploads', () => {
  it('renames the file and strips metadata', async () => {
    const photographer = await payload.create({
      collection: 'photographers',
      data: { name: `${prefix} Photographer` },
    })
    const data = await jpegWithExif()
    expect((await sharp(data).metadata()).exif).toBeDefined()

    const doc = await payload.create({
      collection: 'media',
      data: { alt: 'Test image', photographer: photographer.id },
      file: { data, mimetype: 'image/jpeg', name: 'smith-residence-living-room.jpg', size: data.length },
    })
    ids.push(doc.id)

    expect(doc.filename).toMatch(/^tda-[0-9a-f]{12}\.jpg$/)
    expect(doc.filename).not.toContain('smith')
    expect(doc.sizes?.card?.filename ?? '').not.toContain('smith')

    const stored = await sharp(path.resolve(process.cwd(), 'media', doc.filename!)).metadata()
    expect(stored.exif).toBeUndefined()
  })

  it('requires a photographer or a credit', async () => {
    const data = await jpegWithExif()
    await expect(
      payload.create({
        collection: 'media',
        data: { alt: 'Uncredited' },
        file: { data, mimetype: 'image/jpeg', name: 'x.jpg', size: data.length },
      }),
    ).rejects.toThrow()

    const credited = await payload.create({
      collection: 'media',
      data: { alt: 'Credited', credit: 'Courtesy of the architect' },
      file: { data, mimetype: 'image/jpeg', name: 'x.jpg', size: data.length },
    })
    ids.push(credited.id)
    expect(credited.credit).toBe('Courtesy of the architect')
  })
})
