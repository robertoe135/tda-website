'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Which of a page's sections is being read: the last one whose top has passed a reading line
 * a third of the way down the window (by default). Near the end of the page the short last sections can
 * never scroll up that far, so over the last screen of scrolling the line slides down to the
 * bottom of the window: each of them still takes its turn, and the very bottom is the last one.
 * `lineAt` moves the reading line (a share of the window's height), e.g. below a sticky band.
 * `pin(i)` holds a section (after a click on its link) until the visitor scrolls by hand.
 */
export function useScrollSpy(getSections: () => HTMLElement[], deps: unknown[], lineAt: () => number = () => 0.33) {
  const [current, setCurrent] = useState(0)
  const pinned = useRef<number | null>(null)

  useEffect(() => {
    const sections = getSections()
    if (!sections.length) return
    let frame = 0
    const update = () => {
      frame = 0
      if (pinned.current !== null) return setCurrent(pinned.current)
      const vh = window.innerHeight
      const left = document.documentElement.scrollHeight - (window.scrollY + vh)
      const near = Math.min(1, Math.max(0, 1 - left / vh)) // 0 until the last screen, 1 at the bottom
      const at = lineAt()
      const line = vh * (at + (1 - at) * near) - 1
      let i = 0
      sections.forEach((s, k) => {
        if (s.getBoundingClientRect().top <= line) i = k
      })
      setCurrent(i)
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    // A scroll the visitor makes (not the jump after a click) releases a pinned section.
    const release = () => {
      pinned.current = null
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    for (const e of ['wheel', 'touchstart', 'keydown'] as const) window.addEventListener(e, release, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      for (const e of ['wheel', 'touchstart', 'keydown'] as const) window.removeEventListener(e, release)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  const pin = useCallback((i: number) => {
    pinned.current = i
    setCurrent(i)
  }, [])
  return { current, pin }
}
