import { geoConicConformal, type GeoProjection, geoNaturalEarth1, geoPath } from 'd3-geo'
import type { FeatureCollection, MultiPoint } from 'geojson'
import { feature } from 'topojson-client'
import countriesTopo from 'world-atlas/countries-110m.json'
import landTopo from 'world-atlas/land-110m.json'

import { MAP_H, MAP_W, type MapCity, type MapData, type MapView } from './map-types'
import type { ProjectCard } from './projects'

export type { MapCity, MapData, MapView }

/**
 * The portfolio map: countries in grey drawn on the site from Natural Earth (public domain, via
 * world-atlas), so no map service, no cookies and nothing to load. A dot per city, from the
 * coordinates set on each Location in the admin; a project whose location has none is left off.
 */
type Topo = Parameters<typeof feature>[0]
const topo = countriesTopo as unknown as Topo & {
  objects: { countries: Parameters<typeof feature>[1] }
}
const all = feature(topo, topo.objects.countries) as unknown as FeatureCollection
// Antarctica (010) takes a third of the world view and has no projects.
const countries: FeatureCollection = {
  ...all,
  features: all.features.filter((f) => f.id !== '010'),
}
// The world view is land only (no borders): a third of the size, and borders don't read at that scale.
const landT = landTopo as unknown as Topo & { objects: { land: Parameters<typeof feature>[1] } }
const land = feature(landT, landT.objects.land) as unknown as FeatureCollection

const box = (west: number, south: number, east: number, north: number): MultiPoint => ({
  type: 'MultiPoint',
  coordinates: [
    [west, south],
    [east, north],
  ],
})
const PROJECTIONS: Record<MapView, GeoProjection> = {
  // Washington to Boston, where most of the work is.
  northeast: geoConicConformal()
    .parallels([38, 42])
    .rotate([75, 0])
    .fitExtent(
      [
        [0, 0],
        [MAP_W, MAP_H],
      ],
      box(-81, 37.6, -68.5, 43.6),
    ),
  'north-america': geoConicConformal()
    .parallels([30, 45])
    .rotate([96, 0])
    .fitExtent(
      [
        [0, 0],
        [MAP_W, MAP_H],
      ],
      box(-130, 19, -52, 53),
    ),
  world: geoNaturalEarth1().fitExtent(
    [
      [10, 10],
      [MAP_W - 10, MAP_H - 10],
    ],
    countries,
  ),
}
const SHAPES: Record<MapView, FeatureCollection> = {
  northeast: countries,
  'north-america': countries,
  world: land,
}

// The country shapes only change with the package, so they are drawn once per server.
let paths: Record<MapView, string> | undefined
function mapPaths() {
  paths ??= Object.fromEntries(
    (Object.keys(PROJECTIONS) as MapView[]).map((v) => {
      const proj = PROJECTIONS[v].clipExtent([
        [0, 0],
        [MAP_W, MAP_H],
      ])
      return [v, geoPath(proj).digits(v === 'world' ? 0 : 1)(SHAPES[v]) ?? '']
    }),
  ) as Record<MapView, string>
  return paths
}

/** The map for a set of projects: one city per location that has coordinates. */
export function mapData(projects: ProjectCard[]): MapData {
  const bySlug = new Map<string, MapCity>()
  let unplaced = 0
  for (const p of projects) {
    const l = p.location
    if (!l?.slug || l.lat == null || l.lng == null) {
      unplaced++
      continue
    }
    let city = bySlug.get(l.slug)
    if (!city) {
      const at: MapCity['at'] = {}
      for (const v of Object.keys(PROJECTIONS) as MapView[]) {
        const xy = PROJECTIONS[v]([l.lng, l.lat])
        if (xy && xy[0] >= 0 && xy[0] <= MAP_W && xy[1] >= 0 && xy[1] <= MAP_H)
          at[v] = { x: +((xy[0] / MAP_W) * 100).toFixed(2), y: +((xy[1] / MAP_H) * 100).toFixed(2) }
      }
      city = { slug: l.slug, name: l.displayName ?? l.slug, projects: [], at }
      bySlug.set(l.slug, city)
    }
    city.projects.push({ name: p.name, slug: p.slug, year: p.year })
  }
  // Bigger cities first, so smaller dots draw on top and stay clickable.
  const cities = [...bySlug.values()].sort((a, b) => b.projects.length - a.projects.length)
  return { paths: mapPaths(), cities, unplaced }
}
