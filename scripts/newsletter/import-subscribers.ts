/**
 * Adds the old newsletter's subscribers to the Resend list. Read-only unless --write:
 *
 *   pnpm newsletter:import ~/Downloads/subscribers.csv           # check the list, change nothing
 *   pnpm newsletter:import ~/Downloads/subscribers.csv --write   # add them to Resend
 *
 * Reads a CSV or tab/semicolon file with an email column (Mailchimp, Squarespace, a spreadsheet).
 * Keeps only people the file shows as subscribed; skips unsubscribed, bounced, pending, unclear
 * and duplicate rows and lists why. Someone who is already a Resend contact and unsubscribed
 * stays unsubscribed. Also writes the cleaned list to scripts/newsletter/out/ (not committed),
 * which can be uploaded in Resend instead (Contacts → Import).
 *
 * Needs RESEND_API_KEY and RESEND_SEGMENT_ID (in .env.local, never committed). The file holds
 * people's addresses: keep it out of the repository and delete it when done.
 */
import '../env'

import { mkdir, readFile, writeFile } from 'fs/promises'
import path from 'path'

import { csv } from '../migrate/lib'

import { addSubscriber, newsletterConfig } from '../../src/lib/resend'
import { readSubscribers, refusedFile } from './import-lib'

const OUT = path.join(
  path.dirname(new URL(import.meta.url).pathname),
  'out',
  'subscribers-clean.csv',
)

async function main() {
  const args = process.argv.slice(2)
  const file = args.find((a) => !a.startsWith('--'))
  const write = args.includes('--write')
  if (!file) {
    console.error('Give the export file: pnpm newsletter:import <file.csv> [--write]')
    process.exit(1)
  }
  if (refusedFile(path.basename(file))) {
    console.error(
      `${path.basename(file)} looks like a list of people who left or bounced. Use the subscribed export.`,
    )
    process.exit(1)
  }
  const { keep, skipped, columns } = readSubscribers(await readFile(file, 'utf8'))
  console.log(
    `Email column: "${columns.email}"${columns.status ? `, status column: "${columns.status}"` : ', no status column (every valid address counts as subscribed)'}${columns.unsubscribed ? `, unsubscribed column: "${columns.unsubscribed}"` : ''}`,
  )
  const reasons = new Map<string, number>()
  for (const s of skipped) reasons.set(s.reason, (reasons.get(s.reason) ?? 0) + 1)
  for (const [reason, n] of reasons) console.log(`skip  ${String(n).padStart(4)}  ${reason}`)
  for (const s of skipped.filter((s) => s.reason.startsWith('unclear')).slice(0, 10))
    console.log(`      row ${s.row}: ${s.reason}`)

  await mkdir(path.dirname(OUT), { recursive: true })
  await writeFile(
    OUT,
    csv(
      keep.map((k) => ({ email: k.email, first_name: k.firstName, last_name: k.lastName })),
      ['email', 'first_name', 'last_name'],
    ),
  )
  console.log(
    `\n${keep.length} subscribers to add. Cleaned list: ${path.relative(process.cwd(), OUT)}`,
  )

  if (!write) {
    console.log('Nothing sent to Resend. Rerun with --write to add them.')
    process.exit(0)
  }
  const { apiKey, segmentId } = newsletterConfig()
  if (!apiKey || !segmentId) {
    console.error('Set RESEND_API_KEY and RESEND_SEGMENT_ID in .env.local first.')
    process.exit(1)
  }
  let created = 0
  let existing = 0
  const failed: string[] = []
  for (const [i, s] of keep.entries()) {
    if (i > 0) await new Promise((r) => setTimeout(r, 600)) // Resend allows a few requests a second
    try {
      const r = await addSubscriber(s, { segmentId, resubscribe: false })
      if (r.created) created++
      else existing++
    } catch (e) {
      failed.push(`${s.email}: ${(e as Error).message}`)
    }
    if ((i + 1) % 50 === 0) console.log(`  ${i + 1} of ${keep.length}…`)
  }
  for (const f of failed) console.log(`failed  ${f}`)
  console.log(
    `\nAdded ${created} new, ${existing} already in Resend (left as they were)${failed.length ? `, ${failed.length} failed (above)` : ''}.`,
  )
  process.exit(failed.length ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
