'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

import { MAP_H, MAP_W, type MapCity, type MapData, type MapView } from '@/lib/map-types'

const VIEWS: { value: MapView; label: string }[] = [
  { value: 'northeast', label: 'Northeast' },
  { value: 'north-america', label: 'North America' },
  { value: 'world', label: 'World' },
]

/** Dots closer than this on screen (px) would overlap, so they merge into one. */
const MERGE_PX = 26

type Dot = { key: string; x: number; y: number; cities: MapCity[]; count: number }

/** Cities near each other in a view merge into one dot, biggest city first. */
function dotsFor(cities: MapCity[], view: MapView, width: number): Dot[] {
  // The map's units are 1200 wide whatever its size on screen; dots are a fixed size in px.
  const merge = (MERGE_PX * MAP_W) / Math.max(width, 1)
  const dots: Dot[] = []
  for (const c of cities) {
    const at = c.at[view]
    if (!at) continue
    const near = dots.find(
      (d) => Math.hypot(((d.x - at.x) / 100) * MAP_W, ((d.y - at.y) / 100) * MAP_H) < merge,
    )
    if (near) {
      near.cities.push(c)
      near.count += c.projects.length
    } else dots.push({ key: c.slug, x: at.x, y: at.y, cities: [c], count: c.projects.length })
  }
  return dots
}

/**
 * The portfolio as a map: grey countries, a dot per city sized by its number of projects.
 * A dot shows that city's projects beside the map (below it on a phone). Opens on North America,
 * when any project is there; Northeast is a close-up from Washington to Boston.
 */
export function ProjectMap({
  data,
  filterHref,
}: {
  data: MapData
  filterHref: Record<string, string>
}) {
  const [view, setView] = useState<MapView>(
    data.cities.some((c) => c.at['north-america']) ? 'north-america' : 'world',
  )
  const shown = data.cities.filter((c) => c.at[view])
  // How wide the map is on screen, so dots merge exactly when they would overlap.
  const frame = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(MAP_W)
  useEffect(() => {
    const el = frame.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const dots = dotsFor(data.cities, view, width)
  const [picked, setPicked] = useState<string | undefined>(data.cities[0]?.slug)
  const city = shown.find((c) => c.slug === picked) ?? shown[0]
  const total = shown.reduce((n, c) => n + c.projects.length, 0)
  // A merged dot zooms in to the Northeast when its cities are all there, else shows the biggest.
  const open = (d: Dot) => {
    if (d.cities.length > 1 && view !== 'northeast' && d.cities.every((c) => c.at.northeast))
      setView('northeast')
    setPicked(d.cities[0].slug)
  }
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

  return (
    <div className="project-map">
      <div className="map-area">
        <div className="map-bar">
          <div className="segmented" role="group" aria-label="Map area">
            {VIEWS.map((v) => (
              <button
                key={v.value}
                type="button"
                aria-pressed={view === v.value}
                onClick={() => setView(v.value)}
              >
                {v.label}
              </button>
            ))}
          </div>
          <span className="map-summary">
            {plural(total, 'project', 'projects')} in {plural(shown.length, 'city', 'cities')}
          </span>
        </div>
        <div className="map-frame" ref={frame}>
          <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} aria-hidden="true" focusable="false">
            <path d={data.paths[view]} />
          </svg>
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
                  style={{ left: `${d.x}%`, top: `${d.y}%`, width: size, height: size }}
                >
                  {d.count > 1 ? d.count : ''}
                </button>
              )
            })}
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
