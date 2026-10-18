'use client'

import { type ReactNode, useRef } from 'react'

import { useScrollSpy } from '@/hooks/useScrollSpy'

export type StoryImage = { src: string; srcSet?: string; alt: string }
export type StoryChapter = { id: string; heading: string; image?: StoryImage; body: ReactNode }

/**
 * Profile as a photo story: the photo holds still beside the text and changes to the section
 * being read. Each photo shows whole, at its own shape, within a frame that does not move.
 * On phones the photo is a band under the header. A section without a photo keeps the one
 * before it (or the next one, at the top). With no photos at all, it is plain text.
 */
export function AboutStory({ intro, chapters }: { intro: ReactNode; chapters: StoryChapter[] }) {
  const textRef = useRef<HTMLDivElement>(null)

  // Which photo each section shows.
  const shots = chapters.flatMap((c) => (c.image ? [c.image] : []))
  const shotFor: number[] = []
  let last = -1
  chapters.forEach((c, i) => {
    if (c.image) last = shots.indexOf(c.image)
    shotFor[i] = last
  })
  const firstShot = shotFor.find((s) => s >= 0) ?? -1
  const shotOf = (i: number) => (shotFor[i] >= 0 ? shotFor[i] : firstShot)

  const { current } = useScrollSpy(
    () => Array.from(textRef.current?.querySelectorAll<HTMLElement>('[data-i]') ?? []),
    [chapters.length],
    // On phones the photo band covers the top of the screen, so read lower down.
    () => (window.matchMedia('(max-width: 819px)').matches ? 0.62 : 0.4),
  )

  const hasShots = shots.length > 0
  const shown = shotOf(current)
  const pad = (n: number) => String(n).padStart(2, '0')

  return (
    <div className={hasShots ? 'story' : 'story story-text-only'}>
      <div className="story-intro">{intro}</div>
      {hasShots && (
        <div className="story-stage">
          <div className="story-frame">
            {shots.map((s, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                className="story-shot"
                data-current={i === shown ? '' : undefined}
                src={s.src}
                srcSet={s.srcSet}
                sizes="(min-width: 820px) 50vw, 100vw"
                alt={s.alt}
                aria-hidden={i !== shown}
                loading={i === 0 ? 'eager' : 'lazy'}
              />
            ))}
          </div>
          <div className="story-meta" aria-hidden="true">
            <span className="story-title">{chapters[current]?.heading}</span>
            <span className="story-count">
              {pad(current + 1)} / {pad(chapters.length)}
            </span>
            <span className="story-dots">
              {chapters.map((c, i) => (
                <span key={c.id} data-current={i === current ? '' : undefined} />
              ))}
            </span>
          </div>
        </div>
      )}
      <div className="story-text" ref={textRef}>
        {chapters.map((c, i) => (
          <section key={c.id} data-i={i} className="story-chap" aria-labelledby={`about-${c.id}`}>
            <h2 id={`about-${c.id}`} className="story-heading">
              {c.heading}
            </h2>
            <div className="about-body">{c.body}</div>
          </section>
        ))}
      </div>
    </div>
  )
}
