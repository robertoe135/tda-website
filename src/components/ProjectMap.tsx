'use client'

import { geoGraticule10, geoPath } from 'd3-geo'
import type { FeatureCollection, MultiPolygon } from 'geojson'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { feature } from 'topojson-client'
import countries110 from 'world-atlas/countries-110m.json'

import {
  between,
  centre,
  clampView,
  DETAIL_K,
  type Dot,
  dotsFor,
  dragBy,
  inNorthAmerica,
  MAX_K,
  type Preset,
  presetView,
  PRESETS,
  projection,
  type Size,
  type View,
  zoomAt,
} from '@/lib/globe'
import { type Box, clipTo, contains, type Pieces, pieces, viewBox } from '@/lib/globe-clip'
import type { MapData } from '@/lib/map-types'

type Topo = Parameters<typeof feature>[0] & {
  objects: { countries: Parameters<typeof feature>[1] }
}
const shapes = (t: unknown) => {
  const topo = t as Topo
  return feature(topo, topo.objects.countries) as unknown as FeatureCollection
}
const coarse = shapes(countries110)
const graticule = geoGraticule10()

const COLORS = { ocean: '#f1f1ef', land: '#d6d6d3', edge: '#e2e2df', grid: '#e6e6e3' }
/** Plain scrolling moves the page, not the map; zoom with a pinch, ⌘ / Ctrl + scroll, or buttons. */
const PLAIN_SCROLL_ZOOMS = false
const reduced = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * The portfolio as a globe: drag to turn it, pinch or ⌘ / Ctrl + scroll to zoom, from the whole
 * world down to a city. A dot per city, sized by its number of projects; dots that would overlap
 * merge, and clicking one zooms in until they part. A city's projects show beside the map (below
 * it on a phone). Northeast, North America and World fly to those views.
 */
