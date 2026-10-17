import { RichText } from '@payloadcms/richtext-lexical/react'
import type { Metadata } from 'next'

import { AboutNav } from '@/components/AboutNav'
import { AboutStory, type StoryChapter } from '@/components/AboutStory'
import { getAbout } from '@/lib/site'
import type { Media } from '@/payload-types'

export const metadata: Metadata = {
  title: 'About — Tillotson Design Associates',
  description: 'Philosophy, background and services of Tillotson Design Associates.',
  alternates: { canonical: '/about' },
}

const storyImage = (m: Media) => {
  const sizes = [m.sizes?.card, m.sizes?.gallery, m.sizes?.hero].filter((x): x is { url: string; width: number } =>
    Boolean(x?.url && x?.width),
  )
  const focal = m.focalX != null && m.focalY != null && (m.focalX !== 50 || m.focalY !== 50)
  return {
    src: m.sizes?.gallery?.url ?? m.url!,
    srcSet: sizes.map((x) => `${x.url} ${x.width}w`).join(', ') || undefined,
    alt: m.alt,
    position: focal ? `${m.focalX}% ${m.focalY}%` : undefined,
  }
}

/**
 * Profile as a photo story (mockup C): the opening line, then each section's text beside a
 * photo that holds still and changes as the visitor reads. Text and photos come from
 * About in the admin, unchanged; the crop follows each photo's focal point.
 */
export default async function AboutPage() {
  const about = await getAbout()
  const chapters: StoryChapter[] = (about.sections ?? []).map((s, i) => {
    const image = typeof s.image === 'object' && s.image?.url ? (s.image as Media) : undefined
    return { id: s.id ?? String(i), heading: s.heading, image: image ? storyImage(image) : undefined, body: <RichText data={s.body} /> }
  })
  const intro = (
    <>
      {about.lede ? <h1 className="about-lede">{about.lede}</h1> : <h1 className="page-title">About</h1>}
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
    </>
  )
  return (
    <div className="about">
      <AboutNav />
      <AboutStory intro={intro} chapters={chapters} />
    </div>
  )
}
