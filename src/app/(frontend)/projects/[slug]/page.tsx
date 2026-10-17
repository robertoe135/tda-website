import { RichText } from '@payloadcms/richtext-lexical/react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cache } from 'react'

import { MetaLine, MetaLink } from '@/components/MetaLink'
import { Slideshow } from '@/components/Slideshow'
import { relatedProjects } from '@/lib/related'
import {
  describeProject,
  filterHref,
  getPublishedProject,
  getPublishedProjects,
  projectPhotographers,
  projectSlides,
  SQ_FT_TO_M2,
} from '@/lib/projects'
import type { Award, CreditRole, Firm, Location, Person, Press, Project, Typology } from '@/payload-types'

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
  designer: 'Designer',
} as const

const LEVEL: Record<string, string> = { certified: 'Certified', silver: 'Silver', gold: 'Gold', platinum: 'Platinum' }
const certification = (c: NonNullable<Project['certifications']>[number]) =>
  [c.system === 'other' ? c.note : c.system.toUpperCase(), c.system === 'other' ? undefined : c.note, LEVEL[c.level]]
    .filter(Boolean)
    .join(' ')

/** A person's name: linked to their team page if they are current staff, plain text if not. */
function PersonName({ person }: { person: Person }) {
  return person.isCurrent && person.slug ? <Link href={`/about/team/${person.slug}`}>{person.name}</Link> : <>{person.name}</>
}

/**
 * Project page, option F2: TDA's name and "location | architect" line, a slideshow, a fact
 * band (Design Architect, Location, Project Completed, then the TDA team), "Project Info"
 * holding everything else, the description, press, related projects.
 */
