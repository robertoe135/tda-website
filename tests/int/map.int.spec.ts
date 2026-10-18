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
  clientSlugs: [],
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
  it('places New York in every view and London only in the world view', () => {
    const [ny, ldn] = mapData([card(1, nyc), card(2, london)]).cities
    for (const v of ['northeast', 'north-america', 'world'] as const) {
      expect(ny.at[v]!.x).toBeGreaterThan(0)
      expect(ny.at[v]!.x).toBeLessThan(100)
    }
    expect(ldn.at.world).toBeDefined()
    expect(ldn.at['north-america']).toBeUndefined()
  })
  it('draws the three maps', () => {
    const { paths } = mapData([])
    expect(paths.world.length).toBeGreaterThan(1000)
    expect(paths.northeast.startsWith('M')).toBe(true)
  })
})
