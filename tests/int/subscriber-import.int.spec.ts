import { describe, expect, it } from 'vitest'

import { readSubscribers, refusedFile } from '../../scripts/newsletter/import-lib'

describe('importing the old subscriber list', () => {
  it('reads a Mailchimp export: email and names, cleaned and deduplicated', () => {
    const file = [
      'Email Address,First Name,Last Name,MEMBER_RATING,OPTIN_TIME',
      'Ana@Example.com,Ana,Ruiz,2,2021-03-01',
      'ana@example.com,Ana,Ruiz,2,2021-03-01',
      'not-an-email,,,1,',
      'bo@example.org,,,3,2022-01-01',
    ].join('\n')
    const { keep, skipped, columns } = readSubscribers(file)
    expect(columns.email).toBe('Email Address')
    expect(keep).toEqual([
      { email: 'ana@example.com', firstName: 'Ana', lastName: 'Ruiz' },
      { email: 'bo@example.org', firstName: undefined, lastName: undefined },
    ])
    expect(skipped.map((s) => [s.row, s.reason])).toEqual([
      [3, 'duplicate'],
      [4, 'not an email address'],
    ])
  })

  it('keeps only people marked subscribed, and lists the unclear ones', () => {
    const file = [
      'email\tstatus',
      'a@x.co\tsubscribed',
      'b@x.co\tunsubscribed',
      'c@x.co\tcleaned',
      'd@x.co\tpending',
      'e@x.co\tmaybe',
      'f@x.co\t',
    ].join('\n') // tab-separated, as Numbers saves it
    const { keep, skipped } = readSubscribers(file)
    expect(keep.map((k) => k.email)).toEqual(['a@x.co'])
    expect(skipped.map((s) => s.reason)).toEqual([
      'status: unsubscribed',
      'status: cleaned',
      'status: pending',
      'unclear status: maybe',
      'no status',
    ])
  })

  it('honours an "unsubscribed" yes/no column, as Squarespace and spreadsheets have', () => {
    const { keep } = readSubscribers('Email;Unsubscribed\nkeep@x.co;No\nleft@x.co;Yes\n')
    expect(keep.map((k) => k.email)).toEqual(['keep@x.co'])
  })

  it('stops when the file has no email column', () => {
    expect(() => readSubscribers('Name,Phone\nA,1\n')).toThrow(/No email column/)
  })

  it('refuses Mailchimp’s lists of people who left or bounced', () => {
    expect(refusedFile('unsubscribed_members_export_abc.csv')).toBe(true)
    expect(refusedFile('cleaned_members_export_abc.csv')).toBe(true)
    expect(refusedFile('subscribed_members_export_abc.csv')).toBe(false)
  })
})
