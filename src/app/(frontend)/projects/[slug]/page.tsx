import { RichText } from '@payloadcms/richtext-lexical/react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cache } from 'react'

import { MetaLine, MetaLink } from '@/components/MetaLink'
import { HeroPhoto, PhotoViewer, ProjectSlideshow } from '@/components/PhotoViewer'
import {
  describeProject,
  filterHref,
  getPublishedProject,
  getPublishedProjects,
  projectPhotographers,
  projectSlides,
  SQ_FT_TO_M2,
} from '@/lib/projects'
import { otherProjects } from '@/lib/related'
import type {
  Award,
  CreditRole,
  Firm,
  Location,
  Person,
  Press,
  Project,
  Typology,
} from '@/payload-types'

type Props = { params: Promise<{ slug: string }> }

const isObject = <T,>(value: unknown): value is T => typeof value === 'object' && value !== null
const getProject = cache(getPublishedProject)

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const project = await getProject((await params).slug)
  if (!project) return {}
  const location = isObject<Location>(project.location) ? project.location.displayName : undefined
  const description =
    describeProject(project) ??
    [`${project.name}, lighting design by Tillotson Design Associates`, location]
      .filter(Boolean)
      .join(', ')
  const image = projectSlides(project)[0]
  return {
    title: `${project.name} — Tillotson Design Associates`,
    description,
    alternates: { canonical: `/projects/${project.slug}` },
    openGraph: {
      title: project.name,
      description,
      type: 'article',
      ...(image ? { images: [{ url: image.src, alt: image.alt }] } : {}),
    },
  }
}

const ROLE_LABEL = {
  principal: 'Principal in Charge',
  'project-manager': 'Project Manager',
  designer: 'Designers',
} as const
const STATUS: Record<Project['status'], string> = {
  completed: 'Completed',
  'in-progress': 'In Progress',
  unbuilt: 'Unbuilt',
}
const LEVEL: Record<string, string> = {
  certified: 'Certified',
  silver: 'Silver',
  gold: 'Gold',
  platinum: 'Platinum',
}
const certification = (c: NonNullable<Project['certifications']>[number]) =>
  [
    c.system === 'other' ? c.note : c.system.toUpperCase(),
    c.system === 'other' ? undefined : c.note,
    LEVEL[c.level],
  ]
    .filter(Boolean)
    .join(' ')

/** A person's name: linked to their team page if they are current staff, plain text if not. */
function PersonName({ person }: { person: Person }) {
  return person.isCurrent && person.slug ? (
    <Link href={`/about/team/${person.slug}`}>{person.name}</Link>
  ) : (
    <>{person.name}</>
  )
}

/** Items joined by commas. */
function List<T extends { id: number | string }>({
  items,
  render,
}: {
  items: T[]
  render: (item: T) => React.ReactNode
}) {
  return items.map((item, i) => (
    <span key={item.id}>
      {i > 0 && ', '}
      {render(item)}
    </span>
  ))
}

/** "nytimes.com" from a link, for press items with no outlet name. */
const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/** One row of the credits table. */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="credit-row">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

/** A row whose list opens in place (TDA Team, Collaborators, Awards). */
function OpenRow({
  label,
  summary,
  children,
}: {
  label: string
  summary: string
  children: React.ReactNode
}) {
  return (
    <details className="credit-more">
      <summary>
        <span className="credit-label">{label}</span>
        <span className="credit-summary">{summary}</span>
        <span className="credit-sign" aria-hidden="true" />
      </summary>
      <div className="credit-list">{children}</div>
    </details>
  )
}

/**
 * Project page (mockup F3): the hero with the name on it; the facts and credits beside the
 * write-up (facts first on a phone); every other photo in a slideshow whose frame never
 * changes size; press; other projects by the same architect, else in the same category.
 * Any photo opens full screen.
 */
