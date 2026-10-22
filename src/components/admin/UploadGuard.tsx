'use client'

import { useConfig } from '@payloadcms/ui'
import { type ReactNode, useEffect } from 'react'

import { shrinkImage } from '@/lib/shrink-image'
import { guardFetch } from '@/lib/upload-guard'

/**
 * Admin-wide: photos are shrunk in the browser before upload, and a failed photo upload is
 * reported as failed (see lib/upload-guard). Covers every way to upload a photo: the Images
 * collection, bulk upload, a project's "Add several photos" and the upload drawers in fields.
 */
export function UploadGuard({ children }: { children?: ReactNode }) {
  const { config } = useConfig()
  const apiRoute = config.routes.api

  useEffect(() => {
    const original = window.fetch
    window.fetch = guardFetch(original.bind(window), { apiRoute, shrink: shrinkImage })
    return () => {
      window.fetch = original
    }
  }, [apiRoute])

  return <>{children}</>
}

export default UploadGuard
