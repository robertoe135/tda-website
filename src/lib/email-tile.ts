import { readFile } from 'fs/promises'
import path from 'path'

import type { Media } from '@/payload-types'

import { blobFileURL } from './blob'

/**
 * Newsletter tiles side by side need photos of one shape, and email programs cannot crop
 * (Outlook and Gmail ignore object-fit). So the newsletter asks for each tile photo already
 * cropped, from the Images endpoint /api/media/:id/email-tile (collections/Media.ts).
 */

/** 3:2, as on the site's project tiles; twice the width drawn in the email, for sharp screens. */
export const EMAIL_TILE = { width: 600, height: 400 } as const

/**
 * The largest area of the target shape that fits the photo, centred on its focal point (set in
 * the admin, as percentages) and moved inside the photo where it would overrun an edge.
 */
export function focalCrop(width: number, height: number, ratio: number, focalX = 50, focalY = 50) {
  const clamp = (v: number, max: number) => Math.round(Math.min(Math.max(v, 0), max))
  if (width / height > ratio) {
    const w = Math.round(height * ratio)
    return { left: clamp((focalX / 100) * width - w / 2, width - w), top: 0, width: w, height }
  }
  const h = Math.round(width / ratio)
  return { left: 0, top: clamp((focalY / 100) * height - h / 2, height - h), width, height: h }
}

/** The tile's address, changing whenever the photo or its focal point does. */
export const emailTileURL = (m: Pick<Media, 'id' | 'updatedAt'>, site: string) =>
  `${site}/api/media/${m.id}/email-tile?v=${Date.parse(m.updatedAt) || 0}`

/** The photo's bytes: from Blob in production, from ./media on disk in local development. */
export async function mediaBytes(m: Media): Promise<Buffer | undefined> {
  // The gallery size (1600 px) is plenty for a 600 px tile and quicker than the original.
  const filename = m.sizes?.gallery?.filename || m.filename
  if (!filename) return undefined
  const url = blobFileURL(filename)
  if (url.startsWith('http')) {
    const res = await fetch(url)
    return res.ok ? Buffer.from(await res.arrayBuffer()) : undefined
  }
  return readFile(path.resolve(process.cwd(), 'media', filename)).catch(() => undefined)
}
