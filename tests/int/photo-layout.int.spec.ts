import { describe, expect, it } from 'vitest'

import { photoLayout } from '@/lib/photoLayout'

const shape = (passages: number, photos: number) =>
  photoLayout(passages, photos).map((b) => (b.kind === 'text' ? `t${b.from}-${b.to}` : b.indexes.join('+')))

describe('photoLayout', () => {
  it('keeps photo 0 for the hero and sets pairs between passages', () => {
    expect(shape(5, 12)).toEqual(['t0-2', '1+2', 't2-4', '3+4', 't4-5', '5+6+7', '8+9', '10+11'])
  })
  it('never ends on a lone photo when four are left', () => {
    expect(shape(0, 5)).toEqual(['1+2', '3+4'])
    expect(shape(0, 8)).toEqual(['1+2+3', '4+5', '6+7'])
  })
  it('handles no text, no photos and only a hero', () => {
    expect(shape(0, 0)).toEqual([])
    expect(shape(3, 1)).toEqual(['t0-2', 't2-3'])
    expect(shape(1, 4)).toEqual(['t0-1', '1+2+3'])
  })
  it('uses every photo exactly once', () => {
    for (const [p, n] of [[0, 40], [7, 3], [4, 9], [12, 30]]) {
      const used = photoLayout(p, n).flatMap((b) => (b.kind === 'photos' ? b.indexes : []))
      expect(used).toEqual(Array.from({ length: Math.max(0, n - 1) }, (_, i) => i + 1))
    }
  })
})
