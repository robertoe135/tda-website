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
import { jaccard, similarity, tokens } from '../migrate/lib'

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
  const folderTokens = tokens(folderName)
  let best: Match | undefined
  for (const candidate of candidates) {
    const score = Math.max(similarity(normalizeName(candidate.name), key), jaccard(tokens(candidate.name), folderTokens))
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
