'use client'

import { createContext, type ReactNode, useContext, useEffect, useRef, useState } from 'react'

import type { Slide } from '@/lib/projects'

const SWIPE_PX = 40
const Open = createContext<(i: number) => void>(() => {})

/** Swipe left or right (mostly sideways, so a page scroll never counts) calls `go`. */
function useSwipe(go: (step: number) => void) {
  const start = useRef<{ x: number; y: number } | null>(null)
  return {
    onTouchStart: (e: React.TouchEvent) => {
      const t = e.touches[0]
      start.current = { x: t.clientX, y: t.clientY }
    },
    onTouchEnd: (e: React.TouchEvent) => {
      const s = start.current
      start.current = null
      if (!s) return
      const t = e.changedTouches[0]
      const dx = t.clientX - s.x
      if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(t.clientY - s.y) * 1.5)
        go(dx < 0 ? 1 : -1)
    },
  }
}

const ArrowIcon = ({ back }: { back?: boolean }) => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    aria-hidden="true"
  >
    <path d={back ? 'M19 12H5M11 6l-6 6 6 6' : 'M5 12h14M13 6l6 6-6 6'} />
  </svg>
)

/**
 * Holds a project's photographs for the hero and the slideshow below it, and shows any of them
 * full screen: the photo whole on a dark ground, previous / next, arrow keys and swipe, Escape
 * or the close button to return. The page between them (facts, text) stays server-rendered.
 */
export function PhotoViewer({
  slides,
  name,
  children,
}: {
  slides: Slide[]
  name: string
  children: ReactNode
}) {
  const [open, setOpen] = useState<number | null>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const count = slides.length
  const go = (step: number) => setOpen((i) => (i === null ? i : (i + step + count) % count))
  const swipe = useSwipe(go)

  useEffect(() => {
    const d = dialog.current
    if (!d) return
    if (open !== null && !d.open) d.showModal()
    if (open === null && d.open) d.close()
  }, [open])

  const current = open === null ? undefined : slides[open]
  return (
    <Open.Provider value={setOpen}>
      {children}
      <dialog
        ref={dialog}
        className="lightbox"
        aria-label={`Photographs of ${name}`}
        onClose={() => setOpen(null)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') go(-1)
          if (e.key === 'ArrowRight') go(1)
        }}
        onClick={(e) => {
          // A click on the dark surround closes it, as on most galleries.
          if (e.target === e.currentTarget) setOpen(null)
        }}
        {...swipe}
      >
        {current && open !== null && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={current.src}
              className="lightbox-image"
              src={current.src}
              srcSet={current.srcSet}
              sizes="100vw"
              width={current.width}
              height={current.height}
              alt={current.alt}
            />
            <div className="lightbox-bar">
              <span aria-live="polite">{current.caption ?? ''}</span>
              <span>
                {open + 1} / {count}
              </span>
            </div>
            <button
              type="button"
              className="lightbox-close"
              aria-label="Close"
              onClick={() => setOpen(null)}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                aria-hidden="true"
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
            {count > 1 && (
              <>
                <button
                  type="button"
                  className="lightbox-arrow lightbox-prev"
                  aria-label="Previous photograph"
                  onClick={() => go(-1)}
                >
                  <ArrowIcon back />
                </button>
                <button
                  type="button"
                  className="lightbox-arrow lightbox-next"
                  aria-label="Next photograph"
                  onClick={() => go(1)}
                >
                  <ArrowIcon />
                </button>
              </>
            )}
          </>
        )}
      </dialog>
    </Open.Provider>
  )
}

/** The first photograph across the full width, cropped to its focal point; a click shows it whole. */
export function HeroPhoto({ slide, count }: { slide: Slide; count: number }) {
  const open = useContext(Open)
  return (
    <button
      type="button"
      className="hero-button"
      onClick={() => open(0)}
      aria-label={`Enlarge photograph 1 of ${count}${slide.alt ? `: ${slide.alt}` : ''}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={slide.src}
        srcSet={slide.srcSet}
        sizes="100vw"
        width={slide.width}
        height={slide.height}
        alt=""
        fetchPriority="high"
        style={slide.position ? { objectPosition: slide.position } : undefined}
      />
    </button>
  )
}

/**
 * The photographs after the hero, one at a time, in a frame that never changes size: each photo
 * shows whole inside it on a light ground. Arrows, arrow keys and swipe step through them; a
 * click opens the photo full screen. Photos either side of the current one load ahead.
 * `offset` is the first photo's place among all the project's photos (1, after the hero).
 */
export function ProjectSlideshow({
  slides,
  offset,
  name,
}: {
  slides: Slide[]
  offset: number
  name: string
}) {
  const open = useContext(Open)
  const [index, setIndex] = useState(0)
  const [near, setNear] = useState(() => new Set([0, 1, slides.length - 1]))
  const count = slides.length
  const go = (step: number) => {
    const next = (index + step + count) % count
    setIndex(next)
    const around = [next, (next + 1) % count, (next - 1 + count) % count]
    setNear((s) => (around.every((i) => s.has(i)) ? s : new Set([...s, ...around])))
  }
  const swipe = useSwipe((step) => count > 1 && go(step))
  if (count === 0) return null
  const slide = slides[index]

  return (
    <section
      className="slideshow"
      aria-roledescription="carousel"
      aria-label={`Photographs of ${name}`}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') go(-1)
        if (e.key === 'ArrowRight') go(1)
      }}
    >
      <div className="slideshow-frame" {...swipe}>
        {slides.map((s, i) => (
          <button
            key={s.src}
            type="button"
            className="slideshow-slide"
            data-current={i === index ? '' : undefined}
            aria-hidden={i !== index}
            tabIndex={i === index ? 0 : -1}
            onClick={() => open(offset + i)}
            aria-label={`Enlarge photograph ${offset + i + 1} of ${offset + count}${s.alt ? `: ${s.alt}` : ''}`}
          >
            {near.has(i) && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={s.src}
                srcSet={s.srcSet}
                sizes="(min-width: 1200px) 1100px, 100vw"
                width={s.width}
                height={s.height}
                alt=""
                decoding="async"
                loading="lazy"
              />
            )}
          </button>
        ))}
        {count > 1 && (
          <>
            <button
              type="button"
              className="slideshow-arrow slideshow-prev"
              aria-label="Previous photograph"
              onClick={() => go(-1)}
            >
              <ArrowIcon back />
            </button>
            <button
              type="button"
              className="slideshow-arrow slideshow-next"
              aria-label="Next photograph"
              onClick={() => go(1)}
            >
              <ArrowIcon />
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
