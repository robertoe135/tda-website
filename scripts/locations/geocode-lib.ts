/**
 * Finding a location's coordinates by name, for the portfolio map. Kept apart from the command
 * so it can be tested with a fake lookup service.
 *
 * Coordinates are per city (Location), not per project: the map shows one dot per city, and a
 * project named alone ("Rainbow Room", "The Shed") is easy to match to the wrong place.
 */

export type Place = {
  id: number
  city: string
  region?: string | null
  country: string
  displayName?: string | null
}

/** One result from the lookup service (OpenStreetMap's Nominatim, JSON v2). */
export type Hit = {
  lat: string
  lon: string
  display_name: string
  addresstype?: string
  category?: string
  type?: string
}

export type Lookup = (query: Record<string, string>) => Promise<Hit[]>

export type Found = {
  place: Place
  /** ok: a city, town or village whose name matches; check: something was found, look at it; none. */
  result: 'ok' | 'check' | 'none'
  lat?: number
  lng?: number
  /** What the service found, to compare with the location's name. */
  found?: string
  note?: string
}

const SETTLEMENT = new Set([
  'city',
  'town',
  'village',
  'hamlet',
  'municipality',
  'borough',
  'suburb',
  'county',
])
const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()

/** The structured query for a location: city, state or province, country. */
export function queryFor(p: Place): Record<string, string> {
  return { city: p.city, ...(p.region ? { state: p.region } : {}), country: p.country }
}

/** The first result that is a settlement with the location's city in its name, else the first, to check. */
export function pick(p: Place, hits: Hit[]): Found {
  if (hits.length === 0)
    return { place: p, result: 'none', note: 'Nothing found. Check the city and country spelling.' }
  const city = fold(p.city)
  const good = hits.find(
    (h) =>
      SETTLEMENT.has(h.addresstype ?? h.type ?? '') &&
      fold(h.display_name).split(',')[0].includes(city),
  )
  const h = good ?? hits[0]
  return {
    place: p,
    result: good ? 'ok' : 'check',
    lat: Number(h.lat),
    lng: Number(h.lon),
    found: h.display_name,
    note: good ? undefined : 'Not clearly the city: look at "found" before saving.',
  }
}

/** Looks up each place in turn, waiting between requests as the free service asks (1 a second). */
export async function geocode(
  places: Place[],
  lookup: Lookup,
  wait = (ms: number) => new Promise((r) => setTimeout(r, ms)),
) {
  const out: Found[] = []
  for (const [i, p] of places.entries()) {
    if (i > 0) await wait(1100)
    try {
      out.push(pick(p, await lookup(queryFor(p))))
    } catch (e) {
      out.push({ place: p, result: 'none', note: `Lookup failed: ${(e as Error).message}` })
    }
  }
  return out
}

/** The free OpenStreetMap lookup. It asks every caller to say who they are. */
export const nominatim: Lookup = async (query) => {
  const url = new URL('https://nominatim.openstreetmap.org/search')
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v)
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('limit', '5')
  const res = await fetch(url, {
    headers: { 'User-Agent': 'tillotsondesign.com website (portfolio map; one-off lookup)' },
  })
  if (!res.ok) throw new Error(`OpenStreetMap answered ${res.status}`)
  return (await res.json()) as Hit[]
}
