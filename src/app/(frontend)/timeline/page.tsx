import type { Metadata } from 'next'

import { ProjectTile } from '@/components/ProjectTile'
import { getTimeline } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Timeline — Tillotson Design Associates',
  description: 'Lighting design projects by Tillotson Design Associates, by year of completion.',
  alternates: { canonical: '/timeline' },
}

/** Published, completed projects by year. Built from each project's completion year. */
export default async function TimelinePage() {
  const years = await getTimeline()
  return (
    <div className="timeline">
      <h1 className="page-title">Timeline</h1>
      {years.map(({ year, projects }) => (
        <section key={year} className="timeline-year" aria-labelledby={`year-${year}`}>
          <h2 id={`year-${year}`} className="timeline-heading">
            {year}
          </h2>
          <ul className="tile-grid">
            {projects.map((p) => (
              <li key={p.id}>
                <ProjectTile project={p} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
