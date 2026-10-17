'use client'

import { useEffect, useState } from 'react'

/**
 * The Timeline's years as a column of dots fixed to the side of the window, one per year. The
 * dot of the year being read fills in as the page scrolls; pointing at a dot shows its year and
 * a click jumps there. Each dot is a link with its year as its name, so it works with a keyboard
 * and a screen reader, and without JavaScript (the dots then just don't follow the scroll).
 */
export function YearRail({ years }: { years: number[] }) {
  const [current, setCurrent] = useState(years[0])
  useEffect(() => {
    const sections = years.map((y) => document.getElementById(`year-${y}`)).filter((s): s is HTMLElement => Boolean(s))
    if (!sections.length || typeof IntersectionObserver === 'undefined') return
    const visible = new Map<string, boolean>()
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) visible.set(e.target.id, e.isIntersecting)
        // The first year (from the top) with part of its band in the reading zone.
        const first = sections.find((s) => visible.get(s.id))
        if (first) setCurrent(Number(first.id.replace('year-', '')))
      },
      // The reading zone: a band from just under the site header to the middle of the window.
      { rootMargin: '-80px 0px -50% 0px' },
    )
    sections.forEach((s) => io.observe(s))
    return () => io.disconnect()
  }, [years])

  return (
    <nav aria-label="Years" className="year-rail">
      <ol>
        {years.map((y) => (
          <li key={y}>
            <a href={`#year-${y}`} aria-current={y === current ? 'location' : undefined}>
              <span className="year-rail-label">{y}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  )
}
