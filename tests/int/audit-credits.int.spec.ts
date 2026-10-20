import { describe, expect, it } from 'vitest'

import { compareAwards, compareProject } from '../../scripts/migrate/audit-credits'
import { roleFor } from '../../scripts/migrate/credit-labels'
import type { ProjectRecord } from '../../scripts/migrate/extract'
import { sameFirm } from '../../scripts/migrate/restore-credits'
import type { Project } from '@/payload-types'

describe('telling two spellings of one firm from two firms', () => {
  it.each([
    ['REX', 'REX Architecture'],
    ['Foster + Partner', 'Foster + Partners'],
    ['Pelli Clark Pelli', 'Pelli Clarke Pelli'],
    ['CallisonRTKL - CRTKL', 'CallisonRTKL'],
    ['Leslie E. Robertson Associates (LERA)', 'Leslie E. Robertson Associates'],
    ['SANAA', 'Kazuyo Sejima + Ryue Nishizawa / SANAA'],
    ['Weiss/ Manfredi', 'Weiss/Manfredi'],
  ])('%s is %s', (a, b) => expect(sameFirm(a, b)).toBe(true))

  it.each([
    ['OMA', 'Thornton Tomasetti'],
    ['Gensler', 'Gensler/WKSHPS'],
    ['AMA Consulting Engineers', 'GACE Consulting Engineers'],
    ['Field Operations', 'Field Operations with Coen + Partners'],
  ])('%s is not %s', (a, b) => expect(sameFirm(a, b)).toBe(false))
})

const entry = (label: string, value: string) => ({ label, role: roleFor(label), value, values: value.split('|').map((v) => v.trim()) })
const firm = (id: number, name: string, aliases: string[] = []) => ({ id, name, aliases: aliases.map((a) => ({ name: a })) })
const record = (entries: ReturnType<typeof entry>[], extra: Partial<ProjectRecord['credits']> = {}) =>
  ({
    name: 'Hall',
    legacyPaths: ['/hall'],
    labelFirms: ['OMA'],
    location: { asWritten: 'New York, NY', city: 'New York', region: 'NY', country: 'United States' },
    credits: { name: 'Hall', awards: [{ year: 2020, text: 'Award' }], photography: ['Iwan Baan, Brett Beyer'], completed: '2019', area: '12,000 SF', sustainabilityStatus: 'LEED Gold', owner: 'City of New York', entries, ...extra },
  }) as unknown as ProjectRecord
const project = (extra: Partial<Project> = {}) =>
  ({
    name: 'Hall',
    year: 2019,
    areaSqFt: 12000,
    location: { displayName: 'New York, NY' },
    certifications: [{ system: 'leed', level: 'gold' }],
    clients: [firm(9, 'City of New York')],
    architects: [firm(1, 'OMA - Office for Metropolitan Architecture', ['OMA'])],
    credits: [{ role: 1, firms: [firm(2, 'Thornton Tomasetti')] }],
    photographers: [{ id: 5, name: 'Iwan Baan' }, { id: 6, name: 'Brett Beyer' }],
    ...extra,
  }) as unknown as Project

describe('checking a project against its old page', () => {
  it('finds nothing when every credit and fact matches', () => {
    expect(compareProject(record([entry('Structural Engineer', 'Thornton Tomasetti')]), project(), 'live')).toEqual([])
  })

  it('reports each missing firm, photographer and fact, for the version checked', () => {
    const rows = compareProject(
      record([entry('Structural Engineer', 'Thornton Tomasetti'), entry('Signage/Wayfinding', 'Gensler/WKSHPS'), entry('Millwork', 'MILLERBLAKER')]),
      project({ photographers: [{ id: 5, name: 'Iwan Baan' }] as never, year: 2018, clients: [] }),
      'live',
    )
    expect(rows.map((r) => [r.version, r.field, r.oldSite])).toEqual([
      ['live', 'firm (Signage/Wayfinding)', 'Gensler | WKSHPS'],
      ['live', 'firm (Millwork)', 'MILLERBLAKER'],
      ['live', 'photographer', 'Brett Beyer'],
      ['live', 'owner', 'City of New York'],
      ['live', 'year', '2019'],
    ])
  })

  it('flags a firm record holding a certification or several firms', () => {
    const rows = compareProject(record([]), project({ credits: [{ role: 1, firms: [firm(3, 'LEED Gold / WELL Certified'), firm(4, 'A Associates / B Engineers')] }] as never }), 'draft')
    expect(rows.map((r) => r.note)).toEqual([
      'A certification stored as a firm credit; enter it under LEED/WELL and remove the credit.',
      'May name several firms in one record; if so, split it into one record per firm.',
    ])
  })

  it('compares awards by count and year', () => {
    expect(compareAwards(record([]), 'Hall', [{ name: 'Award', year: 2020 }])).toEqual([])
    expect(compareAwards(record([]), 'Hall', [])[0].note).toBe('Different awards.')
  })
})
