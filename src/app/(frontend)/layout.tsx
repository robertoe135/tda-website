import Link from 'next/link'
import React from 'react'

import { NavLink } from '@/components/NavLink'
import '@fontsource-variable/dm-sans'
import './styles.css'

export const metadata = {
  title: 'Tillotson Design Associates',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'),
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
          {/* TDA logo goes here once marketing supplies the logo file. */}
          <Link href="/" className="site-name">
            Tillotson Design Associates
          </Link>
          {/* Menu as on tillotsondesign.com. Timeline, About and Contact are added as those
              pages are built, so the menu never links to a page that does not exist. */}
          <nav aria-label="Main" className="site-nav">
            <NavLink href="/projects">Portfolio</NavLink>
          </nav>
        </header>
        <main id="main">{children}</main>
      </body>
    </html>
  )
}
