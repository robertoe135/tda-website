import type { CSSProperties } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'

import { YearRail } from '@/components/YearRail'
import { getTimeline } from '@/lib/site'
import { getStoryYears } from '@/lib/year-of-light'

export const metadata: Metadata = {
  title: 'Timeline — Tillotson Design Associates',
  description: 'Lighting design projects by Tillotson Design Associates, by year of completion.',
  alternates: { canonical: '/timeline' },
}

// Photos keep their own proportions; very wide or very tall ones are cropped to these limits so
// one panorama or one tall shot can't take over a row.
const MIN_RATIO = 0.66
const MAX_RATIO = 2
const NO_PHOTO_RATIO = 4 / 3

const tileRatio = (ratio?: number) =>
  ratio ? Math.min(MAX_RATIO, Math.max(MIN_RATIO, ratio)) : NO_PHOTO_RATIO

/**
 * Published, completed projects by year, picture first: each year is a band of photographs at
 * one height, each keeping its own proportions, filling the row edge to edge. The year is small
 * and stays at the top of its band while it scrolls. Project names show on hover and keyboard
 * focus, and always on touch screens. A project without a photo shows its name on a plain tile
 * until marketing uploads one.
 */
export default async function TimelinePage() {
  const [years, stories] = await Promise.all([getTimeline(), getStoryYears()])
  return (
    <div className="timeline">
      <h1 className="visually-hidden">Timeline</h1>
      {years.length > 1 && <YearRail years={years.map(({ year }) => year)} />}
      {years.map(({ year, projects }) => (
        <section
          key={year}
          id={`year-${year}`}
          className="timeline-year"
          aria-labelledby={`year-${year}-h`}
        >
          <h2 id={`year-${year}-h`} className="timeline-heading">
            {year}
            {stories.includes(year) && (
              <Link href={`/year-of-light/${year}`} className="timeline-story">
                Year of Light
              </Link>
            )}
          </h2>
          <ul className="timeline-shots">
            {projects.map((p) => (
              <li key={p.id} style={{ '--r': tileRatio(p.image?.ratio) } as CSSProperties}>
                <Link href={`/projects/${p.slug}`} className={p.image ? 'shot' : 'shot shot-empty'}>
                  {p.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.image.src}
                      srcSet={p.image.srcSet}
                      sizes="(min-width: 720px) 30vw, 60vw"
                      style={p.image.position ? { objectPosition: p.image.position } : undefined}
                      alt=""
                      loading="lazy"
                    />
                  )}
                  <span className="shot-name">{p.name}</span>
                </Link>
              </li>
            ))}
            {/* Takes the leftover space in the last row, so its photos keep their size. */}
            <li className="timeline-fill" aria-hidden="true" />
          </ul>
        </section>
      ))}
    </div>
  )
}
