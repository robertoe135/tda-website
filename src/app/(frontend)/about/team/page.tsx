import type { Metadata } from 'next'
import Link from 'next/link'

import { AboutNav } from '@/components/AboutNav'
import { getTeam } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Team — Tillotson Design Associates',
  description: 'The people of Tillotson Design Associates.',
  alternates: { canonical: '/about/team' },
}

/** Current staff with "Show on site" on, by section and position (People in the admin). */
export default async function TeamPage() {
  const groups = await getTeam()
  return (
    <div className="team">
      <h1 className="page-title">About</h1>
      <AboutNav />
      {groups.length === 0 && <p className="empty">The team will be introduced here soon.</p>}
      {groups.map((g) => (
        <section key={g.value} aria-labelledby={`team-${g.value}`}>
          <h2 id={`team-${g.value}`} className="section-heading">
            {g.label}
          </h2>
          <ul className="team-grid">
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
