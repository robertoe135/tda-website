import { randomBytes } from 'crypto'
import type { CollectionBeforeOperationHook } from 'payload'
import sharp, { type Sharp } from 'sharp'

const REENCODE: Record<string, (img: Sharp) => Sharp> = {
  'image/jpeg': (img) => img.jpeg({ quality: 95, mozjpeg: true }),
  'image/png': (img) => img.png(),
  'image/webp': (img) => img.webp({ quality: 95 }),
  'image/avif': (img) => img.avif({ quality: 80 }),
  'image/tiff': (img) => img.tiff(),
}

// Longest side kept online. TDA's full-resolution masters stay on the file server; this is
// plenty for a 2400px hero on a high-density screen and keeps uploads under Vercel's 4.5 MB
// request limit.
export const MAX_IMAGE_EDGE = 3000

/**
 * Uploaded files are publicly reachable by filename, and the old site leaked a private
 * client's surname through image filenames. Every upload is renamed to a neutral random
 * name, and image metadata (EXIF, including GPS location of private residences) is
 * stripped from the original as well as the resized copies. Originals larger than
 * MAX_IMAGE_EDGE are scaled down.
 */
export const sanitizeUpload: CollectionBeforeOperationHook = async ({ args, operation, req }) => {
  if ((operation !== 'create' && operation !== 'update') || !req.file) return args

  const file = req.file
  const ext = file.name.includes('.') ? file.name.split('.').pop()?.toLowerCase() : undefined
  file.name = `tda-${randomBytes(6).toString('hex')}${ext ? `.${ext}` : ''}`

  const reencode = REENCODE[file.mimetype]
  if (reencode && file.data?.length) {
    // rotate() bakes in the EXIF orientation before the metadata is dropped.
    const image = sharp(file.data)
      .rotate()
      .resize({ width: MAX_IMAGE_EDGE, height: MAX_IMAGE_EDGE, fit: 'inside', withoutEnlargement: true })
    file.data = await reencode(image).toBuffer()
    file.size = file.data.length
  }

  return args
}
