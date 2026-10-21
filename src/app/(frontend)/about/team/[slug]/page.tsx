import { RichText } from '@payloadcms/richtext-lexical/react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cache } from 'react'

import { Breadcrumb } from '@/components/Breadcrumb'
import { cardImage, getPayloadClient } from '@/lib/projects'
import { reflow } from '@/lib/reflow'
import type { Media } from '@/payload-types'

type Props = { params: Promise<{ slug: string }> }

const ROLE_LABEL = {
  principal: 'Principal in Charge',
  'project-manager': 'Project Manager',
  designer: 'Designer',
} as const

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
    depth: 1,
    select: { name: true, slug: true, year: true, team: true, heroImage: true },
  })
  return { person, projects: projects.docs }
})

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await getPerson((await params).slug)
  if (!data) return {}
  const { person } = data
  return {
    title: `${person.name} — Tillotson Design Associates`,
    description: [person.name, person.title, 'Tillotson Design Associates']
      .filter(Boolean)
      .join(', '),
    alternates: { canonical: `/about/team/${person.slug}` },
  }
}

export default async function PersonPage({ params }: Props) {
  const data = await getPerson((await params).slug)
  if (!data) notFound()
  const { person, projects } = data
  const headshot =
    typeof person.headshot === 'object' && person.headshot?.url
      ? (person.headshot as Media)
      : undefined

  return (
    <article className="person">
      <Breadcrumb
        trail={[
          { href: '/about', label: 'about' },
          { href: '/about/team', label: 'team' },
        ]}
        current={person.name}
      />
      <header className="person-header">
        <h1 className="person-name">{person.name}</h1>
        {person.title && <p className="person-title">{person.title}</p>}
      </header>

      {(headshot || person.bio) && (
        <div className={headshot ? 'person-intro' : 'person-intro person-intro-text'}>
          {headshot && (
            <div className="person-headshot">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={headshot.sizes?.gallery?.url ?? headshot.url!}
                alt={headshot.alt}
                width={headshot.width ?? undefined}
                height={headshot.height ?? undefined}
              />
            </div>
          )}
          {/* The bio only when the person has approved one; never written for them. */}
          {person.bio && (
            <section className="person-bio" aria-labelledby="person-bio">
              <h2 id="person-bio" className="person-section-head">
                About
              </h2>
              <RichText data={reflow(person.bio)} />
            </section>
          )}
        </div>
      )}

      {projects.length > 0 && (
        <section className="person-projects" aria-labelledby="person-projects">
          <div className="person-section-head person-projects-head">
            <h2 id="person-projects">Projects</h2>
            <span>{projects.length}</span>
          </div>
          <ul className="person-project-grid">
            {projects.map((p) => {
              const roles = [
                ...new Set(
                  (p.team ?? [])
                    .filter(
                      (t) => (typeof t.person === 'object' ? t.person.id : t.person) === person.id,
                    )
                    .map((t) => ROLE_LABEL[t.role]),
                ),
              ]
              const image =
                typeof p.heroImage === 'object' && p.heroImage?.url
                  ? cardImage(p.heroImage as Media)
                  : undefined
              return (
                <li key={p.id}>
                  <Link href={`/projects/${p.slug}`}>
                    <div className="person-project-image">
                      {image && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={image.src}
                          srcSet={image.srcSet}
                          sizes="(min-width: 768px) 25vw, 50vw"
                          alt=""
                          loading="lazy"
                        />
                      )}
                    </div>
                    <h3 className="person-project-name">{p.name}</h3>
                    <span className="person-project-meta">
                      {[p.year, roles.join(', ')].filter(Boolean).join(' · ')}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </article>
  )
}
