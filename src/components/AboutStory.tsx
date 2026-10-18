'use client'

import { type ReactNode, useEffect, useRef, useState } from 'react'

export type StoryImage = { src: string; srcSet?: string; alt: string; position?: string }
export type StoryChapter = { id: string; heading: string; image?: StoryImage; body: ReactNode }

/**
 * Profile as a photo story: the photo holds still beside the text and changes to the section
 * being read. On phones the photo is a band under the header. A section without a photo keeps
 * the one before it (or the next one, at the top). With no photos at all, it is plain text.
 */
export function AboutStory({ intro, chapters }: { intro: ReactNode; chapters: StoryChapter[] }) {
  const [current, setCurrent] = useState(0)
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

  useEffect(() => {
    const root = textRef.current
    if (!root || typeof IntersectionObserver === 'undefined') return
    const phone = window.matchMedia('(max-width: 819px)').matches
    const seen = new Map<number, boolean>()
    // A thin line across the screen: the section crossing it is the one being read.
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) seen.set(Number((e.target as HTMLElement).dataset.i), e.isIntersecting)
        const first = [...seen].filter(([, v]) => v).map(([k]) => k).sort((a, b) => a - b)[0]
        if (first !== undefined) setCurrent(first)
      },
      { rootMargin: phone ? '-62% 0px -30% 0px' : '-45% 0px -45% 0px' },
    )
    root.querySelectorAll<HTMLElement>('[data-i]').forEach((s) => io.observe(s))
    return () => io.disconnect()
  }, [chapters.length])

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
                style={s.position ? { objectPosition: s.position } : undefined}
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
