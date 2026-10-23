import { readFile } from 'fs/promises'
import path from 'path'

import { put } from '@vercel/blob'
import sharp from 'sharp'

import type { Media } from '@/payload-types'

import { blobFileURL } from './blob'

/**
 * Newsletter tiles side by side need photos of one shape, and email programs cannot crop
 * (Outlook and Gmail ignore object-fit). So each tile photo is sent already cropped.
 *
 * The crop is stored on Blob, beside the photos, the first time an issue uses it (storedTile),
 * and reused after. Like the logo (email-logo.ts), it must not load from the site's own
 * address: before launch that can be the old Squarespace site, and a preview deployment's
 * address is private. Without Blob (local development) it comes from the Images endpoint
 * /api/media/:id/email-tile instead.
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

/** The photo cropped to a tile around its focal point, as a JPEG. */
export async function renderTile(bytes: Buffer, focalX = 50, focalY = 50): Promise<Buffer | undefined> {
  // Upright first (uploads already are, but older files may carry a camera rotation).
  const upright = await sharp(bytes).rotate().toBuffer()
  const { width = 0, height = 0 } = await sharp(upright).metadata()
  if (!width || !height) return undefined
  return sharp(upright)
    .extract(focalCrop(width, height, EMAIL_TILE.width / EMAIL_TILE.height, focalX, focalY))
    .resize(EMAIL_TILE.width, EMAIL_TILE.height)
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer()
}

/** The Blob file name of a photo's tile: new whenever the photo or its focal point changes. */
export const tileFilename = (m: Pick<Media, 'id' | 'updatedAt'>) => `email-tile-${m.id}-${Date.parse(m.updatedAt) || 0}.jpg`

/**
 * The address of the photo's tile on Blob, made and uploaded the first time it is needed.
 * Undefined without Blob, or when the photo cannot be read; the caller falls back to the
 * Images endpoint.
 */
export async function storedTile(m: Media, token = process.env.BLOB_READ_WRITE_TOKEN): Promise<string | undefined> {
  if (!token?.startsWith('vercel_blob_rw_')) return undefined
  const name = tileFilename(m)
  const url = blobFileURL(name, token)
  try {
    const there = await fetch(url, { method: 'HEAD' })
    if (there.ok) return url
    const bytes = await mediaBytes(m)
    const tile = bytes && (await renderTile(bytes, m.focalX ?? 50, m.focalY ?? 50))
    if (!tile) return undefined
    const uploaded = await put(name, tile, { access: 'public', addRandomSuffix: false, allowOverwrite: true, contentType: 'image/jpeg', token })
    return uploaded.url
  } catch (e) {
    console.error('Newsletter tile upload failed', m.id, (e as Error).message)
    return undefined
  }
}

