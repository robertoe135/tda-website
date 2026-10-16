'use client'

import { useState } from 'react'

export type Slide = {
  src: string
  srcSet?: string
  width?: number
  height?: number
  alt: string
  caption?: string
}

/**
 * Project photographs, one at a time, with previous / next and a counter. Images come in the
 * sizes Payload already makes (card, gallery, hero), so the browser picks one via srcset and
 * nothing is resized again at request time. Arrow keys work while the slideshow has focus.
 */
export function Slideshow({ slides, label }: { slides: Slide[]; label: string }) {
  const [index, setIndex] = useState(0)
  if (slides.length === 0) return null
  const count = slides.length
  const slide = slides[index]
  const go = (step: number) => setIndex((i) => (i + step + count) % count)

  return (
    <section
      className="slideshow"
      aria-roledescription="carousel"
      aria-label={label}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') go(-1)
        if (e.key === 'ArrowRight') go(1)
      }}
    >
      <div className="slideshow-frame">
        {/* Plain <img>: Payload already made the sizes; next/image would bill a second resize. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={slide.src}
          src={slide.src}
          srcSet={slide.srcSet}
          sizes="(min-width: 1200px) 1152px, 100vw"
          width={slide.width}
          height={slide.height}
          alt={slide.alt}
          loading={index === 0 ? 'eager' : 'lazy'}
          fetchPriority={index === 0 ? 'high' : undefined}
        />
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
