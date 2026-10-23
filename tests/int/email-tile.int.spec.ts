import { createLocalReq, getPayload, type Payload, type PayloadRequest } from 'payload'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { emailTile } from '@/collections/media-endpoints'
import { EMAIL_TILE, emailTileURL, focalCrop } from '@/lib/email-tile'
import config from '@/payload.config'
import type { Media } from '@/payload-types'

describe('newsletter tile photos', () => {
  it('crops the largest 3:2 area around the focal point, kept inside the photo', () => {
    // Wide photo, focal point far left: the crop starts at the left edge.
    expect(focalCrop(3000, 1000, 1.5, 0, 50)).toEqual({ left: 0, top: 0, width: 1500, height: 1000 })
    // Centred focal point.
    expect(focalCrop(3000, 1000, 1.5, 50, 50)).toEqual({ left: 750, top: 0, width: 1500, height: 1000 })
    // Tall photo, focal point near the bottom: the crop stops at the bottom edge.
    expect(focalCrop(1000, 2000, 1.5, 50, 95)).toEqual({ left: 0, top: 1333, width: 1000, height: 667 })
  })

  describe('the Images endpoint', () => {
    let payload: Payload
    let media: Media
    const tag = `zt${Date.now().toString(36)}`

    beforeAll(async () => {
      payload = await getPayload({ config })
      // A tall photo, red at the top and blue at the bottom, focal point on the blue.
      const top = await sharp({ create: { width: 800, height: 600, channels: 3, background: '#c00' } }).png().toBuffer()
      const data = await sharp({ create: { width: 800, height: 1200, channels: 3, background: '#00c' } })
        .composite([{ input: top, top: 0, left: 0 }])
        .jpeg()
        .toBuffer()
      media = await payload.create({
        collection: 'media',
        data: { alt: `${tag} tile test`, focalX: 50, focalY: 90 },
        file: { data, mimetype: 'image/jpeg', name: `${tag}.jpg`, size: data.length },
      })
    })

    afterAll(async () => {
      await payload.delete({ collection: 'media', where: { alt: { like: tag } } })
    })

    const call = async (id: number) => {
      const r = (await createLocalReq({}, payload)) as PayloadRequest
      r.routeParams = { id: String(id) }
      return emailTile(r)
    }

    it('returns the photo at 600 × 400, around its focal point, cached for a year', async () => {
      const res = await call(media.id)
      expect(res.status).toBe(200)
      expect(res.headers.get('Content-Type')).toBe('image/jpeg')
      expect(res.headers.get('Cache-Control')).toMatch(/max-age=31536000/)
      const out = Buffer.from(await res.arrayBuffer())
      expect(await sharp(out).metadata()).toMatchObject({ width: EMAIL_TILE.width, height: EMAIL_TILE.height })
      // The crop is from the blue (lower) part, where the focal point is.
      const { dominant } = await sharp(out).stats()
      expect(dominant.b).toBeGreaterThan(dominant.r)
    })

    it('says not found for a photo that does not exist', async () => {
      expect((await call(99999999)).status).toBe(404)
    })

    it('gives each photo an address that changes when the photo does', () => {
      expect(emailTileURL({ id: 7, updatedAt: '2026-10-23T10:00:00.000Z' }, 'https://tda.test')).toBe(
        `https://tda.test/api/media/7/email-tile?v=${Date.parse('2026-10-23T10:00:00.000Z')}`,
      )
    })
  })
})
