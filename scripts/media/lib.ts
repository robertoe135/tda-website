/**
 * Pure helpers for the photo import (no database, no disk): reading marketing's folder layout
 * and matching folder names to website projects.
 *
 * Layout of F:\Marketing\Website\Photos (marketing's curated web set):
 *
 *   <Category>\<N. Project Name>\<Name>_NN.jpg
 *   Corporate\1. Comcast Technology Center\Comcast Center_01.jpg
 *
 * Category is a portfolio category, N the project's place in it, NN the photo's place in the
 * slideshow. The same project can sit under several categories.
 */
import { normalizeName } from '../../src/hooks/preventNearDuplicates'
import { jaccard, levenshtein, similarity, tokens } from '../migrate/lib'

export const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'tif', 'tiff', 'webp'])

export type PhotoPath = {
  category: string
  folder: string // as written, e.g. "1. Comcast Technology Center"
  folderName: string // without the order prefix
  folderOrder?: number
  file: string
  slide?: number
}

/** A path relative to the Photos folder, with / or \ separators. Not a photo → undefined. */
export function parsePhotoPath(relative: string): PhotoPath | undefined {
  const parts = relative.split(/[\\/]+/).filter(Boolean)
  if (parts.length !== 3) return undefined
  const [category, folder, file] = parts
  const ext = file.split('.').pop()?.toLowerCase() ?? ''
  if (!IMAGE_EXTENSIONS.has(ext) || file.startsWith('.')) return undefined
  const prefix = folder.match(/^\s*(\d+)\s*[.)-]\s*(.+)$/)
  const slide = file.match(/(\d+)\s*\.[^.]+$/)
  return {
    category: category.trim(),
    folder,
    folderName: (prefix ? prefix[2] : folder).trim(),
    folderOrder: prefix ? Number(prefix[1]) : undefined,
    file,
    slide: slide ? Number(slide[1]) : undefined,
  }
}

/**
 * Abbreviations marketing uses in folder names, read as the words they stand for when matching
 * (never written anywhere): "NYU John A. Paulson Center" matches "New York University John A.
 * Paulson Center", "Rice University Music & PAC" matches "...Performing Arts Center".
 */
const ABBREVIATIONS: Record<string, string> = {
  nyu: 'new york university',
  nyc: 'new york city',
  ny: 'new york',
  us: 'united states',
  usa: 'united states',
  moma: 'museum of modern art',
  pac: 'performing arts center',
  dma: 'dallas museum of art',
  hq: 'headquarters',
  ctr: 'center',
}

/** A name ready for matching: accents removed, "&" as "and", abbreviations spelled out. */
export const matchText = (name: string) =>
  name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\bU\.\s?S\.(?:\s?A\.)?/g, 'US')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map((w) => ABBREVIATIONS[w] ?? w)
    .join(' ')

export type Candidate = { slug: string; name: string }
export type Match = { candidate: Candidate; score: number; exact: boolean }

/**
 * The website project a folder most likely belongs to. Exact when the names are the same
 * once spacing and punctuation are ignored; otherwise the closest name, for a person to
 * confirm. Never decides on its own which spelling is right.
 */
export function matchProject(folderName: string, candidates: Candidate[]): Match | undefined {
  const key = normalizeName(folderName)
  const exact = candidates.find((c) => normalizeName(c.name) === key || c.slug === key)
  if (exact) return { candidate: exact, score: 1, exact: true }
  const folderTokens = tokens(matchText(folderName))
  const spelled = normalizeName(matchText(folderName))
  let best: Match | undefined
  for (const candidate of candidates) {
    const score = Math.max(similarity(normalizeName(matchText(candidate.name)), spelled), jaccard(tokens(matchText(candidate.name)), folderTokens))
    if (!best || score > best.score) best = { candidate, score, exact: false }
  }
  return best && best.score >= 0.6 ? best : undefined
}

/** Photos in slideshow order: by the number in the file name, then by name. */
export const slideOrder = <T extends { slide?: number; file: string }>(photos: T[]): T[] =>
  [...photos].sort(
    (a, b) =>
      (a.slide ?? Number.MAX_SAFE_INTEGER) - (b.slide ?? Number.MAX_SAFE_INTEGER) ||
      a.file.localeCompare(b.file, 'en', { numeric: true }),
  )

/**
 * Why a folder on the drive must not be imported, or undefined if it may be. Never imports a
 * folder marked as having no image rights, or one marked as removed, unused or temporary
 * (names starting with "!" are working folders). The category folder must be one of the
 * portfolio's categories ("Museum" matches "Museums"); anything else (Lifestyle Photos,
 * Firm Profile, Archive) is not project photography.
 */
export function skipReason(category: string, folder: string, categories: string[]): string | undefined {
  const both = `${category} / ${folder}`
  if (/no\s*rights?/i.test(both)) return 'marked NO RIGHTS: never imported'
  if (/^\s*!/.test(category) || /^\s*!/.test(folder) || /\b(removed|not used)\b/i.test(both))
    return 'marked removed, unused or temporary'
  const key = categoryKey(category)
  if (!categories.some((c) => categoryKey(c) === key)) return 'not a portfolio category'
  return undefined
}

/**
 * A category name with each word's plural ignored, so "Museum" matches "Museums" and
 * "Place of Worship" matches "Places of Worship".
 */
