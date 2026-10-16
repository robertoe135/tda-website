import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cache } from 'react'

import { MetaLink } from '@/components/MetaLink'
import { filterHref, getPublishedProject } from '@/lib/projects'
import type { Award, CreditRole, Firm, Location, Project } from '@/payload-types'

type Props = { params: Promise<{ slug: string }> }

const isObject = <T,>(value: unknown): value is T => typeof value === 'object' && value !== null
const getProject = cache(getPublishedProject)

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const project = await getProject((await params).slug)
  if (!project) return {}
  const location = isObject<Location>(project.location) ? project.location.displayName : undefined
  return {
    title: `${project.name}: Full Project Stats — Tillotson Design Associates`,
    description: [`Credits for ${project.name}`, location, project.year].filter(Boolean).join(', '),
    alternates: { canonical: `/projects/${project.slug}/credits` },
  }
}

const LEVEL: Record<string, string> = { certified: 'Certified', silver: 'Silver', gold: 'Gold', platinum: 'Platinum' }
const certification = (c: NonNullable<Project['certifications']>[number]) =>
  [c.system === 'other' ? c.note : c.system.toUpperCase(), c.system === 'other' ? undefined : c.note, LEVEL[c.level]]
    .filter(Boolean)
    .join(' ')

/**
 * The "Full Project Stats" page, with the labels the current tillotsondesign.com uses:
 * Location, Project Completed, Area, LEED/Well Status, Design Architect, Owner, Consultants,
 * Awards. Every value links to the projects filtered by it.
 */
export default async function CreditsPage({ params }: Props) {
  const project = await getProject((await params).slug)
  if (!project) notFound()

  const location = isObject<Location>(project.location) ? project.location : undefined
  const architects = (project.architects ?? []).filter(isObject<Firm>)
  const owners = (project.clients ?? []).filter(isObject<Firm>) // absent when confidential
  const credits = (project.credits ?? [])
    .map((c) => ({ role: isObject<CreditRole>(c.role) ? c.role : undefined, firms: c.firms.filter(isObject<Firm>) }))
    .filter((c) => c.role && c.firms.length)
  const awards = (project.awards?.docs ?? []).filter(isObject<Award>)
  const links = (firms: Firm[], key: 'architect' | 'client' | 'collaborator') =>
    firms.map((f, i) => (
      <span key={f.id}>
        {i > 0 && ', '}
        <MetaLink href={filterHref(key, f.slug ?? '')}>{f.name}</MetaLink>
      </span>
    ))

  return (
    <article className="credits">
      <h1 className="project-title">
        <Link href={`/projects/${project.slug}`}>{project.name}</Link>
      </h1>

      <div className="credits-list">
        {location?.slug && (
          <p>
            Location: <MetaLink href={filterHref('location', location.slug)}>{location.displayName}</MetaLink>
          </p>
        )}
        {project.year && (
          <p>
            {project.status === 'in-progress' ? 'Expected Completion' : 'Project Completed'}: {project.year}
          </p>
        )}
        {project.areaSqFt && (
          <p>
            Area: {Math.round(project.areaSqFt).toLocaleString('en-US')} SF
            {project.areaNote && ` / ${project.areaNote}`}
          </p>
        )}
        {(project.certifications ?? []).length > 0 && (
          <p>LEED/Well Status: {project.certifications!.map(certification).join(', ')}</p>
        )}
        {architects.length > 0 && <p>Design Architect: {links(architects, 'architect')}</p>}
        {owners.length > 0 && <p>Owner: {links(owners, 'client')}</p>}
        {project.predecessorFirm && <p>Completed as: {project.predecessorFirm}</p>}

        {credits.length > 0 && (
          <>
            <p className="credits-heading">Consultants:</p>
            {credits.map((c, i) => (
              <p key={i}>
                {c.role!.name}: {links(c.firms, 'collaborator')}
              </p>
            ))}
          </>
        )}
        <p>
          Lighting Design: <Link href="/">Tillotson Design Associates</Link>
        </p>

        {awards.length > 0 && (
          <>
            <p className="credits-heading">Awards:</p>
            {awards.map((a) => (
              <p key={a.id}>{[a.year, a.issuer, a.name].filter(Boolean).join(' ')}</p>
            ))}
          </>
        )}
      </div>

      <p>
        <Link href={`/projects/${project.slug}`}>Back to {project.name}</Link>
      </p>
    </article>
  )
}
