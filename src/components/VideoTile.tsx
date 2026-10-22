'use client'

import Link from 'next/link'
import { type CSSProperties, useEffect, useRef } from 'react'

/**
 * A project tile with a muted looping video, as on the old homepage. It always plays, with no
 * pause button (TDA's choice, 2026-10-22, knowing it ignores visitors who ask for reduced
 * motion). The video is decoration beside the project name (the link text), so screen readers
 * skip it.
 */
export function VideoTile({
  href,
  name,
  src,
  type,
  poster,
  style,
}: {
  href: string
  name: string
  src: string
  type: string
  poster?: string
  style?: CSSProperties
}) {
  const ref = useRef<HTMLVideoElement>(null)

  // autoPlay alone can miss: React does not always write "muted" into the server HTML, and
  // browsers only autoplay muted video. Starting it once hydrated covers that.
  useEffect(() => {
    ref.current?.play().catch(() => {})
  }, [])

  return (
    <div className="home-tile" style={style}>
      <Link href={href} className="tile">
        <div className="tile-image">
          <video ref={ref} autoPlay muted loop playsInline preload="metadata" poster={poster} aria-hidden="true" tabIndex={-1}>
            <source src={src} type={type} />
          </video>
        </div>
        <span className="tile-name">{name}</span>
      </Link>
    </div>
  )
}
