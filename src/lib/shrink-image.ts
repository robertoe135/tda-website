import { fitInside, MAX_IMAGE_EDGE, MAX_UPLOAD_BYTES } from './upload-limits'

/**
 * In the browser: a photo wider or taller than MAX_IMAGE_EDGE, or heavier than MAX_UPLOAD_BYTES,
 * is redrawn at that size and compressed until it fits. Other files are returned untouched, as
 * are formats this browser cannot open (HEIC outside Safari, for instance): the server then
 * answers, and the admin says so. The server still renames every photo and strips camera data.
 */

// Animated or vector images would lose what makes them what they are.
const LEAVE_AS_IS = new Set(['image/gif', 'image/svg+xml'])
// Transparency survives in PNG and WebP; everything else becomes a JPEG.
const KEEPS_ALPHA = new Set(['image/png', 'image/webp'])

const encode = (canvas: HTMLCanvasElement, type: string, quality?: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality))

const EXTENSIONS: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
const renamed = (name: string, type: string) => {
  const ext = EXTENSIONS[type]
  if (!ext) return name
  const stem = name.includes('.') ? name.slice(0, name.lastIndexOf('.')) : name
  return `${stem}.${ext}`
}

export async function shrinkImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || LEAVE_AS_IS.has(file.type)) return file

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    return file
  }
  try {
    const first = fitInside(bitmap.width, bitmap.height, MAX_IMAGE_EDGE)
    // HEIC (iPhone) is always converted when the browser can open it: the server cannot.
    const fits = first.width === bitmap.width && first.height === bitmap.height && file.size <= MAX_UPLOAD_BYTES
    if (fits && !/^image\/hei[cf]/.test(file.type)) return file

    // Lossless PNG first, then WebP (keeps transparency); photos as JPEG, at falling quality,
    // then smaller, until it fits.
    const attempts: [string, number | undefined][] = KEEPS_ALPHA.has(file.type)
      ? [
          [file.type, 0.92],
          ['image/webp', 0.9],
          ['image/webp', 0.8],
        ]
      : [
          ['image/jpeg', 0.92],
          ['image/jpeg', 0.85],
          ['image/jpeg', 0.78],
        ]
    let best: Blob | undefined
    for (const scale of [1, 0.8, 0.65]) {
      const { width, height } = fitInside(first.width * scale, first.height * scale, Infinity)
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d')
      if (!context) return file
      context.imageSmoothingEnabled = true
      context.imageSmoothingQuality = 'high'
      context.drawImage(bitmap, 0, 0, width, height)
      for (const [type, quality] of attempts) {
        const blob = await encode(canvas, type, quality)
        if (!blob) continue
        if (!best || blob.size < best.size) best = blob
        if (blob.size <= MAX_UPLOAD_BYTES) {
          canvas.width = canvas.height = 0
          return new File([blob], renamed(file.name, blob.type), { type: blob.type, lastModified: file.lastModified })
        }
      }
      canvas.width = canvas.height = 0
    }
    // Nothing fitted: send the smallest try, if smaller than the original; the server answers.
    return best && best.size < file.size ? new File([best], renamed(file.name, best.type), { type: best.type, lastModified: file.lastModified }) : file
  } finally {
    bitmap.close()
  }
}
