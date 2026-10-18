import type { Metadata } from 'next'

import { Breadcrumb } from '@/components/Breadcrumb'
import { MetaLink } from '@/components/MetaLink'
import { getCollaborators } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Collaborators — Tillotson Design Associates',
  description:
    'Architects, landscape architects and designers Tillotson Design Associates has worked with.',
  alternates: { canonical: '/about/collaborators' },
}

const LETTERS = ['#', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ']

/**
 * The firms marked "Show on Collaborators page" in the admin, A to Z. A firm with published
 * projects opens the portfolio filtered to it; the others are listed by name.
 */
export default async function CollaboratorsPage() {
  const groups = await getCollaborators()
  return (
    <div className="collaborators">
      <Breadcrumb trail={[{ href: '/about', label: 'about' }]} current="collaborators" />
      <h1 className="page-title page-title-large">Collaborators</h1>
      <nav aria-label="Jump to letter" className="letter-nav">
        {LETTERS.map((l) =>
          groups.some((g) => g.letter === l) ? (
            <a key={l} href={`#letter-${l === '#' ? 'other' : l}`}>
              {l}
            </a>
          ) : (
            <span key={l} aria-hidden="true">
              {l}
            </span>
          ),
        )}
      </nav>
      <div className="collaborator-list">
        {groups.map(({ letter, firms }) => (
          <section
            key={letter}
            id={`letter-${letter === '#' ? 'other' : letter}`}
            aria-label={letter === '#' ? 'Other' : letter}
          >
            <h3 className="collaborator-letter" aria-hidden="true">
              {letter}
            </h3>
            <ul>
              {firms.map((f) => (
                <li key={f.slug}>
                  {f.href ? <MetaLink href={f.href}>{f.name}</MetaLink> : f.name}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}
