import { geoArea, geoContains } from 'd3-geo'
import type { FeatureCollection } from 'geojson'
import { feature } from 'topojson-client'
import { describe, expect, it } from 'vitest'
import countries50 from 'world-atlas/countries-50m.json'

import { presetView } from '@/lib/globe'
import { clipRing, clipTo, contains, pieces, viewBox } from '@/lib/globe-clip'

const size = { w: 1200, h: 620 }
// A square "country", clockwise as GeoJSON-on-a-sphere expects for d3.
const square = (w: number, s: number, e: number, n: number) => [
  [w, s],
  [w, n],
  [e, n],
  [e, s],
  [w, s],
]
const fc = (rings: number[][][]): FeatureCollection => ({
  type: 'FeatureCollection',
  features: rings.map((r) => ({
    type: 'Feature',
    properties: {},
    geometry: { type: 'Polygon', coordinates: [r] },
  })),
})

describe('cutting the coastline to the view', () => {
  it('gives a box around the Northeast, and none for the whole globe', () => {
    const box = viewBox(presetView('northeast', size), size, 2)!
    expect(box[0]).toBeLessThan(-81)
    expect(box[2]).toBeGreaterThan(-68.5)
    expect(viewBox(presetView('world', size), size, 1)).toBeUndefined()
  })

  it('cuts a ring to the box and keeps it closed', () => {
    const r = clipRing(square(-10, -10, 10, 10), [0, 0, 20, 20])
    expect(r[0]).toEqual(r[r.length - 1])
    for (const [x, y] of r) {
      expect(x).toBeGreaterThanOrEqual(0)
      expect(y).toBeGreaterThanOrEqual(0)
    }
    expect(clipRing(square(30, 30, 40, 40), [0, 0, 20, 20])).toEqual([])
  })

  it('keeps what is inside the box drawn the same, and drops what is outside', () => {
    const all = pieces(fc([square(-80, 35, -70, 45), square(100, 20, 120, 40)]))
    const box: [number, number, number, number] = [-76, 38, -72, 42]
    const cut = clipTo(all, box)
    expect(cut.coordinates).toHaveLength(1)
    // A point inside both the shape and the box is still filled; one outside the shape is not.
    expect(geoContains(cut, [-74, 40])).toBe(true)
    expect(geoContains(cut, [-60, 40])).toBe(false)
    // The cut is the box (the shape covers it), not the whole world inside out.
    expect(geoArea(cut)).toBeLessThan(0.01)
    expect(contains([-80, 30, -60, 50], box)).toBe(true)
  })

  it('keeps the ocean as ocean, including the wide cuts made mid-flight', () => {
    const t = countries50 as unknown as Parameters<typeof feature>[0] & {
      objects: { countries: Parameters<typeof feature>[1] }
    }
    const all = pieces(feature(t, t.objects.countries) as unknown as FeatureCollection)
    const s = { w: 840, h: 434 }
    // Halfway from North America to the Northeast: a box from Alaska to Africa, where cut pieces
    // used to come out inside out and turn the whole ocean grey.
    for (const v of [presetView('northeast', s), { lon: -90, lat: 30, k: 7.6 }]) {
      const cut = clipTo(all, viewBox(v, s, 2)!)
      expect(geoContains(cut, [-77.0, 40.5])).toBe(true) // Pennsylvania
      expect(geoContains(cut, [-70.0, 39.0])).toBe(false) // the Atlantic
      expect(geoContains(cut, [-40.0, 30.0])).toBe(false) // mid-Atlantic
    }
  })
})
