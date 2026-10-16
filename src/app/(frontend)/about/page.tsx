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

/** Profile: the sections of the About page in the admin, in order. */
export default async function AboutPage() {
  const about = await getAbout()
  return (
    <div className="about">
      <h1 className="page-title">About</h1>
      <AboutNav />
      {(about.sections ?? []).map((s) => {
        const image = typeof s.image === 'object' && s.image ? (s.image as Media) : undefined
        return (
          <section key={s.id} className="about-section" aria-labelledby={`about-${s.id}`}>
            {image?.url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="about-image" src={image.sizes?.gallery?.url ?? image.url} alt={image.alt} loading="lazy" />
            )}
            <h2 id={`about-${s.id}`} className="about-heading">
              {s.heading}
            </h2>
            <div className="project-description">
              <RichText data={s.body} />
            </div>
          </section>
        )
      })}
    </div>
  )
}
