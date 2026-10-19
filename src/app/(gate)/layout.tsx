import type { Metadata } from 'next'
import React from 'react'

import '@fontsource-variable/dm-sans'
import './gate.css'

export const metadata: Metadata = {
  title: 'Tillotson Design Associates',
  robots: { index: false, follow: false },
}

/** The password page before launch (src/proxy.ts): no menu or footer, which would lead to locked pages. */
export default function GateLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
