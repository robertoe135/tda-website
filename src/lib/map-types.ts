/** Shapes shared by the map's server code (map.ts) and the map on the page. */
export type MapCity = {
  slug: string
  name: string
  lat: number
  lng: number
  projects: { name: string; slug: string; year?: number | null }[]
}
export type MapData = { cities: MapCity[]; unplaced: number }
