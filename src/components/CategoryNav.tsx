'use client'

import Link from 'next/link'
import { useEffect, useRef } from 'react'

export type CategoryLink = { label: string; href: string; current: boolean }

/**
 * The portfolio's categories as one line of links. On a phone the line scrolls sideways, and
 * the chosen category is scrolled into view when the page opens.
 */
export function CategoryNav({ items }: { items: CategoryLink[] }) {
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    const nav = ref.current
    const current = nav?.querySelector<HTMLElement>('[aria-current="page"]')
    if (nav && current && nav.scrollWidth > nav.clientWidth) nav.scrollLeft = Math.max(0, current.offsetLeft - 60)
  }, [])
  return (
    <nav ref={ref} className="category-nav" aria-label="Categories">
      {items.map((item) => (
        <Link key={item.href} href={item.href} aria-current={item.current ? 'page' : undefined}>
          {item.label}
        </Link>
      ))}
    </nav>
  )
}
