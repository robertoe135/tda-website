/**
 * Why a folder of images on the drive did not reach the website: pure helpers for
 * `pnpm media:why` (no disk, no database).
 */
import { PORTFOLIO_CATEGORIES, skipReason } from './lib'

export const WEB_IMAGE = /\.(jpe?g|png|tiff?|webp)$/i
export const NEEDS_EXPORT = /\.(heic|psd|psb|cr2|cr3|nef|arw|dng|raw)$/i

export type FolderPlace =
  | { kind: 'importable' }
  | { kind: 'blocked'; reason: string; fix: string }

/**
 * Where a folder sits, given its path relative to the Website folder (as parts), and whether
 * the photo import can read it. The import reads only `Photos/<portfolio category>/<project>/`,
 * and only images directly inside that folder.
 */
export function folderPlace(parts: string[], webImages: number, otherImages: number): FolderPlace {
  const [top, ...rest] = parts
  const label = parts.join(' / ')
  // Markers anywhere in the path win over where the folder sits: a folder inside "ST Removed"
  // or "INTERNAL USE ONLY" was taken out on purpose, and must not be moved back in.
  if (/no\s*rights?/i.test(label))
    return { kind: 'blocked', reason: 'Marked NO RIGHTS', fix: 'Never imported. Only if TDA now has web rights: rename the folder.' }
  if (/internal\s+use|need\w*\s+.*approval|approval\s+needed|do\s+not\s+use/i.test(label))
    return { kind: 'blocked', reason: 'Marked internal use only or awaiting approval', fix: 'Never imported. Only once the approval is in: move the approved photos into their own project folder.' }
  if (parts.some((p) => /^\s*!/.test(p) || /\b(removed|not\s+used|unused)\b/i.test(p)))
    return { kind: 'blocked', reason: 'In a folder marked removed or unused', fix: 'Taken out on purpose. Nothing to do unless the project should be back on the site.' }
  if (/^projects?\s+to\s+add$/i.test(top?.trim() ?? '') || rest.some((p) => /^projects?\s+to\s+add$/i.test(p.trim())))
    return { kind: 'blocked', reason: 'In Projects to Add', fix: 'Run pnpm projects:add (photos for an existing project go in its 0 - Archive folder).' }
  if (!/^photos$/i.test(top ?? ''))
    return { kind: 'blocked', reason: `Outside Photos (in ${top})`, fix: 'The import only reads Photos/<Category>/<Project>/. Copy approved web photos there.' }
  if (rest.length < 2)
    return { kind: 'blocked', reason: 'Not in a category folder', fix: 'Move into Photos/<Category>/<Project>/.' }
  if (rest.length > 2)
    return { kind: 'blocked', reason: 'In a subfolder of a project folder', fix: 'The import reads only images directly in the project folder. Move the web set up one level.' }
  const [category, folder] = rest
  const skip = skipReason(category, folder, PORTFOLIO_CATEGORIES)
  if (skip === 'not a portfolio category')
    return { kind: 'blocked', reason: `Category "${category}" is not a portfolio category`, fix: `Move into one of: ${PORTFOLIO_CATEGORIES.join(', ')}.` }
  if (skip) return { kind: 'blocked', reason: 'In a folder marked removed or unused', fix: 'Taken out on purpose. Nothing to do unless the project should be back on the site.' }
  if (!webImages && otherImages)
    return { kind: 'blocked', reason: 'Only HEIC, PSD or RAW files', fix: 'Export JPEGs into the same folder.' }
  return { kind: 'importable' }
}

/** The folder's own name without an order prefix: "3. MIT Museum" → "MIT Museum". */
export const folderName = (folder: string) => folder.replace(/^\s*\d+\s*[.)-]\s*/, '').trim()

// Words too common in project names to point at one project.
const COMMON = new Set([
  'center', 'centre', 'museum', 'library', 'university', 'college', 'school', 'house', 'hotel', 'office', 'offices',
  'building', 'tower', 'street', 'avenue', 'park', 'hall', 'theater', 'theatre', 'church', 'gallery', 'store',
  'flagship', 'restaurant', 'residence', 'headquarters', 'campus', 'public', 'new', 'york', 'city', 'lobby',
  'renovation', 'restoration', 'arts', 'performing', 'art', 'national', 'american', 'international',
])

const words = (name: string) =>
  name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 4 && !COMMON.has(w))

/**
 * Projects a folder name may point to when it is too short to match properly ("Bloomberg
 * London" → Bloomberg European Headquarters, or London Mithraeum): those sharing a word with it
 * that no other project's name has. More than three means the word says too little, and none are returned. These
 * are for a person to check, never imported on their own.
 */
export function possibleProjects<T extends { name: string }>(folder: string, projects: T[]): T[] {
  // Distinctive: in exactly one project's name. "Square" (Madison Square, Lincoln Square) is not.
  const seen = new Map<string, number>()
  for (const p of projects) for (const w of new Set(words(p.name))) seen.set(w, (seen.get(w) ?? 0) + 1)
  const mine = new Set(words(folder).filter((w) => seen.get(w) === 1))
  if (!mine.size) return []
  const hits = projects.filter((p) => words(p.name).some((w) => mine.has(w)))
  return hits.length <= 3 ? hits : []
}
