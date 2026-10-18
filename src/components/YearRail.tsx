'use client'

import { useScrollSpy } from '@/hooks/useScrollSpy'

/**
 * The Timeline's years as a column of dots fixed to the side of the window, one per year. The
 * dot of the year being read fills in as the page scrolls; pointing at a dot shows its year and
 * a click jumps there. Each dot is a link with its year as its name, so it works with a keyboard
 * and a screen reader, and without JavaScript (the dots then just don't follow the scroll).
 */
export function YearRail({ years }: { years: number[] }) {
  const { current: index, pin } = useScrollSpy(
    () => years.map((y) => document.getElementById(`year-${y}`)).filter((s): s is HTMLElement => Boolean(s)),
    [years],
  )
  const current = years[index]

  return (
    <nav aria-label="Years" className="year-rail">
      <ol>
        {years.map((y, i) => (
          <li key={y}>
            <a href={`#year-${y}`} aria-current={y === current ? 'location' : undefined} onClick={() => pin(i)}>
              <span className="year-rail-label">{y}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  )
}
