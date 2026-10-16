/**
 * The public address of a stored file, the same one the Blob storage plugin gives a file when
 * it is read (payload.config.ts: photos load straight from Blob). Without a Blob token (local
 * development) files are on disk and Payload serves them itself.
 */
export function blobFileURL(filename: string, token = process.env.BLOB_READ_WRITE_TOKEN): string {
  const storeId = token?.match(/^vercel_blob_rw_([a-z\d]+)_[a-z\d]+$/i)?.[1]?.toLowerCase()
  if (!storeId) return `/api/media/file/${encodeURIComponent(filename)}`
  const base = process.env.STORAGE_VERCEL_BLOB_BASE_URL || `https://${storeId}.public.blob.vercel-storage.com`
  return `${base}/${encodeURIComponent(filename)}`
}
