import { RichText } from '@payloadcms/richtext-lexical/react'
import type { Metadata } from 'next'

import { AboutNav } from '@/components/AboutNav'
import { getAbout } from '@/lib/site'
import type { Media } from '@/payload-types'

export const metadata: Metadata = {
  title: 'About — Tillotson Design Associates',
  description: 'Philosophy, background and services of Tillotson Design Associates.',
  alternates: { canonical: '/about' },
}

/**
 * Profile, laid out as on the old site: each section's photo at its own proportions beside the
 * text, alternating sides, the heading centred above justified text. An opening line and facts
 * show only when set in the admin.
 */
export default async function AboutPage() {
  const about = await getAbout()
  const sections = about.sections ?? []
  return (
    <div className="about">
      <AboutNav />
      {about.lede ? (
        <h1 className="about-lede">{about.lede}</h1>
      ) : (
        <h1 className="page-title">About</h1>
      )}
      {(about.facts ?? []).length > 0 && (
        <dl className="about-facts">
          {about.facts!.map((f) => (
            <div key={f.id}>
              <dt>{f.label}</dt>
              <dd>{f.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {sections.map((s, i) => {
        const image = typeof s.image === 'object' && s.image ? (s.image as Media) : undefined
        return (
          <section
            key={s.id}
            className={`about-section${image ? ' has-image' : ''}${i % 2 ? ' is-flipped' : ''}`}
            aria-labelledby={`about-${s.id}`}
          >
            {image?.url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                className="about-image"
                src={image.sizes?.gallery?.url ?? image.url}
                width={image.width ?? undefined}
                height={image.height ?? undefined}
                alt={image.alt}
                loading="lazy"
              />
            )}
            <div className="about-text">
              <h2 id={`about-${s.id}`} className="about-heading">
                {s.heading}
              </h2>
              <div className="about-body">
                <RichText data={s.body} />
              </div>
            </div>
          </section>
        )
      })}
    </div>
  )
}
