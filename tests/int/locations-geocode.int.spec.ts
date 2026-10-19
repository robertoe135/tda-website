import { describe, expect, it } from 'vitest'

import { fromList, geocode, type Hit, pick, queryFor } from '../../scripts/locations/geocode-lib'

const place = (city: string, region: string | null, country: string) => ({
  id: 1,
  city,
  region,
  country,
})
const hit = (display_name: string, addresstype: string, lat = '40.7', lon = '-74.0'): Hit => ({
  display_name,
  addresstype,
  lat,
  lon,
})

describe('locations:geocode', () => {
  it('asks by city, state and country', () => {
    expect(queryFor(place('Kennett Square', 'PA', 'United States'))).toEqual({
      city: 'Kennett Square',
      state: 'PA',
      country: 'United States',
    })
    expect(queryFor(place('London', null, 'UK'))).toEqual({ city: 'London', country: 'UK' })
  })

  it('takes the first settlement named like the city, skipping other kinds of place', () => {
    const f = pick(place('St. Louis', 'MO', 'United States'), [
      hit('St. Louis Lambert International Airport, Missouri', 'aeroway', '38.7', '-90.4'),
      hit('St. Louis, Missouri, United States', 'city', '38.63', '-90.2'),
    ])
    expect(f).toMatchObject({ result: 'ok', lat: 38.63, lng: -90.2 })
  })

  it('folds accents when comparing names', () => {
    expect(
      pick(place('Montreal', 'QC', 'Canada'), [hit('Montréal, Québec, Canada', 'city')]).result,
    ).toBe('ok')
  })

  it('marks anything unclear to check, and nothing found as none', () => {
    const odd = place('Lightfair 2023 New York', 'NY', 'United States')
    expect(pick(odd, [hit('Javits Center, New York', 'building')]).result).toBe('check')
    expect(pick(odd, []).result).toBe('none')
  })

  it('looks places up one at a time, waits between them, and survives a failed lookup', async () => {
    const waits: number[] = []
    let n = 0
    const out = await geocode(
      [place('Seattle', 'WA', 'United States'), place('Dallas', 'TX', 'United States')],
      async (q) => {
        if (n++ === 1) throw new Error('timeout')
        return [hit(`${q.city}, Washington, United States`, 'city', '47.6', '-122.3')]
      },
      async (ms) => {
        waits.push(ms)
      },
    )
    expect(out.map((f) => f.result)).toEqual(['ok', 'none'])
    expect(out[1].note).toContain('timeout')
    expect(waits).toEqual([1100])
  })
})

describe('locations:geocode --from (a corrected list)', () => {
  const locs = [
    { id: 1, displayName: 'New York, NY', city: 'New York' },
    { id: 2, displayName: 'Kennett Square, PA', city: 'Kennett Square' },
    { id: 3, displayName: 'Lightfair 2023 New York, NY', city: 'Lightfair 2023 New York' },
  ]
  it('saves rows marked ok, matched by id or by name, and lists the rest', () => {
    const { save, problems } = fromList(
      [
        { id: '1', location: 'New York, NY', result: 'ok', lat: '40.712776', lng: '-74.005974' },
        { location: 'kennett square, pa', result: 'OK ', lat: '39.8468', lng: '-75.7116' },
        { location: 'Lightfair 2023 New York, NY', result: 'check', lat: '40.75', lng: '-74.0' },
        { location: 'Somewhere, ZZ', result: 'ok', lat: '1', lng: '2' },
        { location: 'Kennett Square, PA', result: 'ok', lat: '', lng: '' },
        { location: 'New York, NY', result: 'ok', lat: '-74.0', lng: '140.7' },
      ],
      locs,
    )
    expect(save).toEqual([
      { id: 1, name: 'New York, NY', lat: 40.71278, lng: -74.00597 },
      { id: 2, name: 'Kennett Square, PA', lat: 39.8468, lng: -75.7116 },
      { id: 1, name: 'New York, NY', lat: -74, lng: 140.7 },
    ])
    expect(problems).toHaveLength(2)
    expect(problems[0]).toContain('no location')
    expect(problems[1]).toContain('empty')
  })
  it('refuses a latitude past the poles', () => {
    expect(
      fromList([{ location: 'New York, NY', result: 'ok', lat: '-140', lng: '40' }], locs)
        .problems[0],
    ).toContain('not a place')
  })
})
