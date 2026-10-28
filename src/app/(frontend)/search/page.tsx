import type { Metadata } from 'next'
import Link from 'next/link'

import { PROJECT_STATUS } from '@/lib/projects'
import { getSearchIndex, searchProjects, searchShortcuts } from '@/lib/search'
import type { Project } from '@/payload-types'

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const q = (await searchParams).q
  return {
    title: `${typeof q === 'string' && q.trim() ? `${q.trim()} — ` : ''}Search — Tillotson Design Associates`,
    // Results pages are for visitors, not search engines.
    robots: { index: false, follow: true },
    alternates: { canonical: '/search' },
  }
}

/**
 * Search the portfolio by any word: a building, a year, a place, a category, an architect, an
 * owner, any credited firm or role, a TDA team member, a photographer (lib/search). Works without
 * JavaScript: the box is a plain form.
 */
export default async function SearchPage({ searchParams }: Props) {
  const raw = (await searchParams).q
  const q = (typeof raw === 'string' ? raw : '').trim().slice(0, 100)
  const docs = q ? await getSearchIndex() : []
  const results = q ? searchProjects(docs, q) : []
  const shortcuts = q ? searchShortcuts(docs, q) : []

  return (
    <div className="search">
      <h1 className="page-title">Search</h1>
      <form action="/search" method="get" role="search" className="search-form">
        <label htmlFor="search-q" className="visually-hidden">
          Search projects
        </label>
        <input
          id="search-q"
          name="q"
          type="search"
          defaultValue={q}
          placeholder="A building, a year, an architect, an engineer…"
          autoComplete="off"
          enterKeyHint="search"
        />
        <button type="submit">Search</button>
      </form>

      {!q && <p className="search-hint">Search every project by name, year, place, category, architect, owner, any credited firm, TDA team member or photographer.</p>}

      {q && shortcuts.length > 0 && (
        <nav aria-label="Go to" className="search-shortcuts">
          {shortcuts.map((s) => (
            <Link key={s.href} href={s.href} className="chip">
              {s.label} <span className="search-kind">{s.kind}</span>
            </Link>
          ))}
        </nav>
      )}

      {q && (
        <p className="search-count" aria-live="polite">
          {results.length === 0
            ? <>No projects match &ldquo;{q}&rdquo;. Try fewer words, or <Link href="/projects?status=all&view=list">browse every project</Link>.</>
            : `${results.length} ${results.length === 1 ? 'project' : 'projects'} for “${q}”`}
        </p>
      )}

      {results.length > 0 && (
        <ol className="search-results">
          {results.map(({ doc, matched }) => (
            <li key={doc.id} className="search-result">
              <Link href={`/projects/${doc.slug}`} className="search-result-image" tabIndex={-1} aria-hidden="true">
                {doc.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={doc.image.src} alt="" loading="lazy" style={doc.image.position ? { objectPosition: doc.image.position } : undefined} />
                )}
              </Link>
              <div>
                <h2 className="search-result-name">
                  <Link href={`/projects/${doc.slug}`}>{doc.name}</Link>
                </h2>
                <p className="search-result-meta">
                  {[doc.place, doc.year, doc.status && doc.status !== 'completed' ? PROJECT_STATUS[doc.status as Project['status']] : undefined]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                {matched.filter((f) => f.label !== 'Location' && f.label !== 'Year' && f.label !== 'Expected completion').length > 0 && (
                  <ul className="search-result-facts">
                    {matched
                      .filter((f) => f.label !== 'Location' && f.label !== 'Year' && f.label !== 'Expected completion')
                      .slice(0, 3)
                      .map((f, i) => (
                        <li key={i}>
                          <span className="search-fact-label">{f.label}</span>{' '}
                          {f.href ? <Link href={f.href}>{f.value}</Link> : f.label === 'About' ? f.value.slice(0, 160) : f.value}
                        </li>
                      ))}
                  </ul>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
