/**
 * How a project page mixes its write-up with its photos. Photo 0 is the hero, shown on its
 * own; the rest go in rows of two set after every two passages of the write-up, then, once
 * the text runs out, in rows of three. A last row is never a lone photo when it can be
 * avoided (3 + 1 becomes 2 + 2).
 */
export type LayoutBlock = { kind: 'text'; from: number; to: number } | { kind: 'photos'; indexes: number[] }

export function photoLayout(passages: number, photos: number, perBreak = 2): LayoutBlock[] {
  const blocks: LayoutBlock[] = []
  let next = 1 // photo 0 is the hero
  for (let from = 0; from < passages; from += perBreak) {
    const to = Math.min(from + perBreak, passages)
    blocks.push({ kind: 'text', from, to })
    // A row between passages, not after the last one: the rows after the text follow.
    if (to < passages && photos - next >= 2) {
      blocks.push({ kind: 'photos', indexes: [next, next + 1] })
      next += 2
    }
  }
  const rest = Array.from({ length: Math.max(0, photos - next) }, (_, i) => next + i)
  const sizes: number[] = []
  for (let left = rest.length; left > 0; ) {
    if (left === 4) {
      sizes.push(2, 2)
      break
    }
    const n = Math.min(3, left)
    sizes.push(n)
    left -= n
  }
  let at = 0
  for (const n of sizes) {
    blocks.push({ kind: 'photos', indexes: rest.slice(at, at + n) })
    at += n
  }
  return blocks
}
