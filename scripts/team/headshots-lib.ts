/**
 * Matching original headshot files to people, for `pnpm team:headshots`. Pure: no disk, no
 * database. A file belongs to a person when its name (or its folder's name) holds the person's
 * first and last name, in either order, or their initials when no one else shares them.
 */

export type PersonName = { id: number; name: string }
export type HeadshotMatch<P extends PersonName> = { person: P; file: string; by: 'name' | 'initials' }

const words = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)

// Middle names and initials ("Suzan A. Tillotson") are not needed to recognise someone.
const firstLast = (name: string) => {
  const w = words(name).filter((x) => x.length > 1)
  return w.length >= 2 ? [w[0], w[w.length - 1]] : w
}

const initialsOf = (name: string) => firstLast(name).map((w) => w[0]).join('')

/** The parts of a file's path that can name a person: its name and the folders it sits in. */
const pathWords = (file: string) => {
  const parts = file.split(/[\\/]+/).filter(Boolean)
  const stem = (parts.pop() ?? '').replace(/\.[^.]+$/, '')
  return { stem: words(stem), folders: parts.flatMap(words) }
}

/**
 * The person each file shows. Full names first; then initials, only when exactly one person has
 * them and the file's own name is just those letters (with a prefix like "TDA" allowed:
 * "TDA_JS.jpg"). A file that could be two people is left out.
 */
export function matchHeadshots<P extends PersonName>(files: string[], people: P[]) {
  const matches: HeadshotMatch<P>[] = []
  const unmatched: string[] = []
  const byInitials = new Map<string, P[]>()
  for (const p of people) {
    const key = initialsOf(p.name)
    if (key.length >= 2) byInitials.set(key, [...(byInitials.get(key) ?? []), p])
  }
  for (const file of files) {
    const { stem, folders } = pathWords(file)
    const all = new Set([...stem, ...folders])
    // First name and a surname: any part of a double surname counts ("Baillie" or "Hinojosa").
    const named = people.filter((p) => {
      const w = words(p.name).filter((x) => x.length > 1)
      return w.length >= 2 && all.has(w[0]) && w.slice(1).some((x) => all.has(x))
    })
    if (named.length === 1) {
      matches.push({ person: named[0], file, by: 'name' })
      continue
    }
    if (named.length > 1) {
      unmatched.push(file)
      continue
    }
    const letters = stem.filter((w) => w !== 'tda' && !/^\d+$/.test(w) && !/^(headshot|photo|img|portrait|final|web)$/.test(w))
    const candidates = letters.length === 1 ? byInitials.get(letters[0]) : undefined
    if (candidates?.length === 1) matches.push({ person: candidates[0], file, by: 'initials' })
    else unmatched.push(file)
  }
  return { matches, unmatched }
}
