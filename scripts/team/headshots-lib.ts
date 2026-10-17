/**
 * Matching original headshot files to people, for `pnpm team:headshots`. Pure: no disk, no
 * database. A file belongs to a person when its name (or its folder's name) holds the person's
 * first name and surname in either order; or, failing that, a first name or initials no one
 * else has ("TDA_Shan0157-C.jpg", "ST 1 V2 No BG.png", "SBH.png"). Or someone lists it.
 */

export type PersonName = { id: number; name: string }
export type HeadshotMatch<P extends PersonName> = { person: P; file: string; by: 'name' | 'first name' | 'initials' | 'your list' }

// Accents removed; letters and digits are separate words, so "Shan0157" reads "shan", "0157".
const words = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    // "NoorDSC01382" and "MariaMendes" run words together: split where lowercase meets capitals.
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/([a-z])(\d)/g, '$1 $2')
    .replace(/(\d)([a-z])/g, '$1 $2')
    .split(/[^a-z0-9]+/)
    .filter(Boolean)

// Labels added to file names by photographers and designers, never part of anyone's name.
const LABELS = new Set([
  'tda', 'no', 'bg', 'fs', 'ls', 'v', 'c', 'copy', 'digital', 'temporary', 'temp', 'final', 'web',
  'headshot', 'photo', 'img', 'dsc', 'portrait', 'edit', 'crop',
])

// Middle names and initials ("Suzan A. Tillotson") are not needed to recognise someone.
const nameWords = (name: string) => words(name).filter((x) => x.length > 1)
const firstLast = (name: string) => {
  const w = nameWords(name)
  return w.length >= 2 ? [w[0], w[w.length - 1]] : w
}
const initialsOf = (name: string) => firstLast(name).map((w) => w[0]).join('')
// Every part of the name: "Scott Baillie-Hinojosa" → "sbh".
const allInitialsOf = (name: string) => nameWords(name).map((w) => w[0]).join('')

/** The parts of a file's path that can name a person: its name and the folders it sits in. */
const pathWords = (file: string) => {
  const parts = file.split(/[\\/]+/).filter(Boolean)
  const stem = (parts.pop() ?? '').replace(/\.[^.]+$/, '')
  return { stem: words(stem), folders: parts.flatMap(words) }
}

const index = <P,>(entries: [string, P][]) => {
  const map = new Map<string, P[]>()
  for (const [key, value] of entries) if (key.length >= 2) map.set(key, [...(map.get(key) ?? []), value])
  return map
}

/**
 * The person each file shows. First name and surname first (either part of a double surname);
 * then, when the file's own name is a single word once labels and numbers are set aside, a
 * first name or initials that exactly one person has. A file that could be two people is left out.
 */
export function matchHeadshots<P extends PersonName>(files: string[], people: P[]) {
  const matches: HeadshotMatch<P>[] = []
  const unmatched: string[] = []
  const byInitials = index(people.flatMap((p) => [...new Set([initialsOf(p.name), allInitialsOf(p.name)])].map((k): [string, P] => [k, p])))
  const byFirst = index(people.map((p): [string, P] => [nameWords(p.name)[0] ?? '', p]).filter(([k]) => k.length >= 3))
  for (const file of files) {
    const { stem, folders } = pathWords(file)
    const all = new Set([...stem, ...folders])
    const named = people.filter((p) => {
      const w = nameWords(p.name)
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
    const left = stem.filter((w) => !LABELS.has(w) && !/^\d+$/.test(w))
    const first = left.length === 1 ? byFirst.get(left[0]) : undefined
    if (first?.length === 1) {
      matches.push({ person: first[0], file, by: 'first name' })
      continue
    }
    const initials = left.length === 1 ? byInitials.get(left[0]) : undefined
    if (initials && new Set(initials).size === 1) matches.push({ person: initials[0], file, by: 'initials' })
    else unmatched.push(file)
  }
  return { matches, unmatched }
}

/**
 * Matches from a list someone filled in (person and file columns, as in headshots.csv). The
 * person is found by name, the file by its name anywhere in the folder. A file given to two
 * people, a person not in the admin and a file not in the folder are reported, never guessed.
 */
export function matchesFromList<P extends PersonName>(rows: { person: string; file: string }[], people: P[], photos: string[]) {
  const key = (s: string) => words(s).join(' ')
  const byName = new Map(people.map((p) => [key(p.name), p]))
  const base = (f: string) => (f.split(/[\\/]/).pop() ?? f).toLowerCase()
  const byBase = new Map<string, string[]>()
  for (const f of photos) byBase.set(base(f), [...(byBase.get(base(f)) ?? []), f])
  const wanted = rows.map((r) => ({ person: r.person.trim(), file: r.file.trim() })).filter((r) => r.person && r.file)
  const uses = new Map<string, number>()
  for (const r of wanted) uses.set(base(r.file), (uses.get(base(r.file)) ?? 0) + 1)
  const matches: HeadshotMatch<P>[] = []
  const problems: string[] = []
  for (const r of wanted) {
    const person = byName.get(key(r.person))
    const found = photos.includes(r.file) ? [r.file] : (byBase.get(base(r.file)) ?? [])
    if (!person) problems.push(`${r.person}: not in the admin (check the spelling)`)
    else if ((uses.get(base(r.file)) ?? 0) > 1) problems.push(`${r.person}: ${r.file} is listed for more than one person`)
    else if (found.length === 0) problems.push(`${r.person}: ${r.file} is not in the folder`)
    else if (found.length > 1) problems.push(`${r.person}: ${found.length} files are called ${r.file}; write its folder too`)
    else matches.push({ person, file: found[0], by: 'your list' })
  }
  return { matches, problems }
}
