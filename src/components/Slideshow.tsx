'use client'

import { type CSSProperties, useRef, useState } from 'react'

export type Slide = {
  src: string
  srcSet?: string
  width?: number
  height?: number
  alt: string
  caption?: string
}

const SWIPE_PX = 40

/**
 * Project photographs, one at a time, with previous / next, swipe and a counter. The frame
 * fits each photo's own shape within the window. Slides are stacked and cross-fade (no fade with reduced motion). The photos either side of the current
 * one load ahead, so a click never waits on a blank frame; the rest load once neared, so a
 * visitor who looks at one photo doesn't download forty. Images come in the sizes Payload
 * already makes (card, gallery, hero) and the browser picks one via srcset. Arrow keys work
 * while the slideshow has focus.
 */
export function Slideshow({ slides, label }: { slides: Slide[]; label: string }) {
  const [index, setIndex] = useState(0)
  // Slides that have been near the current one keep their image once loaded.
  const [near, setNear] = useState(() => new Set([0, 1, slides.length - 1]))
  const touch = useRef<{ x: number; y: number } | null>(null)
  if (slides.length === 0) return null
  const count = slides.length
  const slide = slides[index]

  const go = (step: number) => {
    const next = (index + step + count) % count
    setIndex(next)
    const around = [next, (next + 1) % count, (next - 1 + count) % count]
    setNear((s) => (around.every((i) => s.has(i)) ? s : new Set([...s, ...around])))
  }

  return (
    <section
      className="slideshow"
      aria-roledescription="carousel"
      aria-label={label}
      // The frame takes the current photo's proportions (capped to the window height), so a
      // vertical photo is shown tall rather than shrunk into a landscape box.
      style={{ '--r': slide.width && slide.height ? slide.width / slide.height : 1.5 } as CSSProperties}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') go(-1)
        if (e.key === 'ArrowRight') go(1)
      }}
    >
      <div
        className="slideshow-frame"
        onTouchStart={(e) => {
          const t = e.touches[0]
          touch.current = { x: t.clientX, y: t.clientY }
        }}
        onTouchEnd={(e) => {
          const start = touch.current
          touch.current = null
          if (!start || count < 2) return
          const t = e.changedTouches[0]
          const dx = t.clientX - start.x
          // Mostly sideways, so a vertical page scroll never changes the photo.
          if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(t.clientY - start.y) * 1.5) go(dx < 0 ? 1 : -1)
        }}
      >
        {slides.map((s, i) => (
          <div key={s.src} className="slideshow-slide" data-current={i === index ? '' : undefined} aria-hidden={i !== index}>
            {near.has(i) && (
              // Plain <img>: Payload already made the sizes; next/image would bill a second resize.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={s.src}
                srcSet={s.srcSet}
                sizes="(min-width: 1200px) 1152px, 100vw"
                width={s.width}
                height={s.height}
                alt={i === index ? s.alt : ''}
                decoding="async"
                loading={i === 0 ? 'eager' : undefined}
                fetchPriority={i === 0 ? 'high' : undefined}
              />
            )}
          </div>
        ))}
        {count > 1 && (
          <>
            <button type="button" className="slideshow-arrow slideshow-prev" aria-label="Previous photograph" onClick={() => go(-1)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <path d="M19 12H5M11 6l-6 6 6 6" />
              </svg>
            </button>
            <button type="button" className="slideshow-arrow slideshow-next" aria-label="Next photograph" onClick={() => go(1)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </button>
          </>
        )}
      </div>
      <div className="slideshow-meta">
        <span aria-live="polite">{slide.caption ?? ''}</span>
        {count > 1 && (
          <span>
            {index + 1} / {count}
          </span>
        )}
      </div>
    </section>
  )
}
