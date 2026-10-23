import { normalizeName } from '../hooks/preventNearDuplicates'

/**
 * Telling two records of the same firm apart from two firms: used by the admin's merge tool to
 * suggest duplicates, and by the migration scripts. Suggestions only; a person decides.
 */

export const levenshtein = (a: string, b: string): number => {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]
    row[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j]
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = tmp
    }
  }
  return row[b.length]
}

export const similarity = (a: string, b: string): number =>
  1 - levenshtein(a, b) / Math.max(a.length, b.length, 1)

const words = (s: string) => s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)

const GENERIC = new Set(
  'a an and the of for with architect architects architecture associates assoc inc llc llp pc ltd co company corp corporation design designs designers group partners partnership studio studios office interiors landscape consulting consultants engineers engineering urban planning international'.split(' '),
)

/**
 * Two spellings of one firm: almost the same letters ("Foster + Partner", "Pelli Clark Pelli"),
 * or the same name with generic words added ("REX" and "REX Architecture"). Not "Gensler" and
 * "Gensler/WKSHPS", and never "OMA" inside "Tomasetti".
 */
export function sameFirm(a: string, b: string): boolean {
  // "CallisonRTKL - CRTKL", "Leslie E. Robertson Associates (LERA)", "Kazuyo Sejima + Ryue
  // Nishizawa / SANAA": each form is a name of the firm.
  const forms = (s: string) => [s, s.replace(/\s*\([^)]*\)/g, ''), ...s.split(/\s+[-/]\s+/)].map((f) => f.trim()).filter(Boolean)
  if (forms(a).length > 1 || forms(b).length > 1) return forms(a).some((f) => forms(b).some((g) => sameName(f, g)))
  return sameName(a, b)
}

function sameName(a: string, b: string) {
  const [x, y] = [normalizeName(a), normalizeName(b)]
  if (x === y || similarity(x, y) >= 0.88) return true
  const [short, long] = [words(a), words(b)].sort((p, q) => p.length - q.length)
  if (!short.length) return false
  const start = long.join(' ').indexOf(short.join(' '))
  if (start < 0 || !` ${long.join(' ')} `.includes(` ${short.join(' ')} `)) return false
  const rest = [...long]
  for (const w of short) rest.splice(rest.indexOf(w), 1)
  return rest.every((w) => GENERIC.has(w))
}

/** The words that tell a firm apart: "Foster and Partners Ltd" → foster. */
const coreWords = (s: string) => words(s).filter((w) => !GENERIC.has(w))

/**
 * Looser than sameFirm, for suggesting duplicates to a person, who decides: also names that
 * are the same once generic words are dropped ("Foster + Partners", "Foster and Partners Ltd").
 * Never used to match a firm automatically.
 */
export function likelySameFirm(a: string, b: string): boolean {
  if (sameFirm(a, b)) return true
  const [x, y] = [coreWords(a).join(' '), coreWords(b).join(' ')]
  return Boolean(x) && x === y
}

/**
 * Pairs of records that look like one firm, by any of their names. Only names that share a
 * telling word or their first letters are compared, so a list of hundreds stays quick.
 */
export function duplicatePairs<T extends { names: string[] }>(items: T[]): [T, T][] {
  const keys = (name: string) => [...coreWords(name).map((w) => `w:${w}`), `p:${normalizeName(name).slice(0, 4)}`]
  const index = new Map<string, number[]>()
  items.forEach((item, i) => {
    for (const key of new Set(item.names.flatMap(keys))) index.set(key, [...(index.get(key) ?? []), i])
  })
  const compared = new Set<string>()
  const pairs: [T, T][] = []
  for (const group of index.values())
    for (let x = 0; x < group.length; x++)
      for (let y = x + 1; y < group.length; y++) {
        const [i, j] = [group[x], group[y]].sort((p, q) => p - q)
        if (compared.has(`${i}:${j}`)) continue
        compared.add(`${i}:${j}`)
        if (items[i].names.some((a) => items[j].names.some((b) => likelySameFirm(a, b)))) pairs.push([items[i], items[j]])
      }
  return pairs
}