export default async function ProjectPage({ params }: Props) {
  const project = await getProject((await params).slug)
  if (!project) notFound()

  const location = isObject<Location>(project.location) ? project.location : undefined
  const architects = (project.architects ?? []).filter(isObject<Firm>)
  const typologies = (project.typologies ?? []).filter(isObject<Typology>)
  const owners = (project.clients ?? []).filter(isObject<Firm>) // absent when confidential
  const credits = (project.credits ?? [])
    .map((c) => ({ role: isObject<CreditRole>(c.role) ? c.role : undefined, firms: c.firms.filter(isObject<Firm>) }))
    .filter((c) => c.role && c.firms.length)
  const team = (project.team ?? [])
    .map((t) => ({ role: t.role, person: isObject<Person>(t.person) ? t.person : undefined }))
    .filter((t): t is { role: keyof typeof ROLE_LABEL; person: Person } => Boolean(t.person))
  const byRole = (role: keyof typeof ROLE_LABEL) => team.filter((t) => t.role === role).map((t) => t.person)
  const awards = (project.awards?.docs ?? []).filter(isObject<Award>)
  const press = (project.press?.docs ?? []).filter(isObject<Press>)
  const slides = projectSlides(project)
  const photographers = projectPhotographers(project)

  const all = await getPublishedProjects()
  const card = all.find((p) => p.id === project.id)
  const related = card ? relatedProjects(card, all) : []

  const line = [
    ...(location?.slug ? [{ href: filterHref('location', location.slug), label: location.displayName ?? '' }] : []),
    ...architects.map((a) => ({ href: filterHref('architect', a.slug ?? ''), label: a.name })),
  ]
  const firmLinks = (firms: Firm[], key: 'architect' | 'client' | 'collaborator') =>
    firms.map((f, i) => (
      <span key={f.id}>
        {i > 0 && ', '}
        <MetaLink href={filterHref(key, f.slug ?? '')}>{f.name}</MetaLink>
      </span>
    ))
  const people = (list: Person[]) =>
    list.map((p, i) => (
      <span key={p.id}>
        {i > 0 && ', '}
        <PersonName person={p} />
      </span>
    ))

  const hasInfo =
    owners.length > 0 ||
    typologies.length > 0 ||
    Boolean(project.areaSqFt) ||
    (project.certifications ?? []).length > 0 ||
    photographers.length > 0 ||
    Boolean(project.predecessorFirm) ||
    credits.length > 0 ||
    awards.length > 0

  return (
    <article className="project">
      <header className="project-header">
        <h1 className="project-title">{project.name}</h1>
        {line.length > 0 && (
          <p className="project-line">
            <MetaLine items={line} />
          </p>
        )}
      </header>

      <Slideshow slides={slides} label={`Photographs of ${project.name}`} />

      <section className="fact-band" aria-label="Project facts">
        <dl className="facts-key">
          {architects.length > 0 && (
            <Fact label={architects.length > 1 ? 'Design Architects' : 'Design Architect'}>
              {firmLinks(architects, 'architect')}
            </Fact>
          )}
          {location?.slug && (
            <Fact label="Location">
              <MetaLink href={filterHref('location', location.slug)}>{location.displayName}</MetaLink>
            </Fact>
          )}
          {project.year && (
            <Fact label={project.status === 'in-progress' ? 'Expected Completion' : 'Project Completed'}>
              {project.year}
            </Fact>
          )}
        </dl>

        {team.length > 0 && (
          <div className="facts-team">
            <h2 className="facts-heading">TDA Team</h2>
            <dl className="facts-key">
              {byRole('principal').length > 0 && <Fact label={ROLE_LABEL.principal}>{people(byRole('principal'))}</Fact>}
              {byRole('project-manager').length > 0 && (
                <Fact label={ROLE_LABEL['project-manager']}>{people(byRole('project-manager'))}</Fact>
              )}
              {byRole('designer').length > 0 && (
                <Fact label={byRole('designer').length > 1 ? 'Designers' : 'Designer'} wide>
                  {people(byRole('designer'))}
                </Fact>
              )}
            </dl>
          </div>
        )}

        {hasInfo && (
          <details className="project-info">
            <summary>
              <span>Project Info</span>
              <span className="project-info-sign" aria-hidden="true" />
            </summary>
            <div className="project-info-body">
              <div>
                {owners.length > 0 && <p>Owner: {firmLinks(owners, 'client')}</p>}
                {typologies.length > 0 && (
                  <p>
                    Category:{' '}
                    {typologies.map((t, i) => (
                      <span key={t.id}>
                        {i > 0 && ', '}
                        <MetaLink href={filterHref('typology', t.slug ?? '')}>{t.name}</MetaLink>
                      </span>
                    ))}
                  </p>
                )}
                {project.areaSqFt && (
                  <p>
                    Area: {Math.round(project.areaSqFt).toLocaleString('en-US')} SF /{' '}
                    {Math.round(project.areaSqFt * SQ_FT_TO_M2).toLocaleString('en-US')} m²
                    {project.areaNote && ` (${project.areaNote})`}
                  </p>
                )}
                {(project.certifications ?? []).length > 0 && (
                  <p>LEED/Well Status: {project.certifications!.map(certification).join(', ')}</p>
                )}
                {photographers.length > 0 && <p>Photography: {photographers.join(' / ')}</p>}
                {project.predecessorFirm && <p>Completed as: {project.predecessorFirm}</p>}
                {awards.length > 0 && (
                  <>
                    <p className="project-info-heading">Awards:</p>
                    {awards.map((a) => (
                      <p key={a.id}>{[a.year, a.issuer, a.name].filter(Boolean).join(' ')}</p>
                    ))}
                  </>
                )}
              </div>
              {credits.length > 0 && (
                <div>
                  <p className="project-info-heading">Consultants:</p>
                  {credits.map((c, i) => (
                    <p key={i}>
                      {c.role!.name}: {firmLinks(c.firms, 'collaborator')}
                    </p>
                  ))}
                  <p>
                    Lighting Design: <Link href="/">Tillotson Design Associates</Link>
                  </p>
                </div>
              )}
            </div>
          </details>
        )}
      </section>

      {project.description && (
        <div className="project-description">
          <RichText data={project.description} />
        </div>
      )}

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

      {related.length > 0 && (
        <section className="other-projects" aria-labelledby="related-heading">
          <h2 id="related-heading" className="section-heading">
            Related Projects
          </h2>
          <ul>
            {related.map(({ project: p, reason }) => (
              <li key={p.id}>
                <Link href={`/projects/${p.slug}`} className="other-project">
                  <span className="other-project-image">
                    {p.image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.image.src}
                        srcSet={p.image.srcSet}
                        sizes="(min-width: 720px) 25vw, 50vw"
                        style={p.image.position ? { objectPosition: p.image.position } : undefined}
                        alt=""
                        loading="lazy"
                      />
                    )}
                  </span>
                  <span className="other-project-name">{p.name}</span>
                </Link>
                <MetaLink href={reason.href}>{reason.label}</MetaLink>
              </li>
            ))}
          </ul>
        </section>
      )}

    </article>
  )
}

function Fact({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? 'fact fact-wide' : 'fact'}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}
