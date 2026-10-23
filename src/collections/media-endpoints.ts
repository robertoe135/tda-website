import type { PayloadHandler } from 'payload'
import sharp from 'sharp'

import { EMAIL_TILE, focalCrop, mediaBytes } from '@/lib/email-tile'

/**
 * GET /api/media/:id/email-tile: the photo cropped to the newsletter's tile shape around its
 * focal point (lib/email-tile). Public like the photo itself. Cached for a year: the address
 * changes when the photo or its focal point does.
 */
export const emailTile: PayloadHandler = async (req) => {
  const id = Number(req.routeParams?.id)
  const media = id ? await req.payload.findByID({ collection: 'media', id, overrideAccess: false, depth: 0 }).catch(() => undefined) : undefined
  const bytes = media && (await mediaBytes(media))
  if (!media || !bytes) return new Response('Not found', { status: 404 })

  // Upright first (uploads already are, but older files may carry a camera rotation).
  const upright = await sharp(bytes).rotate().toBuffer()
  const { width = 0, height = 0 } = await sharp(upright).metadata()
  if (!width || !height) return new Response('Not an image', { status: 415 })
  const crop = focalCrop(width, height, EMAIL_TILE.width / EMAIL_TILE.height, media.focalX ?? 50, media.focalY ?? 50)
  const out = await sharp(upright)
    .extract(crop)
    .resize(EMAIL_TILE.width, EMAIL_TILE.height)
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer()
  return new Response(new Uint8Array(out), {
    headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, immutable' },
  })
}
