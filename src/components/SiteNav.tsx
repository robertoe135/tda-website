'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

const ABOUT = [
  { href: '/about', label: 'Profile', exact: true },
  { href: '/about/team', label: 'Team' },
  { href: '/about/collaborators', label: 'Collaborators' },
]

/**
 * The main menu. On larger screens: portfolio, timeline, about (a small menu of Profile, Team
 * and Collaborators, opened by pointing at it or clicking) and contact. On phones: a Menu
 * button that opens the same links full screen, About's pages listed under it. Escape, a click
 * outside or following a link closes either one.
 */
export function SiteNav() {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  const about = useRef<HTMLLIElement>(null)

  const is = (href: string, exact?: boolean) =>
    pathname === href || (!exact && pathname.startsWith(`${href}/`))
  const current = (href: string, exact?: boolean) =>
    is(href, exact) ? ('page' as const) : undefined

  // A new page closes both menus.
  useEffect(() => {
    setMenuOpen(false)
    setAboutOpen(false)
  }, [pathname])

  // While the phone menu is open the page behind it does not scroll.
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [menuOpen])

  useEffect(() => {
    if (!menuOpen && !aboutOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false)
        setAboutOpen(false)
      }
    }
    const onClick = (e: MouseEvent) => {
      if (aboutOpen && about.current && !about.current.contains(e.target as Node))
        setAboutOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('click', onClick)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('click', onClick)
    }
  }, [menuOpen, aboutOpen])

  return (
    <>
      <button
        type="button"
        className="menu-button"
        aria-expanded={menuOpen}
        aria-controls="site-menu"
        onClick={() => setMenuOpen((o) => !o)}
      >
        <span className="menu-icon" data-open={menuOpen ? '' : undefined} aria-hidden="true">
          <span />
          <span />
        </span>
        <span className="menu-label">{menuOpen ? 'Close' : 'Menu'}</span>
      </button>
      <nav
        id="site-menu"
        aria-label="Main"
        className="site-nav"
        data-open={menuOpen ? '' : undefined}
      >
        <ul className="nav-list">
          <li>
            <Link href="/projects" aria-current={current('/projects')}>
              Portfolio
            </Link>
          </li>
          <li>
            <Link href="/timeline" aria-current={current('/timeline')}>
              Timeline
            </Link>
          </li>
          <li ref={about} className="nav-about" data-open={aboutOpen ? '' : undefined}>
            {/* Larger screens: a button that opens the About menu. Phones: a label over its pages. */}
            <button
              type="button"
              className="nav-about-button"
              aria-expanded={aboutOpen}
              aria-controls="about-menu"
              data-current={is('/about') ? '' : undefined}
              onClick={() => setAboutOpen((o) => !o)}
            >
              About
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            <span className="nav-about-label">About</span>
            <ul id="about-menu" className="nav-sub">
              {ABOUT.map((a) => (
                <li key={a.href}>
                  <Link href={a.href} aria-current={current(a.href, a.exact)}>
                    {a.label}
                  </Link>
                </li>
              ))}
            </ul>
          </li>
          <li>
            <Link href="/contact" aria-current={current('/contact')}>
              Contact
            </Link>
          </li>
        </ul>
      </nav>
    </>
  )
}
