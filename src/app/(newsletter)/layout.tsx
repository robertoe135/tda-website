import type { Metadata } from 'next'
import React from 'react'

export const metadata: Metadata = {
  title: 'Newsletter preview',
  robots: { index: false, follow: false },
}

/** The admin's newsletter preview: the email alone, without the site's menu or styles. */
export default function NewsletterLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#ececea' }}>{children}</body>
    </html>
  )
}