export default async function ProjectPage({ params }: Props) {
  const project = await getProject((await params).slug)
  if (!project) notFound()

  const location = isObject<Location>(project.location) ? project.location : undefined
  const architects = (project.architects ?? []).filter(isObject<Firm>)
  const typologies = (project.typologies ?? []).filter(isObject<Typology>)
  const owners = (project.clients ?? []).filter(isObject<Firm>) // absent when confidential
  const credits = (project.credits ?? [])
    .map((c, i) => ({
      id: i,
      role: isObject<CreditRole>(c.role) ? c.role : undefined,
      firms: c.firms.filter(isObject<Firm>),
    }))
    .filter((c) => c.role && c.firms.length)
  const team = (project.team ?? [])
    .map((t) => ({ role: t.role, person: isObject<Person>(t.person) ? t.person : undefined }))
    .filter((t): t is { role: keyof typeof ROLE_LABEL; person: Person } => Boolean(t.person))
  const byRole = (role: keyof typeof ROLE_LABEL) =>
    team.filter((t) => t.role === role).map((t) => t.person)
  const awards = (project.awards?.docs ?? []).filter(isObject<Award>)
  const press = (project.press?.docs ?? []).filter(isObject<Press>)
  const slides = projectSlides(project)
  const photographers = projectPhotographers(project)

  const all = await getPublishedProjects()
  const card = all.find((p) => p.id === project.id)
  const other = card ? otherProjects(card, all) : undefined

  const line = [
    ...(location?.slug
      ? [{ href: filterHref('location', location.slug), label: location.displayName ?? '' }]
      : []),
    ...architects.map((a) => ({ href: filterHref('architect', a.slug ?? ''), label: a.name })),
  ]
  const firmLink = (key: 'architect' | 'client' | 'collaborator', f: Firm) => (
    <MetaLink href={filterHref(key, f.slug ?? '')}>{f.name}</MetaLink>
  )
  const people = (list: Person[]) => <List items={list} render={(p) => <PersonName person={p} />} />
  const category = typologies[0]
  const firmCount = credits.reduce((n, c) => n + c.firms.length, 0)

  const title = (
    <div className="project-title-band">
      <div>
        <h1 className="project-title">{project.name}</h1>
        {line.length > 0 && (
          <p className="project-line">
            <MetaLine items={line} />
          </p>
        )}
      </div>
      {category?.slug && (
        <Link className="project-chip" href={filterHref('typology', category.slug)}>
          {category.name}
        </Link>
      )}
    </div>
  )

  return (
    <article className="project">
      <nav aria-label="Breadcrumb" className="breadcrumb">
        <Link href="/projects">Portfolio</Link>
        {category?.slug && (
          <>
            {' / '}
            <Link href={filterHref('typology', category.slug)}>{category.name}</Link>
          </>
        )}
        {' / '}
        <span aria-current="page">{project.name}</span>
      </nav>

      <PhotoViewer slides={slides} name={project.name}>
        {slides[0] ? (
          <header className="project-hero">
            <HeroPhoto slide={slides[0]} count={slides.length} />
            {title}
          </header>
        ) : (
          <header className="project-hero no-photo">{title}</header>
        )}

        <div className={project.description ? 'project-body' : 'project-body no-text'}>
          <section className="credits" aria-labelledby="credits-heading">
            <h2 id="credits-heading" className="credits-heading">
              Facts and Credits
            </h2>
            <dl>
              {location?.slug && (
                <Row label="Location">
                  <MetaLink href={filterHref('location', location.slug)}>
                    {location.displayName}
                  </MetaLink>
                </Row>
              )}
              {architects.length > 0 && (
                <Row label={architects.length > 1 ? 'Design Architects' : 'Design Architect'}>
                  <List items={architects} render={(f) => firmLink('architect', f)} />
                </Row>
              )}
              {project.year && (
                <Row label={project.status === 'in-progress' ? 'Expected Completion' : 'Year'}>
                  {project.year}
                </Row>
              )}
              <Row label="Status">{STATUS[project.status]}</Row>
              {typologies.length > 0 && (
                <Row label={typologies.length > 1 ? 'Categories' : 'Category'}>
                  <List
                    items={typologies}
                    render={(t) => (
                      <MetaLink href={filterHref('typology', t.slug ?? '')}>{t.name}</MetaLink>
                    )}
                  />
                </Row>
              )}
              {owners.length > 0 && (
                <Row label="Owner">
                  <List items={owners} render={(f) => firmLink('client', f)} />
                </Row>
              )}
              {project.areaSqFt && (
                <Row label="Area">
                  {Math.round(project.areaSqFt).toLocaleString('en-US')} SF /{' '}
                  {Math.round(project.areaSqFt * SQ_FT_TO_M2).toLocaleString('en-US')} m²
                  {project.areaNote && ` (${project.areaNote})`}
                </Row>
              )}
              {(project.certifications ?? []).length > 0 && (
                <Row label="LEED / WELL">
                  {project.certifications!.map(certification).join(', ')}
                </Row>
              )}
              {project.predecessorFirm && <Row label="Completed As">{project.predecessorFirm}</Row>}
            </dl>
            {team.length > 0 && (
              <OpenRow
                label="TDA Team"
                summary={`${team.length} ${team.length === 1 ? 'person' : 'people'}`}
              >
                {(['principal', 'project-manager', 'designer'] as const).map(
                  (role) =>
                    byRole(role).length > 0 && (
                      <p key={role}>
                        {role === 'designer' && byRole(role).length === 1
                          ? 'Designer'
                          : ROLE_LABEL[role]}
                        : {people(byRole(role))}
                      </p>
                    ),
                )}
              </OpenRow>
            )}
            {credits.length > 0 && (
              <OpenRow
                label="Collaborators"
                summary={`${firmCount} ${firmCount === 1 ? 'firm' : 'firms'}`}
              >
                {credits.map((c) => (
                  <p key={c.id}>
                    {c.role!.name}:{' '}
                    <List items={c.firms} render={(f) => firmLink('collaborator', f)} />
                  </p>
                ))}
                <p>
                  Lighting Design: <Link href="/">Tillotson Design Associates</Link>
                </p>
              </OpenRow>
            )}
            {awards.length > 0 && (
              <OpenRow label="Awards" summary={String(awards.length)}>
                {awards.map((a) => (
                  <p key={a.id}>{[a.year, a.issuer, a.name].filter(Boolean).join(' ')}</p>
                ))}
              </OpenRow>
            )}
            {photographers.length > 0 && (
              <dl>
                <Row label="Photography">{photographers.join(' / ')}</Row>
              </dl>
            )}
          </section>

          {project.description && (
            <div className="project-description">
              <RichText data={project.description} />
            </div>
          )}
        </div>

        {slides.length > 1 && (
          <ProjectSlideshow slides={slides.slice(1)} offset={1} name={project.name} />
        )}
      </PhotoViewer>

      {press.length > 0 && (
        <section className="press" aria-labelledby="press-heading">
          <h2 id="press-heading" className="block-heading">
            Press
          </h2>
          <ul>
            {press.map((p) => (
              <li key={p.id}>
                <a href={p.url} rel="noopener">
                  <span className="press-outlet">{p.outlet || hostOf(p.url)}</span>
                  <span className="press-title">&ldquo;{p.title}&rdquo;</span>
                  <span className="press-out" aria-hidden="true">
                    ↗
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {other && (
        <section className="other-projects" aria-labelledby="other-heading">
          <div className="other-head">
            <h2 id="other-heading" className="block-heading">
              {other.by === 'architect' ? (
                <>
                  Other projects with <Link href={other.href}>{other.name}</Link>
                </>
              ) : (
                'Other projects'
              )}
            </h2>
            <Link href={other.href} className="other-all">
              {other.by === 'architect'
                ? `All ${other.total} projects`
                : other.by === 'typology'
                  ? `All ${other.total} ${other.name} projects`
                  : `All ${other.total} projects completed in ${other.name}`}
            </Link>
          </div>
          <ul>
            {other.projects.map((p) => (
              <li key={p.id}>
                <Link href={`/projects/${p.slug}`} className="other-card">
                  <span className="other-card-image">
                    {p.image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.image.src}
                        srcSet={p.image.srcSet}
                        sizes="(min-width: 720px) 50vw, 100vw"
                        style={p.image.position ? { objectPosition: p.image.position } : undefined}
                        alt=""
                        loading="lazy"
                      />
                    )}
                  </span>
                  <span className="other-card-text">
                    <span className="other-card-name">{p.name}</span>
                    <span className="other-card-meta">
                      {[p.year, p.location?.displayName].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  )
}