export const categoryKey = (name: string) =>
  name
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((w) => normalizeName(w).replace(/s$/, ''))
    .join('')

/** The portfolio's categories, for when the database is not used (the inventory). */
export const PORTFOLIO_CATEGORIES = [
  'Academic', 'Corporate', 'Exhibitions', 'Historic', 'Hospitality', 'Libraries', 'Museums',
  'Places of Worship', 'Performing Arts', 'Residential', 'Restaurants', 'Retail', 'Site | Public Realm',
]

/** Working files that are never website photos, even inside a project folder. */
export const IGNORED_EXTENSIONS = new Set(['psd', 'psb'])

/**
 * Both commands accept the website folder or its Photos folder: given the website folder,
 * they look only in Photos, so Archive, Website Text and the rest are never read.
 */
export async function photosRoot(root: string): Promise<string> {
  const { readdir } = await import('fs/promises')
  const path = await import('path')
  if (/^photos$/i.test(path.basename(root.replace(/[\\/]+$/, '')))) return root
  const entries = await readdir(root, { withFileTypes: true })
  const photos = entries.find((e) => e.isDirectory() && /^photos$/i.test(e.name))
  return photos ? path.join(root, photos.name) : root
}

/** "Projects to Add" folders, at the top of the website folder or inside Photos. */
export async function findProjectsToAdd(given: string, photos: string): Promise<string[]> {
  const { readdir } = await import('fs/promises')
  const path = await import('path')
  const found: string[] = []
  for (const dir of [...new Set([given, photos])]) {
    try {
      for (const e of await readdir(dir, { withFileTypes: true }))
        if (e.isDirectory() && /^projects?\s+to\s+add$/i.test(e.name.trim())) found.push(path.join(dir, e.name))
    } catch {}
  }
  return found
}

export type GuessCandidate = Candidate & { categories?: string[] }
export type Guess = { candidate: GuessCandidate; score: number; exact: boolean; accepted: boolean; runnerUp?: GuessCandidate; twin?: boolean }

/** Two words are the same despite a typo: "Rubenstien"/"Rubenstein", "Cente"/"Center". Numbers must match. */
export function sameWord(a: string, b: string): boolean {
  if (a === b) return true
  if (/\d/.test(a) || /\d/.test(b)) return false
  const short = Math.min(a.length, b.length)
  if (short >= 4 && (a.startsWith(b) || b.startsWith(a))) return true // a cut-off word
  if (short < 4) return false
  return levenshtein(a, b) <= (short >= 7 ? 2 : 1)
}

/**
 * A best guess at the project a folder belongs to, for --accept-guesses. Scores how many of the
 * folder's words appear in the project's name (typos allowed) and how much of the name they
 * cover, plus a little when the folder's category is one of the project's categories. A guess
 * is accepted when every word of the folder is found or the score is high, and it is ahead of
 * the next project, or when two near-identical names (a project entered twice) both fit and the
 * closer one is taken. Otherwise it stays a suggestion for a person.
 */
export function guessProject(folderName: string, category: string, candidates: GuessCandidate[]): Guess | undefined {
  const exact = matchProject(folderName, candidates)
  if (exact?.exact) return { candidate: exact.candidate as GuessCandidate, score: 1, exact: true, accepted: true }
  const words = [...tokens(matchText(folderName))]
  if (!words.length) return undefined
  const sameCategory = (c: GuessCandidate) =>
    (c.categories ?? []).some((n) => categoryKey(n) === categoryKey(category))
  const scored = candidates
    .map((candidate) => {
      const theirs = [...tokens(matchText(candidate.name))]
      if (!theirs.length) return { candidate, score: 0, coverage: 0 }
      const found = words.filter((w) => theirs.some((t) => sameWord(w, t))).length
      const used = theirs.filter((t) => words.some((w) => sameWord(w, t))).length
      const coverage = found / words.length
      const wordScore = 0.7 * coverage + 0.3 * (used / theirs.length)
      const spelling = similarity(normalizeName(matchText(folderName)), normalizeName(matchText(candidate.name)))
      const score = Math.min(1, Math.max(wordScore, spelling) + (sameCategory(candidate) ? 0.05 : 0))
      return { candidate, score, coverage }
    })
    .sort((a, b) => b.score - a.score)
  const [best, second] = scored
  if (!best || best.score < 0.6) return undefined
  // Ahead by enough that the folder's category alone can decide between two similar names
  // ("The Wright" in Restaurants: The Wright at the Guggenheim, not The Wright Residence).
  const clear = !second || best.score - second.score >= 0.05
  // Two names this close to the folder are usually one project entered twice: take the closer.
  // Only when the two names are nearly the same as each other ("Hotel Barrier Fouquet's" /
  // "Hôtel Barrière Fouquet's"), never two different projects that share a word ("Museum").
  const twin = Boolean(
    second &&
      best.score >= 0.85 &&
      best.score - second.score < 0.05 &&
      similarity(normalizeName(matchText(best.candidate.name)), normalizeName(matchText(second.candidate.name))) >= 0.85,
  )
  const accepted = (clear && ((best.coverage === 1 && best.score >= 0.7) || best.score >= 0.8)) || twin
  return { candidate: best.candidate, score: best.score, exact: false, accepted, runnerUp: second?.candidate, twin }
}
