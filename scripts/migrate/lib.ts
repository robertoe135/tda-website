/** Helpers shared by the migration scripts. */
import { mkdir, readFile, readdir, writeFile } from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

export const SITE = 'https://www.tillotsondesign.com'
export const migrateDir = path.dirname(fileURLToPath(import.meta.url))
export const outDir = path.join(migrateDir, 'out')
export const cacheDir = path.join(migrateDir, 'cache')

export type ReviewRow = { url: string; field: string; asWritten: string; suggested: string; note: string }

const STOP = new Set(['the', 'and', 'of', 'at', 'a', 'for', 'new', 'york', 'full'])

export const tokens = (s: string): Set<string> =>
  new Set(
    decodeURIComponent(s.replace(/\+/g, ' '))
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t && !STOP.has(t)),
  )

export const jaccard = (a: Set<string>, b: Set<string>): number => {
  if (!a.size || !b.size) return 0
  let shared = 0
  for (const t of a) if (b.has(t)) shared++
  return shared / (a.size + b.size - shared)
}

export { levenshtein, similarity } from '../../src/lib/firm-names'

import { toCsv as csv } from '../../src/lib/csv'

export { csv }

const REVIEW_COLUMNS = ['source URL', 'field', 'as written', 'suggested', 'note']

/** Each script writes its own out/review-<step>.csv; this rebuilds review.csv from all of them. */
export async function writeReview(step: string, rows: ReviewRow[]): Promise<number> {
  await mkdir(outDir, { recursive: true })
  await writeFile(
    path.join(outDir, `review-${step}.csv`),
    csv(
      rows.map((r) => ({
        'source URL': r.url,
        field: r.field,
        'as written': r.asWritten,
        suggested: r.suggested,
        note: r.note,
      })),
      REVIEW_COLUMNS,
    ),
  )
  const body = (text: string) => text.split('\n').slice(1).filter(Boolean)
  const parts = [await readFile(path.join(migrateDir, 'review-notes.csv'), 'utf8').catch(() => '')]
  for (const file of (await readdir(outDir)).filter((f) => /^review-.+\.csv$/.test(f)).sort()) {
    parts.push(await readFile(path.join(outDir, file), 'utf8'))
  }
  const lines = parts.flatMap(body)
  await writeFile(path.join(migrateDir, 'review.csv'), [REVIEW_COLUMNS.join(','), ...lines].join('\n') + '\n')
  return lines.length
}

/**
 * The old credits pages list several photographers in one line, comma-separated:
 * "Brett Beyer, Iwan Baan". Split on commas only; "+" and "&" are part of studio names
 * ("Floto + Warner", "FG+SG Architectural Photography"). Names are kept as written.
 */
export const splitCredit = (line: string): string[] =>
  line
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean)

/** Lexical rich text from plain paragraphs, copied exactly. */
export const richText = (paragraphs: string[]) => ({
  root: {
    type: 'root',
    format: '' as const,
    indent: 0,
    version: 1,
    direction: 'ltr' as const,
    children: paragraphs.map((text) => ({
      type: 'paragraph',
      format: '' as const,
      indent: 0,
      version: 1,
      direction: 'ltr' as const,
      textFormat: 0,
      textStyle: '',
      children: [{ type: 'text', text, format: 0, style: '', mode: 'normal', detail: 0, version: 1 }],
    })),
  },
})
