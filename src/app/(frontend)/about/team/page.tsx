import type { Metadata } from 'next'
import Link from 'next/link'

import { Breadcrumb } from '@/components/Breadcrumb'
import { getTeam } from '@/lib/site'

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const filtered = Boolean((await searchParams).credential)
  return {
    title: 'Team — Tillotson Design Associates',
    description: 'The people of Tillotson Design Associates.',
    // A filtered view (?credential=cld) is the same page for search engines.
    alternates: { canonical: '/about/team' },
    ...(filtered ? { robots: { index: false, follow: true } } : {}),
  }
}

/**
 * Current staff with "Show on site" on, by section and position (People in the admin). Names
 * and titles only: credentials show on each person's page, whose badges link back here as
 * ?credential=<slug>, the people who hold one.
 */
export default async function TeamPage({ searchParams }: Props) {
  const raw = (await searchParams).credential
  const credential = typeof raw === 'string' ? raw : undefined
  const groups = await getTeam(credential)
  const badge = credential
    ? groups.flatMap((g) => g.people).flatMap((p) => p.credentials).find((b) => b.slug === credential)
    : undefined

  return (
    <div className="team">
      <Breadcrumb trail={[{ href: '/about', label: 'about' }]} current="team" />
      <h1 className="page-title page-title-large">Team</h1>
      {credential && (
        <p className="team-filter">
          {badge ? (
            <>
              Everyone with <strong>{badge.name}</strong>
              {badge.fullName ? ` (${badge.fullName})` : ''}.{' '}
            </>
          ) : (
            'Nobody on the team holds that credential. '
          )}
          <Link href="/about/team">Show the whole team</Link>
        </p>
      )}
      {groups.length === 0 && !credential && <p className="empty">The team will be introduced here soon.</p>}
      {groups.map((g) => (
        <section key={g.value} className="team-group" aria-labelledby={`team-${g.value}`}>
          <div className="group-head">
            <h2 id={`team-${g.value}`}>{g.label}</h2>
            <span>{g.people.length}</span>
          </div>
          <ul className={`team-grid team-grid-${g.value}`}>
            {g.people.map((p) => (
              <li key={p.id}>
                <Link href={`/about/team/${p.slug}`} className="team-member">
                  <div className="team-photo">
                    {p.headshot && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.headshot.src} alt="" loading="lazy" />
                    )}
                  </div>
                  <span className="team-name">{p.name}</span>
                  {p.title && <span className="team-title">{p.title}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
