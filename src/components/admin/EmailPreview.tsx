'use client'

import { RefreshRouteOnSave } from '@payloadcms/live-preview-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

/**
 * The email in a frame of its own (its styles stay its own), as tall as its content, redrawn
 * each time the admin autosaves the issue.
 */
export function EmailPreview({ html, empty }: { html: string; empty: boolean }) {
  const router = useRouter()
  const [height, setHeight] = useState(1200)
  return (
    <>
      <RefreshRouteOnSave
        refresh={() => router.refresh()}
        serverURL={typeof window === 'undefined' ? '' : window.location.origin}
      />
      {empty && (
        <p
          style={{
            margin: 0,
            padding: '12px 16px',
            font: '14px system-ui, sans-serif',
            background: '#fff3c4',
          }}
        >
          Nothing to show yet: fill in a block. Empty blocks are left out of the email.
        </p>
      )}
      <iframe
        title="Newsletter preview"
        srcDoc={html}
        style={{ display: 'block', width: '100%', height, border: 0 }}
        onLoad={(e) => {
          const doc = e.currentTarget.contentDocument
          if (doc) setHeight(doc.documentElement.scrollHeight)
        }}
      />
    </>
  )
}
