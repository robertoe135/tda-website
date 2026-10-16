'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

/**
 * A project tile with a muted looping video, as on the old homepage. It plays only when the
 * visitor has not asked for reduced motion; otherwise it shows the still image until Play.
 * The video is decoration beside the project name (the link text), so screen readers skip
 * it; the pause button sits next to the link, never inside it, and names the project.
 */
export function VideoTile({
  href,
  name,
  src,
  type,
  poster,
}: {
  href: string
  name: string
  src: string
  type: string
  poster?: string
}) {
  const ref = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)

  // The label follows the video's own play and pause events, so it is right however playback
  // starts or stops (autoplay, the button, the browser pausing a background tab).
  useEffect(() => {
    const video = ref.current
    if (!video || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    video.play().catch(() => {})
  }, [])

  const toggle = () => {
    const video = ref.current
    if (!video) return
    if (video.paused) video.play().catch(() => {})
    else video.pause()
  }

  return (
    <div className="home-tile">
      <Link href={href} className="tile">
        <div className="tile-image">
          <video
            ref={ref}
            muted
            loop
            playsInline
            preload="metadata"
            poster={poster}
            aria-hidden="true"
            tabIndex={-1}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
          >
            <source src={src} type={type} />
          </video>
        </div>
        <span className="tile-name">{name}</span>
      </Link>
      <button type="button" className="video-toggle" onClick={toggle} aria-label={`${playing ? 'Pause' : 'Play'} video: ${name}`}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          {playing ? <path d="M9 5v14M15 5v14" /> : <path d="M7 5l12 7-12 7z" />}
        </svg>
      </button>
    </div>
  )
}
