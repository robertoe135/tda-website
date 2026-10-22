/**
 * Wraps the admin's fetch for photo uploads (components/admin/UploadGuard):
 *
 * 1. Photos are shrunk in the browser before they are sent, so a 12 MB camera JPEG fits
 *    Vercel's 4.5 MB request limit instead of being refused.
 * 2. When a save still fails without a proper answer from Payload (Vercel's own "too large"
 *    page, a timeout, a dropped connection), the admin gets an error it can read. Payload's
 *    bulk upload otherwise counts such a photo as saved: it shows "Successfully saved" while
 *    nothing was stored.
 *
 * Kept free of browser-only APIs so it can be tested; the shrinking itself is passed in.
 */

export type Shrink = (file: File) => Promise<File>

const UPLOAD_METHODS = new Set(['POST', 'PATCH'])

/** True for a save to the media collection: /api/media, /api/media/12, with or without a query. */
export function isMediaSave(url: string, method: string | undefined, apiRoute: string, collection = 'media'): boolean {
  if (!UPLOAD_METHODS.has((method ?? 'GET').toUpperCase())) return false
  let pathname: string
  try {
    pathname = new URL(url, 'http://admin.local').pathname
  } catch {
    return false
  }
  const base = `${apiRoute.replace(/\/+$/, '')}/${collection}`
  return pathname === base || new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/[^/]+$`).test(pathname)
}

// iPhone photos. Most browsers cannot open them to shrink them, and the server cannot either.
const HEIC = /^image\/hei[cf]/

/** The same form with every image file shrunk; undefined when a photo is HEIC even so. */
export async function shrinkForm(form: FormData, shrink: Shrink): Promise<FormData | undefined> {
  const out = new FormData()
  for (const [key, value] of form.entries()) {
    if (typeof value !== 'string' && value.type?.startsWith('image/')) {
      const file = await shrink(value as File)
      if (HEIC.test(file.type)) return undefined
      out.append(key, file, file.name)
    } else out.append(key, value)
  }
  return out
}

const errorResponse = (message: string) =>
  // 400 rather than the original status: Payload's bulk upload counts a 413 as a missing file
  // and loses the message. Field-free errors are shown as a toast and the photo stays unsaved.
  new Response(JSON.stringify({ errors: [{ message }] }), { status: 400, headers: { 'Content-Type': 'application/json' } })

export const TOO_LARGE =
  'This photo is still too large to upload, even after shrinking. Export it as a JPEG of about 3000 px on the long side and try again.'
export const HEIC_REFUSED = 'HEIC photos (from iPhones) cannot be uploaded. Export or save it as a JPEG and try again.'
export const NO_ANSWER = 'The server did not answer, so this photo was not saved. Check the connection and save it again.'

export function guardFetch(fetchImpl: typeof fetch, { apiRoute, shrink }: { apiRoute: string; shrink: Shrink }): typeof fetch {
  return async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : undefined
    if (!url || !(init?.body instanceof FormData) || !isMediaSave(url, init.method, apiRoute)) return fetchImpl(input, init)

    const body = await shrinkForm(init.body, shrink)
    if (!body) return errorResponse(HEIC_REFUSED)
    let res: Response
    try {
      res = await fetchImpl(input, { ...init, body })
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') throw error
      return errorResponse(NO_ANSWER)
    }
    if (res.ok || res.headers.get('content-type')?.includes('application/json')) return res
    return errorResponse(res.status === 413 ? TOO_LARGE : `${NO_ANSWER} (${res.status})`)
  }
}
