import { describe, expect, it } from 'vitest'

import { mapData } from '@/lib/map'
import type { ProjectCard } from '@/lib/projects'

const card = (id: number, location?: ProjectCard['location']): ProjectCard => ({
  id,
  name: `P${id}`,
  slug: `p${id}`,
  typologies: [],
  architects: [],
  collaboratorSlugs: [],
  photographers: [],
  status: 'completed',
  location,
})
const nyc = { displayName: 'New York, NY', slug: 'new-york-ny', lat: 40.71, lng: -74.01 }
const london = { displayName: 'London, UK', slug: 'london-uk', lat: 51.51, lng: -0.13 }

describe('mapData', () => {
  it('puts one city per location with coordinates, biggest first, and counts the rest', () => {
    const d = mapData([
      card(1, nyc),
      card(2, london),
      card(3, nyc),
      card(4, { displayName: 'X', slug: 'x' }),
      card(5),
    ])
    expect(d.cities.map((c) => [c.slug, c.projects.length])).toEqual([
      ['new-york-ny', 2],
      ['london-uk', 1],
    ])
    expect(d.unplaced).toBe(2)
  })
  it('keeps each city’s coordinates for the globe', () => {
    const [ny] = mapData([card(1, nyc)]).cities
    expect([ny.lat, ny.lng, ny.name]).toEqual([40.71, -74.01, 'New York, NY'])
  })
})
