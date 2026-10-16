import type { Metadata } from 'next'
import Link from 'next/link'

import { VideoTile } from '@/components/VideoTile'
import { getHomeRows, type HomeTile } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Tillotson Design Associates',
  description: 'Tillotson Design Associates, architectural lighting design, New York.',
  alternates: { canonical: '/' },
}

/** The homepage: rows of project photographs, looping videos and quotes (Homepage in the admin). */
export default async function HomePage() {
  const rows = await getHomeRows()
  return (
    <div className="home">
      <h1 className="visually-hidden">Tillotson Design Associates</h1>
      {rows.length === 0 ? (
        <p className="empty">Projects are on their way.</p>
      ) : (
        rows.map((row, r) => (
          <div key={row.id ?? r} className="home-row" data-layout={row.layout}>
            {row.items.map((item, i) =>
              item.kind === 'quote' ? (
                <figure key={item.id ?? i} className="home-quote">
                  <blockquote>&ldquo;{item.text}&rdquo;</blockquote>
                  <figcaption>{item.attribution}</figcaption>
                </figure>
              ) : (
                <Tile key={item.id ?? i} item={item} eager={r === 0} />
              ),
            )}
          </div>
        ))
      )}
      {rows.length > 0 && (
        <p className="home-more">
          <Link href="/projects">See all projects</Link>
        </p>
      )}
    </div>
  )
}

function Tile({ item, eager }: { item: HomeTile; eager: boolean }) {
  const { project, image, video } = item
  const href = `/projects/${project.slug}`
  if (video) return <VideoTile href={href} name={project.name} src={video.src} type={video.type} poster={video.poster ?? image?.src} />
  return (
    <div className="home-tile">
      <Link href={href} className="tile">
        <div className="tile-image">
          {image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image.src}
              srcSet={image.srcSet}
              sizes="(min-width: 1080px) 600px, (min-width: 720px) 50vw, 100vw"
              alt=""
              loading={eager ? 'eager' : 'lazy'}
            />
          )}
        </div>
        <span className="tile-name">{project.name}</span>
      </Link>
    </div>
  )
}
