import type { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'

import { NavLink } from '@/components/NavLink'
import { OrganizationJsonLd } from '@/components/OrganizationJsonLd'
import { SiteFooter } from '@/components/SiteFooter'
import { indexingAllowed } from '@/lib/seo'
import '@fontsource-variable/dm-sans'
import './styles.css'

// Every public page reads the database when it is requested, so publishing in the admin shows
// on the site at once, with no redeploy. Without this, pages with no URL parameters (home,
// timeline, About, contact) would be frozen at build time.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Tillotson Design Associates',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'),
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
            <img src="/tda-logo.svg" alt="Tillotson Design Associates" width={1000} height={414} className="site-logo" />
          </Link>
          {/* Menu as on tillotsondesign.com. */}
          <nav aria-label="Main" className="site-nav">
            <NavLink href="/projects">Portfolio</NavLink>
            <NavLink href="/timeline">Timeline</NavLink>
            <NavLink href="/about">About</NavLink>
            <NavLink href="/contact">Contact</NavLink>
          </nav>
        </header>
        <main id="main">{children}</main>
        <SiteFooter />
        <OrganizationJsonLd />
      </body>
    </html>
  )
}
