import { geoArea } from 'd3-geo'
import type { Feature, FeatureCollection, MultiPolygon, Polygon, Position } from 'geojson'

import { radius, type Size, type View } from './globe'

/**
 * Zoomed in, only a small part of the world is on screen, but drawing every coastline point
 * costs the same. So the shapes are first cut to a box around the view (cheap: comparisons, no
 * maths) and only what is left is drawn. The cut is cached while the view stays inside it.
 */

/** west, south, east, north in degrees. */
export type Box = [number, number, number, number]

/** A box around what the view shows, `pad` times wider; none near a pole or across 180°. */
export function viewBox(v: View, size: Size, pad: number): Box | undefined {
  const a = ((Math.hypot(size.w, size.h) / 2 / (radius(size) * v.k)) * 180 * pad) / Math.PI
  if (a > 50) return undefined
  const s = v.lat - a
  const n = v.lat + a
  if (s < -85 || n > 85) return undefined
  const dl = a / Math.cos((Math.max(Math.abs(s), Math.abs(n)) * Math.PI) / 180)
  const w = v.lon - dl
  const e = v.lon + dl
  if (w < -180 || e > 180) return undefined
  return [w, s, e, n]
}

export const contains = (outer: Box, inner: Box) =>
  outer[0] <= inner[0] && outer[1] <= inner[1] && outer[2] >= inner[2] && outer[3] >= inner[3]

/** Sutherland–Hodgman: a ring cut to the box, in degrees. The box's own edges come out filled in. */
export function clipRing(ring: Position[], [w, s, e, n]: Box): Position[] {
  let pts = ring.slice(0, -1)
  const edges: [(p: Position) => boolean, (a: Position, b: Position) => Position][] = [
    [(p) => p[0] >= w, (a, b) => [w, a[1] + ((b[1] - a[1]) * (w - a[0])) / (b[0] - a[0])]],
    [(p) => p[0] <= e, (a, b) => [e, a[1] + ((b[1] - a[1]) * (e - a[0])) / (b[0] - a[0])]],
    [(p) => p[1] >= s, (a, b) => [a[0] + ((b[0] - a[0]) * (s - a[1])) / (b[1] - a[1]), s]],
    [(p) => p[1] <= n, (a, b) => [a[0] + ((b[0] - a[0]) * (n - a[1])) / (b[1] - a[1]), n]],
  ]
  for (const [inside, cross] of edges) {
    if (pts.length === 0) break
    const out: Position[] = []
    for (let i = 0; i < pts.length; i++) {
      const cur = pts[i]
      const prev = pts[(i + pts.length - 1) % pts.length]
      if (inside(cur)) {
        if (!inside(prev)) out.push(cross(prev, cur))
        out.push(cur)
      } else if (inside(prev)) out.push(cross(prev, cur))
    }
    pts = out
  }
  if (pts.length < 3) return []
  // A sliver left along the box's edge has no area, and the globe would read it inside out.
  let area = 0
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % pts.length]
    area += a[0] * b[1] - b[0] * a[1]
  }
  if (Math.abs(area) < 1e-6) return []
  // The globe draws a straight line between two points as the shortest way round, which bends
  // away from a long box edge; extra points every 2° keep the edge where it is.
  const dense: Position[] = []
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % pts.length]
    const steps = Math.ceil(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])) / 2)
    for (let j = 0; j < steps; j++)
      dense.push([a[0] + ((b[0] - a[0]) * j) / steps, a[1] + ((b[1] - a[1]) * j) / steps])
  }
  dense.push(dense[0])
  return dense
}

const bounds = (rings: Position[][]): Box => {
  let [w, s, e, n] = [Infinity, Infinity, -Infinity, -Infinity]
  for (const r of rings)
    for (const [x, y] of r) {
      if (x < w) w = x
      if (x > e) e = x
      if (y < s) s = y
      if (y > n) n = y
    }
  return [w, s, e, n]
}
const overlaps = (a: Box, b: Box) => a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1]

/** Every polygon of the shapes with its bounds, worked out once. */
export type Pieces = { rings: Position[][]; box: Box }[]
export function pieces(fc: FeatureCollection): Pieces {
  const out: Pieces = []
  for (const f of fc.features as Feature<Polygon | MultiPolygon>[]) {
    const g = f.geometry
    if (!g) continue
    const polys =
      g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []
    for (const rings of polys) out.push({ rings, box: bounds(rings) })
  }
  return out
}

/** The polygons cut to the box, ready to draw. */
export function clipTo(all: Pieces, box: Box): MultiPolygon {
  const coordinates: Position[][][] = []
  for (const p of all) {
    if (!overlaps(p.box, box)) continue
    // Wholly inside: nothing to cut.
    if (contains(box, p.box)) {
      coordinates.push(p.rings)
      continue
    }
    const [outer, ...holes] = p.rings.map((r) => clipRing(r, box))
    if (!outer.length) continue
    let poly = [outer, ...holes.filter((h) => h.length)]
    // Inside a box smaller than half the globe, a piece can't cover more than half of it: if it
    // seems to, it was read inside out, so turn its rings round.
    if (geoArea({ type: 'Polygon', coordinates: poly }) > 2 * Math.PI)
      poly = poly.map((r) => [...r].reverse())
    coordinates.push(poly)
  }
  return { type: 'MultiPolygon', coordinates }
}
