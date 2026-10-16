import type { Metadata } from 'next'
import Link from 'next/link'

import { getTimeline } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Timeline — Tillotson Design Associates',
  description: 'Lighting design projects by Tillotson Design Associates, by year of completion.',
  alternates: { canonical: '/timeline' },
}

/**
 * Published, completed projects by year, built from each project's completion year. Desktop:
 * the year in a column beside a grid of photographs. Phones: a compact list.
 */
export default async function TimelinePage() {
  const years = await getTimeline()
  return (
    <div className="timeline">
      <div className="page-head">
        <h1 className="page-title page-title-large">Timeline</h1>
        {years.length > 1 && (
          <nav aria-label="Years" className="year-nav">
            {years.map(({ year }) => (
              <a key={year} href={`#year-${year}`}>
                {year}
              </a>
            ))}
          </nav>
        )}
      </div>
      {years.map(({ year, projects }) => (
        <section key={year} id={`year-${year}`} className="timeline-year" aria-labelledby={`year-${year}-h`}>
          <h2 id={`year-${year}-h`} className="timeline-heading">
            {year}
          </h2>
          <ul className="timeline-list">
            {projects.map((p) => (
              <li key={p.id}>
                <Link href={`/projects/${p.slug}`} className="timeline-item">
                  <span className="timeline-thumb" aria-hidden="true">
                    {p.image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.image.src} alt="" loading="lazy" />
                    )}
                  </span>
                  <span className="timeline-name">{p.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
