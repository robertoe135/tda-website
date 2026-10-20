import { getPayload, type Payload } from 'payload'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { dropInProgress } from '../../scripts/migrate/drop-in-progress'
import { isPlaceholder, removePlaceholders } from '../../scripts/migrate/remove-placeholders'
import config from '@/payload.config'
import type { Project } from '@/payload-types'

let payload: Payload
const tag = `zc${Date.now().toString(36)}`
let typology: number

beforeAll(async () => {
  payload = await getPayload({ config })
  typology = (await payload.create({ collection: 'typologies', data: { name: `${tag} Typology` } })).id
})

afterAll(async () => {
  await payload.delete({ collection: 'projects', where: { name: { like: tag } } })
  await payload.delete({ collection: 'people', where: { name: { like: tag } } })
  await payload.delete({ collection: 'media', where: { alt: { like: tag } } })
  await payload.delete({ collection: 'typologies', where: { name: { like: tag } } })
})

const photo = async (alt: string, credit?: string) => {
  const data = await sharp({ create: { width: 40, height: 30, channels: 3, background: '#888' } }).jpeg().toBuffer()
  return (await payload.create({ collection: 'media', data: { alt, credit }, file: { data, mimetype: 'image/jpeg', name: `${tag}.jpg`, size: data.length } })).id
}

describe('removing placeholder photos', () => {
  it('knows a placeholder by its description or credit', () => {
    expect(isPlaceholder({ alt: 'Placeholder photograph 1' })).toBe(true)
    expect(isPlaceholder({ alt: 'Lobby at dusk', credit: '[Placeholder Photographer]' })).toBe(true)
    expect(isPlaceholder({ alt: 'The placeholder wall in the lobby', credit: 'Iwan Baan' })).toBe(false)
  })

  it('takes them off the live page and the draft, deletes them, and keeps one still in use', async () => {
    const fake = await photo(`Placeholder photograph ${tag}`, '[Placeholder Photographer]')
    const headshot = await photo(`Placeholder headshot ${tag}`)
    const real = await photo(`Concert hall at night ${tag}`, 'Iwan Baan')
    const project = await payload.create({
      collection: 'projects',
      data: { name: `${tag} Hall`, status: 'completed', typologies: [typology], summary: 'Live text.', heroImage: fake, gallery: [{ image: real }, { image: fake }], _status: 'published' },
    })
    await payload.update({ collection: 'projects', id: project.id, draft: true, data: { summary: 'Unpublished edit.' } })
    await payload.create({ collection: 'people', data: { name: `${tag} Person`, headshot }, draft: true })

    const { log } = await removePlaceholders(payload, true)
    expect(log.join('\n')).toMatch(/still used by a person’s headshot/)
    for (const draft of [false, true]) {
      const v = (await payload.findByID({ collection: 'projects', id: project.id, depth: 0, draft })) as Project
      expect(v.heroImage ?? null).toBeNull()
      expect(v.gallery?.map((g) => g.image)).toEqual([real])
      expect(v.summary).toBe(draft ? 'Unpublished edit.' : 'Live text.')
    }
    const left = (await payload.find({ collection: 'media', where: { alt: { like: tag } }, depth: 0 })).docs.map((m) => m.id).sort()
    expect(left).toEqual([headshot, real].sort())
  })
})

describe('deleting an in-progress copy', () => {
  it('moves its old address onto the live page of the project kept', async () => {
    const keep = await payload.create({
      collection: 'projects',
      data: { name: `${tag} Chapel of the Bay`, status: 'completed', typologies: [typology], summary: 'Live text.', _status: 'published' },
    })
    await payload.update({ collection: 'projects', id: keep.id, draft: true, data: { summary: 'Unpublished edit.' } })
    const stale = await payload.create({ collection: 'projects', draft: true, data: { name: `${tag} Bay Chapel`, status: 'in-progress', legacyUrls: [{ path: `/${tag}-chapel` }] } })
    await dropInProgress(payload, { stale: { id: stale.id, name: stale.name }, keep: { id: keep.id, name: keep.name } }, true)
    for (const draft of [false, true]) {
      const v = (await payload.findByID({ collection: 'projects', id: keep.id, depth: 0, draft })) as Project
      expect(v.legacyUrls?.map((l) => l.path)).toEqual([`/${tag}-chapel`])
      expect(v.summary).toBe(draft ? 'Unpublished edit.' : 'Live text.')
    }
  })
})
