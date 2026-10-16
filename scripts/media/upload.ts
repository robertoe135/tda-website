/**
 * Shared by the photo commands: the database safety check, and uploading one photo the same
 * way every time (scaled to 3000 px and re-encoded on this computer; reused on a re-run).
 */
import { createHash } from 'crypto'

import type { Payload } from 'payload'
import sharp from 'sharp'

import { MAX_IMAGE_EDGE } from '../../src/hooks/sanitizeUpload'

export function dbHost() {
  try {
    return new URL(process.env.DATABASE_URL ?? '').hostname
  } catch {
    return ''
  }
}

export const isLocalDatabase = () => ['localhost', '127.0.0.1', '::1'].includes(dbHost())

/** Exits unless the database is on this computer, or a backup was confirmed and Blob is set. */
export function assertSafeTarget(confirmedBackup: boolean) {
  const local = isLocalDatabase()
  if (!local && !confirmedBackup) {
    console.error(`DATABASE_URL points at ${dbHost() || 'an unknown host'}, not this machine.`)
    console.error('Take a fresh backup (a Neon branch), then rerun with --confirm-backup.')
    process.exit(1)
  }
  // Without the Blob token Payload would write files to this computer's disk while a remote
  // database records them: broken images on the live site.
  if (!local && !process.env.BLOB_READ_WRITE_TOKEN) {
    console.error('BLOB_READ_WRITE_TOKEN is not set, so photos would be saved on this computer only.')
    console.error('Add the token from Vercel → Storage → tda-website-storage, then rerun.')
    process.exit(1)
  }
}

/**
 * Uploads a photo for a project, or returns the one already uploaded from the same file for
 * the same project. Per project: the same photo filed under two projects gets its own
 * description and credit.
 */
export async function uploadPhoto(
  payload: Payload,
  project: string,
  original: Buffer,
  data: { alt: string; photographer?: number },
): Promise<{ id: number; reused: boolean }> {
  const sourceHash = createHash('sha256').update(`${project}\n`).update(original).digest('hex')
  const existing = await payload.find({ collection: 'media', where: { sourceHash: { equals: sourceHash } }, limit: 1, depth: 0 })
  if (existing.docs[0]) return { id: existing.docs[0].id, reused: true }
  // Scale and re-encode here (TIFFs become JPEGs); the upload hook also strips metadata.
  const file = await sharp(original)
    .rotate()
    .resize({ width: MAX_IMAGE_EDGE, height: MAX_IMAGE_EDGE, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer()
  const media = await payload.create({
    collection: 'media',
    data: { ...data, sourceHash },
    file: { data: file, mimetype: 'image/jpeg', name: 'photo.jpg', size: file.length },
  })
  return { id: media.id, reused: false }
}
