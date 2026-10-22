/**
 * Size limits for photos uploaded in the admin. Shared by the browser (which shrinks photos
 * before sending them) and the server (which re-encodes them), so the two never disagree.
 */

// Longest side kept online. TDA's full-resolution masters stay on the file server; this is
// plenty for a 2400px hero on a high-density screen.
export const MAX_IMAGE_EDGE = 3000

// Vercel refuses any request over 4.5 MB before Payload sees it. The photo has to fit with the
// rest of the form, so the browser aims below that.
export const MAX_UPLOAD_BYTES = 4_000_000

/** Width and height that fit inside `max` on the longest side, never enlarged. */
export function fitInside(width: number, height: number, max = MAX_IMAGE_EDGE): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}
