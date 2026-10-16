import { describe, expect, it } from 'vitest'

import { parseCsv, parseProjectRef, parseRole, planTeams, sortTeam } from '../../scripts/team/lib'

describe('team CSV', () => {
  it('reads quoted fields, doubled quotes, CRLF and an Excel byte-order mark', () => {
    expect(parseCsv('﻿a,b\r\n"x, y","say ""hi"""\r\n\r\n')).toEqual([
      ['a', 'b'],
      ['x, y', 'say "hi"'],
    ])
  })

  it('recognizes roles by label or abbreviation, nothing else', () => {
    expect(parseRole(' Principal in  Charge ')).toBe('principal')
    expect(parseRole('PM')).toBe('project-manager')
    expect(parseRole('designers')).toBeUndefined()
  })

  it('accepts a slug, a new-site address or an old address', () => {
    expect(parseProjectRef('enoch-pratt-free-library')).toEqual({ slug: 'enoch-pratt-free-library' })
    expect(parseProjectRef('https://tillotsondesign.com/projects/enoch-pratt/')).toEqual({ slug: 'enoch-pratt' })
    expect(parseProjectRef('https://www.tillotsondesign.com/Libraries/Enoch-Pratt')).toEqual({
      legacyPath: '/libraries/enoch-pratt',
    })
    expect(parseProjectRef('Enoch Pratt')).toBeUndefined()
  })

  it('groups by project, drops repeats, and reports every bad row with its line', () => {
    const { teams, problems } = planTeams(
      parseCsv(
        [
          'Project,Person,Role,Former staff,Note',
          'p-one,[Person A],Designer,,',
          'p-one,[Person B],PIC,yes,',
          'p-one,[person a],designer,,repeat',
          'p-two,,Designer,,',
          'p-two,[Person C],Lighting,,',
        ].join('\n'),
      ),
    )
    const one = teams.get('slug:p-one')!
    expect(sortTeam(one).map((c) => [c.person, c.role, c.former])).toEqual([
      ['[Person B]', 'principal', true],
      ['[Person A]', 'designer', false],
    ])
    expect(problems.map((p) => p.line)).toEqual([5, 6])
  })

  it('refuses a file without the required columns', () => {
    expect(planTeams(parseCsv('project,name\nx,y')).problems[0].message).toMatch(/"person"/)
  })
})
