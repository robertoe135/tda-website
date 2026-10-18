'use client'

import { type ReactNode, useEffect, useRef, useState } from 'react'

import type { Slide } from '@/lib/projects'

/** The page under the project name: text passages and rows of photos (indexes into `slides`). */
export type StoryBlock = { kind: 'text'; node: ReactNode } | { kind: 'photos'; indexes: number[] }

const SWIPE_PX = 40

/**
 * Project photographs: the first one large (the hero), the rest in rows set between the
 * passages of the write-up, then after it. Rows keep every photo whole: each takes a width in
 * proportion to its shape, so a row's photos share one height. Any photo opens full screen,
 * with previous / next, arrow keys and swipe; Escape or the close button returns to the page.
 */
export function ProjectPhotos({
  slides,
  name,
  children,
  blocks,
}: {
  slides: Slide[]
  name: string
  /** Shown between the hero and the write-up: the fact band. */
  children?: ReactNode
  blocks: StoryBlock[]
}) {
  const [open, setOpen] = useState<number | null>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const touch = useRef<{ x: number; y: number } | null>(null)
  const count = slides.length

  useEffect(() => {
    const d = dialog.current
    if (!d) return
    if (open !== null && !d.open) d.showModal()
    if (open === null && d.open) d.close()
  }, [open])

  const go = (step: number) => setOpen((i) => (i === null ? i : (i + step + count) % count))
  const enlarge = (i: number) => (
    <button
      type="button"
      className="photo-button"
      onClick={() => setOpen(i)}
      aria-label={`Enlarge photograph ${i + 1} of ${count}${slides[i].alt ? `: ${slides[i].alt}` : ''}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={slides[i].src}
        srcSet={slides[i].srcSet}
        sizes={i === 0 ? '(min-width: 1200px) 1168px, 100vw' : '(min-width: 720px) 50vw, 100vw'}
        width={slides[i].width}
        height={slides[i].height}
        alt=""
        decoding="async"
        loading={i === 0 ? 'eager' : 'lazy'}
        fetchPriority={i === 0 ? 'high' : undefined}
      />
    </button>
  )
  const ratio = (i: number) => (slides[i].width && slides[i].height ? slides[i].width! / slides[i].height! : 1.5)
  const current = open === null ? undefined : slides[open]

  return (
    <>
      {count > 0 && <figure className="project-hero">{enlarge(0)}</figure>}
      {children}
      <div className="project-story">
        {blocks.map((b, k) =>
          b.kind === 'text' ? (
            <div key={k} className="project-description">
              {b.node}
            </div>
          ) : (
            <div key={k} className={b.indexes.length === 1 ? 'photo-row is-single' : 'photo-row'}>
              {b.indexes.map((i) => (
                <figure key={i} className="photo" style={{ '--r': ratio(i) } as React.CSSProperties}>
                  {enlarge(i)}
                  {slides[i].caption && <figcaption>{slides[i].caption}</figcaption>}
                </figure>
              ))}
            </div>
          ),
        )}
      </div>

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
          if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(t.clientY - start.y) * 1.5) go(dx < 0 ? 1 : -1)
        }}
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
            <button type="button" className="lightbox-close" aria-label="Close" onClick={() => setOpen(null)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
            {count > 1 && (
              <>
                <button type="button" className="lightbox-arrow lightbox-prev" aria-label="Previous photograph" onClick={() => go(-1)}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                    <path d="M19 12H5M11 6l-6 6 6 6" />
                  </svg>
                </button>
                <button type="button" className="lightbox-arrow lightbox-next" aria-label="Next photograph" onClick={() => go(1)}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </button>
              </>
            )}
          </>
        )}
      </dialog>
    </>
  )
}
