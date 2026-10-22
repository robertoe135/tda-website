/**
 * What a project, person or homepage still needs before it reads as finished on the site.
 * Pure functions over records already loaded, so they can be tested without a database.
 * Nothing here changes data or suggests wording: it lists gaps for marketing to fill.
 */

export type ProjectRecord = {
  id: number
  name: string
  status?: string | null
  announceApproved?: boolean | null
  year?: number | null
  location?: unknown
  typologies?: unknown[] | null
  architects?: unknown[] | null
  description?: unknown
  heroImage?: unknown
  gallery?: unknown[] | null
  photographers?: unknown[] | null
}

export type Issue = { issue: string; detail: string }

const has = (v: unknown) => (Array.isArray(v) ? v.length > 0 : v !== null && v !== undefined && v !== '')

/** Rich text with at least one word in it. */
const hasText = (value: unknown): boolean => {
  if (typeof value === 'string') return value.trim().length > 0
  if (!value || typeof value !== 'object') return false
  const node = value as { text?: unknown; root?: unknown; children?: unknown[] }
  if (typeof node.text === 'string' && node.text.trim()) return true
  return [node.root, ...(node.children ?? [])].some((child) => child !== undefined && hasText(child))
}

/**
 * Gaps in one project, from its latest draft (`draft`) and, when it is live, the published
 * version (`live`). Photos uploaded to the draft but not on the live version are called out,
 * since the site only shows the published version.
 */
export function projectIssues(draft: ProjectRecord, live?: ProjectRecord): Issue[] {
  const issues: Issue[] = []
  const add = (issue: string, detail = '') => issues.push({ issue, detail })
  if (draft.status === 'in-progress' && !draft.announceApproved)
    add('Not approved to announce', 'Work in progress stays off the site until "Approved to announce" is ticked, with who approved it.')
  const photos = has(draft.heroImage) || has(draft.gallery)
  if (!photos) add('No photos', 'Add a main image or gallery photos.')
  else if (live && !has(live.heroImage) && !has(live.gallery)) add('Photos not published', 'Photos are on the draft only. Publish the project, or run pnpm media:publish.')
  if (photos && !has(draft.photographers)) add('No photographer credit', 'Every published photo is credited (Photographers field).')
  if (!has(draft.typologies)) add('No category', 'Pick at least one typology; the project is missing from every category view.')
  if (draft.status !== 'in-progress' && !has(draft.year)) add('No completion year', 'Missing from the Timeline.')
  if (!has(draft.location)) add('No location')
  if (!has(draft.architects)) add('No design architect', 'Leave empty only if TDA had no architect on the project.')
  if (!hasText(draft.description)) add('No write-up', 'Description is empty. Marketing writes it; nothing is generated.')
  return issues
}

const STOP = new Set(['the', 'and', 'of', 'at', 'a', 'an', 'in', 'for', 'co', 'inc'])

/** Words of a name with accents, case and punctuation removed: "Hôtel Barrière" → hotel, barriere. */
export const nameWords = (name: string) =>
  name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((w) => w && !STOP.has(w))

/** Typos between two words, counting two swapped letters as one ("nielson" / "neilson"). */
function editDistance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)))
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
    }
  return d[a.length][b.length]
}

/** Two words that are the same word spelled differently: barrier / barriere, nielson / neilson. */
const sameWord = (a: string, b: string) => {
  if (a === b) return true
  const shorter = Math.min(a.length, b.length)
  if (shorter < 5) return false
  // One typo in a short word, two in a long one; "bronx" and "broad" are different words.
  return a.startsWith(b) || b.startsWith(a) || editDistance(a, b) <= (shorter >= 9 ? 2 : 1)
}

/**
 * Why two project names may be one project entered twice, or undefined. Flags names whose
 * words match in any order, where one name's words are all in the other (at least two words),
 * or that differ by one misspelled word. A flag is a question for marketing, not a merge.
 */
export function duplicateReason(a: string, b: string): string | undefined {
  const wa = nameWords(a)
  const wb = nameWords(b)
  if (!wa.length || !wb.length) return undefined
  const inOther = (from: string[], to: string[]) => from.every((w) => to.some((x) => sameWord(w, x)))
  if (wa.length === wb.length && inOther(wa, wb) && inOther(wb, wa)) {
    return wa.every((w, i) => w === wb[i]) || [...wa].sort().join() === [...wb].sort().join()
      ? 'Same name, written differently'
      : 'Same name, one word spelled differently'
  }
  const [short, long] = wa.length < wb.length ? [wa, wb] : [wb, wa]
  if (short.length >= 2 && inOther(short, long)) return 'One name contains the other'
  return undefined
}

/** Every pair of names that may be the same project. */
export function possibleDuplicates<T extends { name: string }>(records: T[]): { a: T; b: T; reason: string }[] {
  const pairs: { a: T; b: T; reason: string }[] = []
  for (let i = 0; i < records.length; i++)
    for (let j = i + 1; j < records.length; j++) {
      const reason = duplicateReason(records[i].name, records[j].name)
      if (reason) pairs.push({ a: records[i], b: records[j], reason })
    }
  return pairs
}

export type PersonRecord = { id: number; name: string; title?: string | null; headshot?: unknown; bio?: unknown }

/** Gaps in a person shown on the team page. Bios are written and approved by TDA, never generated. */
export function personIssues(person: PersonRecord): Issue[] {
  const issues: Issue[] = []
  if (!has(person.headshot)) issues.push({ issue: 'No headshot', detail: 'Shown on the team page with an empty frame.' })
  if (!has(person.title)) issues.push({ issue: 'No title', detail: '' })
  if (!hasText(person.bio)) issues.push({ issue: 'No bio', detail: 'Their page shows projects only.' })
  return issues
}
