import { separatorOf } from '../locations/geocode-lib'
import { parseCsv } from '../team/lib'

/**
 * Reading a subscriber export from the old newsletter (Mailchimp, Squarespace or a spreadsheet)
 * into the people who may be added to the Resend list. Kept apart from the command so it can be
 * tested. Only people the file shows as subscribed are kept: anyone unsubscribed, bounced,
 * pending or unclear is left out and counted, never guessed.
 */

export type Subscriber = { email: string; firstName?: string; lastName?: string }
export type Skipped = { row: number; email: string; reason: string }

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const YES = new Set([
  'subscribed',
  'yes',
  'y',
  'true',
  '1',
  'active',
  'confirmed',
  'opted in',
  'opt-in',
  'subscriber',
])
const NO = new Set([
  'unsubscribed',
  'no',
  'n',
  'false',
  '0',
  'cleaned',
  'bounced',
  'pending',
  'inactive',
  'archived',
  'spam',
  'complained',
  'transactional',
  'non-subscribed',
  'not subscribed',
])

const norm = (h: string) => h.replace(/^﻿/, '').trim().toLowerCase().replace(/[_-]+/g, ' ')
const find = (cols: string[], names: string[]) => cols.findIndex((c) => names.includes(c))

/** A Mailchimp export names the list in the file: these files hold people who must not be added. */
export const refusedFile = (name: string) =>
  /unsubscribed|cleaned|bounced|nonsubscribed/i.test(name)

export function readSubscribers(text: string) {
  const [header = [], ...lines] = parseCsv(text, separatorOf(text)).filter((l) =>
    l.some((c) => c.trim()),
  )
  const cols = header.map(norm)
  const email =
    cols.findIndex((c) => c === 'email' || c === 'email address' || c === 'e mail') >= 0
      ? cols.findIndex((c) => c === 'email' || c === 'email address' || c === 'e mail')
      : cols.findIndex((c) => c.includes('email'))
  if (email < 0) throw new Error(`No email column. Columns found: ${header.join(' | ')}`)
  const first = find(cols, ['first name', 'firstname', 'fname', 'given name'])
  const last = find(cols, ['last name', 'lastname', 'lname', 'surname', 'family name'])
  const status = find(cols, [
    'status',
    'subscribed',
    'subscription status',
    'email marketing status',
    'subscription',
    'opt in',
    'marketing status',
  ])
  const unsub = find(cols, ['unsubscribed', 'unsubscribe', 'opted out', 'opt out'])

  const keep: Subscriber[] = []
  const skipped: Skipped[] = []
  const seen = new Set<string>()
  lines.forEach((l, i) => {
    const row = i + 2 // as a spreadsheet numbers it, after the header
    const address = (l[email] ?? '').trim().toLowerCase()
    const skip = (reason: string) => skipped.push({ row, email: address, reason })
    if (!EMAIL.test(address) || address.length > 254) return skip('not an email address')
    if (status >= 0) {
      const v = (l[status] ?? '').trim().toLowerCase()
      if (NO.has(v)) return skip(`status: ${v}`)
      if (!YES.has(v)) return skip(v ? `unclear status: ${v}` : 'no status')
    }
    if (unsub >= 0 && YES.has((l[unsub] ?? '').trim().toLowerCase())) return skip('unsubscribed')
    if (seen.has(address)) return skip('duplicate')
    seen.add(address)
    keep.push({
      email: address,
      firstName: first >= 0 ? l[first]?.trim() || undefined : undefined,
      lastName: last >= 0 ? l[last]?.trim() || undefined : undefined,
    })
  })
  return {
    keep,
    skipped,
    columns: {
      email: header[email],
      status: status >= 0 ? header[status] : undefined,
      unsubscribed: unsub >= 0 ? header[unsub] : undefined,
    },
  }
}
