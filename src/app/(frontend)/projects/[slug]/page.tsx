import { RichText } from '@payloadcms/richtext-lexical/react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cache } from 'react'

import { MetaLine } from '@/components/MetaLink'
import { describeProject, filterHref, getPublishedProject, getPublishedProjects } from '@/lib/projects'
import type { Firm, Location, Press } from '@/payload-types'

type Props = { params: Promise<{ slug: string }> }

const isObject = <T,>(value: unknown): value is T => typeof value === 'object' && value !== null
const getProject = cache(getPublishedProject)

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const project = await getProject((await params).slug)
  if (!project) return {}
  const location = isObject<Location>(project.location) ? project.location.displayName : undefined
  const description =
    describeProject(project) ??
    [`${project.name}, lighting design by Tillotson Design Associates`, location].filter(Boolean).join(', ')
  return {
    title: `${project.name} — Tillotson Design Associates`,
    description,
    alternates: { canonical: `/projects/${project.slug}` },
    openGraph: { title: project.name, description, type: 'article' },
  }
}

/**
 * Same order and look as a project page on the current tillotsondesign.com: name, the
 * "location | architect" line, hero and carousel (once images exist), description,
 * "Full Project Stats", press in a row, other projects with the architect, previous / next.
 */
export default async function ProjectPage({ params }: Props) {
  const project = await getProject((await params).slug)
  if (!project) notFound()

  const location = isObject<Location>(project.location) ? project.location : undefined
  const architects = (project.architects ?? []).filter(isObject<Firm>)
  const press = (project.press?.docs ?? []).filter(isObject<Press>)

  const all = await getPublishedProjects()
  const index = all.findIndex((p) => p.id === project.id)
  const previous = index > 0 ? all[index - 1] : undefined
  const next = index > -1 && index < all.length - 1 ? all[index + 1] : undefined
  const leadArchitect = architects[0]
  const others = leadArchitect
    ? all.filter((p) => p.id !== project.id && p.architects.some((a) => a.slug === leadArchitect.slug))
    : []

  const line = [
    ...(location?.slug ? [{ href: filterHref('location', location.slug), label: location.displayName ?? '' }] : []),
    ...architects.map((a) => ({ href: filterHref('architect', a.slug ?? ''), label: a.name })),
  ]

  return (
    <article className="project">
      {/* Hero image and gallery go here once photographs are uploaded. */}
      <header className="project-header">
        <h1 className="project-title">{project.name}</h1>
        {line.length > 0 && (
          <p className="project-line">
            <MetaLine items={line} />
          </p>
        )}
      </header>

      {project.description && (
        <div className="project-description">
          <RichText data={project.description} />
        </div>
      )}

      <p className="project-stats-link">
        <Link href={`/projects/${project.slug}/credits`}>Full Project Stats</Link>
      </p>

      {press.length > 0 && (
        <section className="press" aria-labelledby="press-heading">
          <h2 id="press-heading" className="visually-hidden">
            Press
          </h2>
          <ul>
            {press.map((p) => (
              <li key={p.id}>
                <p className="press-title">&ldquo;{p.title}&rdquo;</p>
                <p className="press-outlet">
                  <a href={p.url} rel="noopener">
                    {p.outlet || p.url}
                  </a>
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {leadArchitect && others.length > 0 && (
        <section className="other-projects" aria-labelledby="others-heading">
          <h2 id="others-heading" className="section-heading">
            Other Projects with{' '}
            <Link href={filterHref('architect', leadArchitect.slug ?? '')}>{leadArchitect.name}</Link>
          </h2>
          <ul>
            {others.slice(0, 6).map((p) => (
              <li key={p.id}>
                {/* Thumbnail image here once photographs are uploaded; the name stands in. */}
                <Link href={`/projects/${p.slug}`}>{p.name}</Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <nav className="pager" aria-label="More projects">
        {previous ? (
          <Link href={`/projects/${previous.slug}`} rel="prev">
            <span className="visually-hidden">Previous project: </span>
            {previous.name}
          </Link>
        ) : (
          <span />
        )}
        {next && (
          <Link href={`/projects/${next.slug}`} rel="next">
            <span className="visually-hidden">Next project: </span>
            {next.name}
          </Link>
        )}
      </nav>
    </article>
  )
}
