import type { MapCity, MapData } from './map-types'
import type { ProjectCard } from './projects'

export type { MapCity, MapData }

/**
 * The portfolio map's data: one city per location that has coordinates (set on each Location in
 * the admin), biggest first. A project whose location has none is left off and counted. The globe
 * itself is drawn in the browser from Natural Earth (public domain, via world-atlas): no map
 * service, no cookies.
 */
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
      city = { slug: l.slug, name: l.displayName ?? l.slug, lat: l.lat, lng: l.lng, projects: [] }
      bySlug.set(l.slug, city)
    }
    city.projects.push({ name: p.name, slug: p.slug, year: p.year })
  }
  // Bigger cities first, so smaller dots draw on top and stay clickable.
  const cities = [...bySlug.values()].sort((a, b) => b.projects.length - a.projects.length)
  return { cities, unplaced }
}