export function ProjectMap({
  data,
  filterHref,
}: {
  data: MapData
  filterHref: Record<string, string>
}) {
  const frame = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  // Until the frame is measured (and without JavaScript) the dots are not placed.
  const [size, setSize] = useState<Size>({ w: 1200, h: 620 })
  const [measured, setMeasured] = useState(false)
  const startAt: Preset = data.cities.some(inNorthAmerica) ? 'north-america' : 'world'
  const [view, setView] = useState<View>(() => presetView(startAt, { w: 1200, h: 620 }))
  const [preset, setPresetState] = useState<Preset | undefined>(startAt)
  const presetRef = useRef<Preset | undefined>(startAt)
  const setPreset = useCallback((p: Preset | undefined) => {
    presetRef.current = p
    setPresetState(p)
  }, [])
  const [fine, setFine] = useState<Pieces>()
  const cut = useRef<{ box: Box; k: number; shape: MultiPolygon }>(undefined)
  const [hint, setHint] = useState<string>()
  const [picked, setPicked] = useState<string | undefined>(data.cities[0]?.slug)

  // Kept in refs too, for the event handlers and the flight animation.
  const viewRef = useRef(view)
  const sizeRef = useRef(size)
  const flight = useRef<number>(0)
  const hintTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const move = useCallback(
    (next: View, keepPreset = false) => {
      viewRef.current = next
      setView(next)
      if (!keepPreset) setPreset(undefined)
    },
    [setPreset],
  )
  const stopFlight = () => cancelAnimationFrame(flight.current)
  const flyTo = useCallback(
    (to: View, then?: Preset) => {
      cancelAnimationFrame(flight.current)
      const from = viewRef.current
      if (reduced()) return move(to, true)
      const start = performance.now()
      const ms = 900
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / ms)
        const e = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
        move(between(from, to, e), true)
        if (t < 1) flight.current = requestAnimationFrame(step)
      }
      setPreset(then)
      flight.current = requestAnimationFrame(step)
    },
    [move, setPreset],
  )
  const say = (text: string) => {
    setHint(text)
    clearTimeout(hintTimer.current)
    hintTimer.current = setTimeout(() => setHint(undefined), 1400)
  }

  // The frame's size on screen; a preset view is refitted to it.
  useEffect(() => {
    const el = frame.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => {
      const next = { w: e.contentRect.width, h: e.contentRect.height }
      if (!next.w || !next.h) return
      sizeRef.current = next
      setSize(next)
      setMeasured(true)
      if (presetRef.current) move(presetView(presetRef.current, next), true)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [move])

  // The finer coastline, fetched once someone zooms in.
  useEffect(() => {
    if (fine || view.k < DETAIL_K) return
    let live = true
    import('world-atlas/countries-50m.json').then((m) => live && setFine(pieces(shapes(m.default))))
    return () => {
      live = false
    }
  }, [fine, view.k])

  // Draw.
  useEffect(() => {
    // The finer coastline, cut to the part on screen (and cached while the view stays inside the
    // cut); none when zoomed out, or where no cut is possible (near a pole), so drawing stays fast.
    const detail = (v: View): MultiPolygon | undefined => {
      if (!fine || v.k < DETAIL_K) return undefined
      const need = viewBox(v, size, 1.1)
      if (!need) return undefined
      const c = cut.current
      if (c && contains(c.box, need) && v.k < c.k * 3) return c.shape
      const box = viewBox(v, size, 2) ?? need
      cut.current = { box, k: v.k, shape: clipTo(fine, box) }
      return cut.current.shape
    }
    const el = canvas.current
    const ctx = el?.getContext('2d')
    if (!el || !ctx) return
    const dpr = window.devicePixelRatio || 1
    if (el.width !== Math.round(size.w * dpr)) el.width = Math.round(size.w * dpr)
    if (el.height !== Math.round(size.h * dpr)) el.height = Math.round(size.h * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, size.w, size.h)
    const path = geoPath(projection(view, size), ctx)
    ctx.beginPath()
    path({ type: 'Sphere' })
    ctx.fillStyle = COLORS.ocean
    ctx.fill()
    if (view.k < 3) {
      ctx.beginPath()
      path(graticule)
      ctx.strokeStyle = COLORS.grid
      ctx.lineWidth = 0.5
      ctx.stroke()
    }
    ctx.beginPath()
    path(detail(view) ?? coarse)
    ctx.fillStyle = COLORS.land
    ctx.fill()
    ctx.strokeStyle = COLORS.ocean
    ctx.lineWidth = 0.6
    ctx.stroke()
    ctx.beginPath()
    path({ type: 'Sphere' })
    ctx.strokeStyle = COLORS.edge
    ctx.lineWidth = 1
    ctx.stroke()
  }, [view, size, fine])

  // Pointer, wheel and touch. Wheel and touch need non-passive listeners to stop the page moving.
  useEffect(() => {
    const el = frame.current
    if (!el) return
    const mac = /Mac|iPhone|iPad/.test(navigator.userAgent)
    const local = (x: number, y: number) => {
      const r = el.getBoundingClientRect()
      return [x - r.left, y - r.top] as const
    }
    const onWheel = (e: WheelEvent) => {
      // A trackpad pinch arrives as a wheel event with ctrlKey set.
      if (!PLAIN_SCROLL_ZOOMS && !e.ctrlKey && !e.metaKey) {
        say(`Use ${mac ? '⌘' : 'Ctrl'} + scroll to zoom`)
        return
      }
      e.preventDefault()
      stopFlight()
      const [x, y] = local(e.clientX, e.clientY)
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1
      move(
        zoomAt(
          viewRef.current,
          Math.exp((-e.deltaY * unit) / (e.ctrlKey ? 100 : 400)),
          x,
          y,
          sizeRef.current,
        ),
      )
    }
    // Touch: one finger scrolls the page, two move and zoom the map.
    let last: { x: number; y: number; d: number } | undefined
    const pair = (t: TouchList) => {
      const [a, b] = [t[0], t[1]]
      const [x, y] = local((a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2)
      return { x, y, d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) }
    }
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        stopFlight()
        last = pair(e.touches)
      }
    }
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 2) {
        if (e.touches.length === 1) say('Use two fingers to move the map')
        return
      }
      e.preventDefault()
      const now = pair(e.touches)
      if (last) {
        const s = sizeRef.current
        const turned = dragBy(viewRef.current, now.x - last.x, now.y - last.y, s)
        move(last.d > 0 ? zoomAt(turned, now.d / last.d, now.x, now.y, s) : turned)
      }
      last = now
    }
    const onTouchEnd = (e: TouchEvent) => {
      last = e.touches.length === 2 ? pair(e.touches) : undefined
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd)
    el.addEventListener('touchcancel', onTouchEnd)
    return () => {
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [move])

  // Mouse and pen: drag to turn the globe.
  const drag = useRef<{ x: number; y: number; id: number }>(undefined)
  const [dragging, setDragging] = useState(false)
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch' || e.button !== 0) return
    if ((e.target as HTMLElement).closest('button')) return
    stopFlight()
    drag.current = { x: e.clientX, y: e.clientY, id: e.pointerId }
    e.currentTarget.setPointerCapture(e.pointerId)
    setDragging(true)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    move(dragBy(viewRef.current, e.clientX - d.x, e.clientY - d.y, sizeRef.current))
    drag.current = { ...d, x: e.clientX, y: e.clientY }
  }
  const onPointerUp = (e: React.PointerEvent) => {
    if (drag.current?.id !== e.pointerId) return
    drag.current = undefined
    setDragging(false)
  }
  const zoomBy = (factor: number, x = size.w / 2, y = size.h / 2) =>
    flyTo(zoomAt(viewRef.current, factor, x, y, size))
  const onDoubleClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return
    const r = e.currentTarget.getBoundingClientRect()
    zoomBy(e.shiftKey ? 0.5 : 2, e.clientX - r.left, e.clientY - r.top)
  }
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.target !== e.currentTarget) return
    const step = 60
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [step, 0],
      ArrowRight: [-step, 0],
      ArrowUp: [0, step],
      ArrowDown: [0, -step],
    }
    if (moves[e.key]) move(dragBy(viewRef.current, ...moves[e.key], size))
    else if (e.key === '+' || e.key === '=') zoomBy(1.6)
    else if (e.key === '-' || e.key === '_') zoomBy(1 / 1.6)
    else return
    e.preventDefault()
  }

  const dots = measured ? dotsFor(data.cities, view, size) : []
  const city = data.cities.find((c) => c.slug === picked) ?? data.cities[0]
  const total = data.cities.reduce((n, c) => n + c.projects.length, 0)
  // A merged dot zooms in on its cities until they part; a single one shows its projects.
  const open = (d: Dot) => {
    if (d.cities.length > 1) {
      const c = centre(d.cities)
      flyTo(clampView({ ...c, k: Math.min(MAX_K, Math.max(view.k * 3, 3)) }))
    }
    setPicked(d.cities[0].slug)
  }
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

  return (
    <div className="project-map">
      <div className="map-area">
        <div className="map-bar">
          <div className="segmented" role="group" aria-label="Map area">
            {PRESETS.map((p) => (
              <button
                key={p.value}
                type="button"
                aria-pressed={preset === p.value}
                onClick={() => flyTo(presetView(p.value, size), p.value)}
              >
                {p.label}
              </button>
            ))}
          </div>
          <span className="map-summary">
            {plural(total, 'project', 'projects')} in {plural(data.cities.length, 'city', 'cities')}
          </span>
        </div>
        <div
          className={dragging ? 'map-frame is-dragging' : 'map-frame'}
          ref={frame}
          tabIndex={0}
          role="region"
          aria-label="Map of projects. Arrow keys turn it, plus and minus zoom."
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onDoubleClick={onDoubleClick}
          onKeyDown={onKeyDown}
        >
          <canvas ref={canvas} aria-hidden="true" />
          {/* Smaller dots last, so they sit on top and stay clickable. */}
          {[...dots]
            .sort((p, q) => q.count - p.count)
            .map((d) => {
              const size = Math.round(12 + Math.sqrt(d.count - 1) * 3.5)
              const merged = d.cities.length > 1
              const label = merged
                ? `${d.cities.map((c) => c.name).join(', ')}: ${plural(d.count, 'project', 'projects')}. Zoom in`
                : `${d.cities[0].name}: ${plural(d.count, 'project', 'projects')}`
              return (
                <button
                  key={d.key}
                  type="button"
                  className={merged ? 'map-dot is-group' : 'map-dot'}
                  aria-pressed={!merged && d.cities[0].slug === city?.slug}
                  aria-label={label}
                  onClick={() => open(d)}
                  style={{ left: d.x, top: d.y, width: size, height: size }}
                >
                  {d.count > 1 ? d.count : ''}
                </button>
              )
            })}
          <div className="map-zoom">
            <button
              type="button"
              aria-label="Zoom in"
              onClick={() => zoomBy(1.8)}
              disabled={view.k >= MAX_K}
            >
              +
            </button>
            <button
              type="button"
              aria-label="Zoom out"
              onClick={() => zoomBy(1 / 1.8)}
              disabled={view.k <= 0.81}
            >
              −
            </button>
          </div>
          <p className={hint ? 'map-hint is-shown' : 'map-hint'} aria-hidden="true">
            {hint}
          </p>
        </div>
      </div>

      {city && (
        <aside className="map-panel" aria-live="polite">
          <h2>{city.name}</h2>
          <p className="map-panel-count">{plural(city.projects.length, 'project', 'projects')}</p>
          <ul>
            {city.projects.map((p) => (
              <li key={p.slug}>
                <Link href={`/projects/${p.slug}`}>
                  <span>{p.name}</span>
                  {p.year && <span className="map-panel-year">{p.year}</span>}
                </Link>
              </li>
            ))}
          </ul>
          {filterHref[city.slug] && (
            <Link href={filterHref[city.slug]} className="map-panel-all">
              All projects in {city.name.split(',')[0]}
            </Link>
          )}
        </aside>
      )}
    </div>
  )
}
