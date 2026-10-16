import type { Metadata } from 'next'

import { ProjectTile } from '@/components/ProjectTile'
import { getHomeItems } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Tillotson Design Associates',
  description: 'Tillotson Design Associates, architectural lighting design, New York.',
  alternates: { canonical: '/' },
}

/** The homepage: projects in marketing's order, with quotes between them (Homepage in the admin). */
export default async function HomePage() {
  const items = await getHomeItems()
  return (
    <div className="home">
      <h1 className="visually-hidden">Tillotson Design Associates</h1>
      {items.length === 0 ? (
        <p className="empty">Projects are on their way.</p>
      ) : (
        <ul className="tile-grid">
          {items.map((item, i) =>
            item.kind === 'quote' ? (
              <li key={item.id ?? i} className="home-quote">
                <figure>
                  <blockquote>&ldquo;{item.text}&rdquo;</blockquote>
                  <figcaption>{item.attribution}</figcaption>
                </figure>
              </li>
            ) : (
              <li key={item.id ?? i}>
                <ProjectTile project={item.project} priority={i < 3} />
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  )
}
