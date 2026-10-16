import type { Metadata } from 'next'

import { AboutNav } from '@/components/AboutNav'
import { MetaLink } from '@/components/MetaLink'
import { filterHref } from '@/lib/projects'
import { getCollaborators } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Collaborators — Tillotson Design Associates',
  description: 'Architects Tillotson Design Associates has worked with.',
  alternates: { canonical: '/about/collaborators' },
}

/** Architects on published projects, A to Z; each opens the portfolio filtered to that firm. */
export default async function CollaboratorsPage() {
  const groups = await getCollaborators()
  return (
    <div className="collaborators">
      <h1 className="page-title">About</h1>
      <AboutNav />
      <h2 className="visually-hidden">Collaborators</h2>
      <div className="collaborator-list">
        {groups.map(({ letter, firms }) => (
          <section key={letter} aria-label={letter === '#' ? 'Other' : letter}>
            <h3 className="collaborator-letter" aria-hidden="true">
              {letter}
            </h3>
            <ul>
              {firms.map((f) => (
                <li key={f.slug}>
                  <MetaLink href={filterHref('architect', f.slug ?? '')}>{f.name}</MetaLink>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}
