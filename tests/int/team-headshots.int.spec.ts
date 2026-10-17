import { describe, expect, it } from 'vitest'

import { matchHeadshots } from '../../scripts/team/headshots-lib'

const people = [
  { id: 1, name: 'Suzan A. Tillotson' },
  { id: 2, name: 'Jane Smith' },
  { id: 3, name: 'John Smith' },
  { id: 4, name: 'Maria José Núñez' },
  { id: 5, name: 'Kevin Lee' },
  { id: 6, name: 'Scott Baillie-Hinojosa' },
]

describe('matching headshot files to people', () => {
  it('finds first and last name in the file or folder, either order, accents ignored', () => {
    const { matches } = matchHeadshots(
      ['Suzan Tillotson.jpg', 'Team/Smith_Jane_final.JPG', 'Maria Nunez/IMG_0042.jpg', 'Lee, Kevin (2).png'],
      people,
    )
    expect(matches.map((m) => [m.file, m.person.id, m.by])).toEqual([
      ['Suzan Tillotson.jpg', 1, 'name'],
      ['Team/Smith_Jane_final.JPG', 2, 'name'],
      ['Maria Nunez/IMG_0042.jpg', 4, 'name'],
      ['Lee, Kevin (2).png', 5, 'name'],
    ])
  })

  it('accepts either part of a double surname', () => {
    expect(matchHeadshots(['Scott Baillie.jpg', 'Hinojosa Scott.jpg'], people).matches.map((m) => m.person.id)).toEqual([6, 6])
  })

  it('uses initials only when one person has them', () => {
    const { matches, unmatched } = matchHeadshots(['TDA_ST.jpg', 'KL.jpg', 'JS.jpg'], people)
    expect(matches.map((m) => [m.file, m.person.id, m.by])).toEqual([
      ['TDA_ST.jpg', 1, 'initials'],
      ['KL.jpg', 5, 'initials'],
    ])
    expect(unmatched).toEqual(['JS.jpg']) // Jane or John Smith
  })

  it('leaves out a file that names no one', () => {
    expect(matchHeadshots(['Office party.jpg', 'Smith.jpg'], people).unmatched).toEqual(['Office party.jpg', 'Smith.jpg'])
  })
})
