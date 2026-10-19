import { geoDistance, geoOrthographic, type GeoProjection } from 'd3-geo'

import type { MapCity } from './map-types'

/**
 * The portfolio globe: one orthographic projection (a globe seen from space) at every zoom. Zoomed
 * out it is a whole globe; zoomed in, the part you look at is close to flat, so the same drawing
 * serves as the city-level map. Pure functions, shared by the page and the tests.
 */

/** Where the map looks (degrees) and how close: k 1 is the whole globe filling the frame. */
export type View = { lon: number; lat: number; k: number }
export type Size = { w: number; h: number }

export const MIN_K = 0.8
/** City level: closer, the coastline (Natural Earth 1:50m) gets too coarse to read. */
export const MAX_K = 40
/** Above this zoom the finer coastline (50m) is drawn; the coarse one (110m) looks blobby. */
export const DETAIL_K = 4.5

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))
const wrap = (lon: number) => ((((lon + 180) % 360) + 360) % 360) - 180

/** The globe's radius at k 1, in px: it fills the frame's shorter side with a small margin. */
export const radius = ({ w, h }: Size) => (Math.min(w, h) / 2) * 0.92

export function clampView(v: View): View {
  return { lon: wrap(v.lon), lat: clamp(v.lat, -75, 75), k: clamp(v.k, MIN_K, MAX_K) }
}

export function projection(v: View, size: Size): GeoProjection {
  return geoOrthographic()
    .rotate([-v.lon, -v.lat])
    .scale(radius(size) * v.k)
    .translate([size.w / 2, size.h / 2])
    .clipAngle(90)
    .precision(0.3)
}

/** The view that fits a box (west, south, east, north) in the frame. */
export function fit(
  [west, south, east, north]: [number, number, number, number],
  size: Size,
): View {
  const lon = (west + east) / 2
  const lat = (south + north) / 2
  // The box's edges, sampled, so the curve of the globe is taken into account.
  const pts: [number, number][] = []
  for (let i = 0; i <= 8; i++) {
    const x = west + ((east - west) * i) / 8
    const y = south + ((north - south) * i) / 8
    pts.push([x, south], [x, north], [west, y], [east, y])
  }
  const pad = Math.min(size.w, size.h) * 0.06
  const p = geoOrthographic()
    .rotate([-lon, -lat])
    .clipAngle(90)
    .fitExtent(
      [
        [pad, pad],
        [size.w - pad, size.h - pad],
      ],
      { type: 'MultiPoint', coordinates: pts },
    )
  return clampView({ lon, lat, k: p.scale() / radius(size) })
}

export type Preset = 'northeast' | 'north-america' | 'world'
export const PRESETS: { value: Preset; label: string }[] = [
  { value: 'northeast', label: 'Northeast' },
  { value: 'north-america', label: 'North America' },
  { value: 'world', label: 'World' },
]
const BOXES: Record<Exclude<Preset, 'world'>, [number, number, number, number]> = {
  // Washington to Boston, where most of the work is.
  northeast: [-81, 37.6, -68.5, 43.6],
  'north-america': [-128, 19, -60, 53],
}
export function presetView(p: Preset, size: Size): View {
  // The whole globe, turned to show the Americas and Europe together.
  return p === 'world' ? { lon: -45, lat: 28, k: 1 } : fit(BOXES[p], size)
}
export const inNorthAmerica = (c: { lat: number; lng: number }) => {
  const [w, s, e, n] = BOXES['north-america']
  return c.lng >= w && c.lng <= e && c.lat >= s && c.lat <= n
}

/** Zoom by a factor, keeping the place under (x, y) where it is, as maps do. */
export function zoomAt(v: View, factor: number, x: number, y: number, size: Size): View {
  let next = clampView({ ...v, k: v.k * factor })
  const target = projection(v, size).invert?.([x, y])
  // A point off the globe (in the corner, zoomed out) has no place to keep; just zoom.
  if (
    !target ||
    Number.isNaN(target[0]) ||
    geoDistance(target, [v.lon, v.lat]) > Math.PI / 2 - 0.05
  )
    return next
  // Turn the globe until that place is back under the pointer (a few steps converge).
  for (let i = 0; i < 4; i++) {
    const at = projection(next, size).invert?.([x, y])
    if (!at || Number.isNaN(at[0])) break
    next = clampView({
      ...next,
      lon: next.lon + target[0] - at[0],
      lat: next.lat + target[1] - at[1],
    })
  }
  return next
}

/** Turn the globe as if dragged by (dx, dy) px: what was under the pointer follows it. */
export function dragBy(v: View, dx: number, dy: number, size: Size): View {
  const deg = 180 / Math.PI / (radius(size) * v.k)
  return clampView({ ...v, lon: v.lon - dx * deg, lat: v.lat + dy * deg })
}

/** Between two views, through a wider view when they are far apart, like a flight. */
export function between(a: View, b: View, t: number): View {
  let dLon = wrap(b.lon - a.lon)
  if (Math.abs(dLon) > 180) dLon -= Math.sign(dLon) * 360
  const apart = (geoDistance([a.lon, a.lat], [b.lon, b.lat]) * 180) / Math.PI
  const lift = Math.min(Math.log(Math.min(a.k, b.k) / MIN_K), Math.log(1 + apart / 25))
  const logK =
    Math.log(a.k) + (Math.log(b.k) - Math.log(a.k)) * t - Math.max(0, lift) * Math.sin(Math.PI * t)
  return clampView({ lon: a.lon + dLon * t, lat: a.lat + (b.lat - a.lat) * t, k: Math.exp(logK) })
}

/** Dots closer than this on screen (px) would overlap, so they merge into one. */
export const MERGE_PX = 26

export type Dot = { key: string; x: number; y: number; cities: MapCity[]; count: number }

/** The dots on the side of the globe facing you, in px; cities that would overlap merge, biggest first. */
export function dotsFor(cities: MapCity[], v: View, size: Size): Dot[] {
  const proj = projection(v, size)
  const dots: Dot[] = []
  for (const c of cities) {
    if (geoDistance([c.lng, c.lat], [v.lon, v.lat]) > Math.PI / 2 - 0.02) continue
    const xy = proj([c.lng, c.lat])
    if (!xy) continue
    const [x, y] = xy
    if (x < -20 || y < -20 || x > size.w + 20 || y > size.h + 20) continue
    // Fully zoomed in nothing merges, so neighbours (Manhattan, Brooklyn) can each be picked.
    const near = v.k < MAX_K * 0.98 && dots.find((d) => Math.hypot(d.x - x, d.y - y) < MERGE_PX)
    if (near) {
      near.cities.push(c)
      near.count += c.projects.length
    } else dots.push({ key: c.slug, x, y, cities: [c], count: c.projects.length })
  }
  return dots
}

/** The middle of some cities, to zoom into a merged dot. */
export function centre(cities: MapCity[]): { lon: number; lat: number } {
  const n = cities.length
  return {
    lon: cities.reduce((s, c) => s + c.lng, 0) / n,
    lat: cities.reduce((s, c) => s + c.lat, 0) / n,
  }
}
