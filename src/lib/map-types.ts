/** Shapes and sizes shared by the map's server code (map.ts) and the map on the page. */
export const MAP_W = 1200
export const MAP_H = 620

export type MapView = 'northeast' | 'north-america' | 'world'
export type MapCity = {
  slug: string
  name: string
  projects: { name: string; slug: string; year?: number | null }[]
  /** Position in each view, as a share of the map's width and height; absent when outside it. */
  at: Partial<Record<MapView, { x: number; y: number }>>
}
export type MapData = { paths: Record<MapView, string>; cities: MapCity[]; unplaced: number }
