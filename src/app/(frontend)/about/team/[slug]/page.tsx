import { RichText } from '@payloadcms/richtext-lexical/react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cache } from 'react'

import { AboutNav } from '@/components/AboutNav'
import { getPayloadClient } from '@/lib/projects'
import type { Media } from '@/payload-types'

type Props = { params: Promise<{ slug: string }> }

const ROLE_LABEL = { principal: 'Principal in Charge', 'project-manager': 'Project Manager', designer: 'Designer' } as const

// Current staff only: former staff are credited on projects but have no page.
const getPerson = cache(async (slug: string) => {
  const payload = await getPayloadClient()
  const people = await payload.find({
    collection: 'people',
    overrideAccess: false, // published people with "Show on site" on
    where: { and: [{ slug: { equals: slug } }, { isCurrent: { equals: true } }] },
    limit: 1,
    depth: 1,
  })
  const person = people.docs[0]
  if (!person) return undefined
  const projects = await payload.find({
    collection: 'projects',
    overrideAccess: false,
    where: { 'team.person': { equals: person.id } },
    pagination: false,
    sort: ['-year', 'name'],
    depth: 0,
    select: { name: true, slug: true, year: true, team: true },
  })
  return { person, projects: projects.docs }
})

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await getPerson((await params).slug)
  if (!data) return {}
  const { person } = data
  return {
    title: `${person.name} — Tillotson Design Associates`,
    description: [person.name, person.title, 'Tillotson Design Associates'].filter(Boolean).join(', '),
    alternates: { canonical: `/about/team/${person.slug}` },
  }
}

export default async function PersonPage({ params }: Props) {
  const data = await getPerson((await params).slug)
  if (!data) notFound()
  const { person, projects } = data
  const headshot = typeof person.headshot === 'object' && person.headshot?.url ? (person.headshot as Media) : undefined

  return (
    <article className="person">
      <AboutNav />
      <header className="project-header">
        <h1 className="project-title">{person.name}</h1>
        {person.title && <p className="project-line">{person.title}</p>}
      </header>
      {headshot && (
        <div className="person-headshot">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={headshot.sizes?.gallery?.url ?? headshot.url!} alt={headshot.alt} width={headshot.width ?? undefined} height={headshot.height ?? undefined} />
        </div>
      )}
      {/* The bio only when the person has approved one; never written for them. */}
      {person.bio && (
        <div className="project-description">
          <RichText data={person.bio} />
        </div>
      )}
      {projects.length > 0 && (
        <section className="person-projects" aria-labelledby="person-projects">
          <h2 id="person-projects" className="section-heading">
            Projects
          </h2>
          <ul>
            {projects.map((p) => {
              const roles = [
                ...new Set(
                  (p.team ?? [])
                    .filter((t) => (typeof t.person === 'object' ? t.person.id : t.person) === person.id)
                    .map((t) => ROLE_LABEL[t.role]),
                ),
              ]
              return (
                <li key={p.id}>
                  <Link href={`/projects/${p.slug}`}>{p.name}</Link>
                  <span className="person-project-meta">
                    {[p.year, roles.join(', ')].filter(Boolean).join(' · ')}
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </article>
  )
}
