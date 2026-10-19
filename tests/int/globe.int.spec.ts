import { describe, expect, it } from 'vitest'

import { between, dotsFor, dragBy, MAX_K, MIN_K, presetView, projection, zoomAt } from '@/lib/globe'
import type { MapCity } from '@/lib/map-types'

const size = { w: 1200, h: 620 }
const city = (slug: string, lat: number, lng: number, n = 1): MapCity => ({
  slug,
  name: slug,
  lat,
  lng,
  projects: Array.from({ length: n }, (_, i) => ({ name: `${slug}${i}`, slug: `${slug}${i}` })),
})
const ny = city('ny', 40.71, -74.01, 18)
const brooklyn = city('brooklyn', 40.65, -73.95)
const london = city('london', 51.51, -0.13, 2)
const shanghai = city('shanghai', 31.23, 121.47)

describe('the portfolio globe', () => {
  it('zooms from the whole world to the Northeast', () => {
    const world = presetView('world', size)
    const ne = presetView('northeast', size)
    const na = presetView('north-america', size)
    expect(world.k).toBe(1)
    expect(na.k).toBeGreaterThan(2)
    expect(ne.k).toBeGreaterThan(na.k * 3)
    // New York is in the middle of the Northeast view.
    const [x, y] = projection(ne, size)([ny.lng, ny.lat])!
    expect(Math.abs(x - size.w / 2)).toBeLessThan(size.w * 0.15)
    expect(Math.abs(y - size.h / 2)).toBeLessThan(size.h * 0.2)
  })

  it('keeps the place under the pointer where it is when zooming', () => {
    const v = presetView('north-america', size)
    const p = projection(v, size)
    const [x, y] = p([ny.lng, ny.lat])!
    const after = zoomAt(v, 2, x, y, size)
    const [x2, y2] = projection(after, size)([ny.lng, ny.lat])!
    expect(after.k).toBeCloseTo(v.k * 2)
    expect(Math.hypot(x2 - x, y2 - y)).toBeLessThan(1)
  })

  it('never zooms past the globe or past city level', () => {
    const v = presetView('world', size)
    expect(zoomAt(v, 0.01, 600, 310, size).k).toBe(MIN_K)
    expect(zoomAt(v, 1000, 600, 310, size).k).toBe(MAX_K)
  })

  it('turns the globe with a drag, and keeps the poles out of reach', () => {
    const v = presetView('world', size)
    expect(dragBy(v, -200, 0, size).lon).toBeGreaterThan(v.lon)
    expect(dragBy(v, 0, 100000, size).lat).toBe(75)
  })

  it('shows only the side of the globe facing you, merging cities that would overlap', () => {
    const atlantic = presetView('world', size)
    const keys = dotsFor([ny, brooklyn, london, shanghai], atlantic, size).map((d) => [
      d.key,
      d.count,
    ])
    // Brooklyn joins New York; Shanghai is on the far side.
    expect(keys).toEqual([
      ['ny', 19],
      ['london', 2],
    ])
    // Fully zoomed in, nothing merges.
    expect(dotsFor([ny, brooklyn], { lon: -74, lat: 40.7, k: MAX_K }, size)).toHaveLength(2)
  })

  it('flies between views through a wider one when they are far apart', () => {
    const a = { lon: -74, lat: 40.7, k: 20 }
    const b = { lon: 121, lat: 31, k: 20 }
    expect(between(a, b, 0).k).toBeCloseTo(20)
    expect(between(a, b, 0).lon).toBeCloseTo(-74)
    expect(between(a, b, 1).lon).toBeCloseTo(121)
    expect(between(a, b, 0.5).k).toBeLessThan(5)
  })
})
