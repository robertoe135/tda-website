import type { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'

import { OrganizationJsonLd } from '@/components/OrganizationJsonLd'
import { SiteFooter } from '@/components/SiteFooter'
import { SiteNav } from '@/components/SiteNav'
import { indexingAllowed, siteUrl } from '@/lib/seo'
import '@fontsource-variable/dm-sans'
import './styles.css'

// Every public page reads the database when it is requested, so publishing in the admin shows
// on the site at once, with no redeploy. Without this, pages with no URL parameters (home,
// timeline, About, contact) would be frozen at build time.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Tillotson Design Associates',
  metadataBase: new URL(siteUrl()),
  // Not indexed until launch (src/lib/seo.ts): crawlers may read, but must not list, pages.
  ...(indexingAllowed() ? {} : { robots: { index: false, follow: true } }),
}

export default async function RootLayout(props: { children: React.ReactNode }) {
  const { children } = props

  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <header className="site-header">
          <Link href="/" className="site-name">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/tda-logo.svg"
              alt="Tillotson Design Associates"
              width={1000}
              height={414}
              className="site-logo"
            />
          </Link>
          <SiteNav />
        </header>
        <main id="main">{children}</main>
        <SiteFooter />
        <OrganizationJsonLd />
      </body>
    </html>
  )
}
