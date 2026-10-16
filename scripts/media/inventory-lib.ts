/**
 * Pure helpers for the website-files inventory (no disk, no database): what kind of file
 * each is, what needs attention before upload, and hiding private folder names in the
 * printed summary.
 */
import { MAX_VIDEO_MB } from '../../src/collections/Videos'
import { MAX_IMAGE_EDGE } from '../../src/hooks/sanitizeUpload'

export type Kind = 'photo' | 'needs-export' | 'video' | 'document' | 'other'

const KINDS: Record<string, Kind> = {}
for (const e of ['jpg', 'jpeg', 'png', 'webp', 'gif', 'tif', 'tiff']) KINDS[e] = 'photo'
for (const e of ['heic', 'heif', 'ai', 'eps', 'cr2', 'cr3', 'nef', 'arw', 'dng', 'raf', 'orf', 'rw2']) KINDS[e] = 'needs-export'
for (const e of ['mp4', 'm4v', 'mov', 'webm', 'avi', 'mkv', 'wmv']) KINDS[e] = 'video'
for (const e of ['pdf', 'doc', 'docx', 'txt', 'rtf', 'pages', 'key', 'indd', 'idml', 'xls', 'xlsx', 'csv', 'md', 'ppt', 'pptx']) KINDS[e] = 'document'

export const extOf = (file: string) => (file.includes('.') ? file.split('.').pop()!.toLowerCase() : '')
export const kindOf = (file: string): Kind => KINDS[extOf(file)] ?? 'other'

/** Files and folders that are not content: macOS and Windows clutter, AppleDouble "._" files. */
export const isClutter = (name: string) =>
  name.startsWith('.') || ['thumbs.db', 'desktop.ini', '$recycle.bin', 'system volume information'].includes(name.toLowerCase())

/** Long side under this looks soft in the full-width slideshow on a large screen. */
export const SMALL_EDGE = 1600

export type Entry = { path: string; kind: Kind; bytes: number; width?: number; height?: number; unreadable?: boolean }

export function flagsFor(e: Entry): string[] {
  const flags: string[] = []
  const ext = extOf(e.path)
  if (e.kind === 'needs-export') flags.push('export as JPEG first')
  if (e.kind === 'video') {
    if (!['mp4', 'm4v', 'webm'].includes(ext)) flags.push('convert to MP4 (H.264)')
    if (e.bytes > MAX_VIDEO_MB * 1024 * 1024) flags.push(`video over ${MAX_VIDEO_MB} MB: export a shorter or smaller loop`)
  }
  if (e.kind === 'photo') {
    if (e.unreadable) flags.push('could not be read: re-export')
    else if (e.width && e.height && Math.max(e.width, e.height) < SMALL_EDGE) flags.push(`small (${Math.max(e.width, e.height)} px): may look soft`)
  }
  return flags
}

export const scaledOnUpload = (e: Entry) => Boolean(e.width && e.height && Math.max(e.width, e.height) > MAX_IMAGE_EDGE)

/**
 * Folder names after a "Residential"/"Private" folder can name private clients. The printed
 * summary (meant to be pasted into a chat or email) shows them as [private 1], [private 2]…;
 * the CSV on the computer keeps the real names.
 */
export function redactor() {
  const names = new Map<string, string>()
  return (relativePath: string) => {
    const parts = relativePath.split('/')
    const at = parts.findIndex((p) => /residen|private|confidential/i.test(p))
    if (at < 0) return relativePath
    return parts
      .map((p, i) => {
        if (i <= at) return p
        const key = parts.slice(0, i + 1).join('/')
        if (!names.has(key)) names.set(key, `[private ${names.size + 1}]`)
        return names.get(key)!
      })
      .join('/')
  }
}

export const mb = (bytes: number) => bytes / 1024 / 1024
export const formatSize = (bytes: number) =>
  bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(1)} GB` : bytes >= 1024 ** 2 ? `${mb(bytes).toFixed(0)} MB` : `${Math.ceil(bytes / 1024)} KB`

/**
 * Rough Blob storage per photo once uploaded: the copy scaled to 3000 px plus the four sizes
 * Payload makes (card 800, gallery 1600, hero 2400, social 1200×630). About 3.5 MB.
 */
export const BLOB_BYTES_PER_PHOTO = 3.5 * 1024 * 1024
