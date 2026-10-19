import { put } from '@vercel/blob'

import { LOGO_FILE, LOGO_PNG_BASE64 } from '../emails/logo'
import { blobFileURL } from './blob'
import { siteUrl } from './seo'

/**
 * Where emails load the logo from. Photos load from Blob storage, which every inbox can reach;
 * the site's own address may not serve this site yet (before launch it can still be the old
 * Squarespace site), so the logo goes to Blob too: uploaded the first time it is needed, then
 * reused. Without Blob (local development) it comes from the site itself.
 */
let ready: Promise<string> | undefined

export function emailLogo(site = siteUrl()): Promise<string> {
  const token = process.env.BLOB_READ_WRITE_TOKEN
  const fallback = `${site}/tda-logo-email.png`
  if (!token?.startsWith('vercel_blob_rw_')) return Promise.resolve(fallback)
  ready ??= (async () => {
    const url = blobFileURL(LOGO_FILE, token)
    const there = await fetch(url, { method: 'HEAD' }).catch(() => undefined)
    if (there?.ok) return url
    const uploaded = await put(LOGO_FILE, Buffer.from(LOGO_PNG_BASE64, 'base64'), {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'image/png',
      token,
    })
    return uploaded.url
  })().catch((e) => {
    ready = undefined // try again next time
    console.error('Email logo upload failed', (e as Error).message)
    return fallback
  })
  return ready
}

/** Whether `site` serves this website, so links in emails lead here and not to another site. */
export async function siteServesThis(site = siteUrl()): Promise<boolean> {
  try {
    const res = await fetch(`${site}/tda-logo-email.png`, {
      method: 'HEAD',
      signal: AbortSignal.timeout(4000),
      redirect: 'manual',
    })
    return res.ok
  } catch {
    return false
  }
}
