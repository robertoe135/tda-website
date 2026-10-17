import { describe, expect, it } from 'vitest'

import { matchesFromList, matchHeadshots } from '../../scripts/team/headshots-lib'

// The team page and the file names from TDA's headshot folder (October 2026).
const names = [
  'Suzan Tillotson', 'Megan Trimarchi', 'Scott Baillie-Hinojosa', 'Shan Jiang', 'Noor Traboulsi', 'Gabriela Grullon',
  'Chandni Azeez', 'Eduardo Zepeda', 'Ashley Lam', 'Trinetra Manickavasagam', 'Seoyeon Park', 'Yeon Soo Cha',
  'Maria Gutierrez', 'Carlos Edeza', 'Maria Mendes', 'Hyun Hwangbo', 'Marissa Dallaris', 'Roberto Esquenazi-Alkabes',
  'Nataly Andonie', 'Kai-Di Peng', 'Michael Castelli', 'Robert Tillotson', 'Amanda Adams',
]
const people = names.map((name, i) => ({ id: i + 1, name }))
const files = [
  'ST 1 V2 No BG.png', 'MT 1 FS.jpg', 'SBH No BG.png', 'TDA_Shan0157-C.jpg', 'TDA_NoorDSC01382-C.jpg', 'TDA_Gaby0823-C.jpg',
  'TDA_Chandni0075-C.jpg', 'TDA_Eduardo 0066-C.jpg', 'TDA_AshleyDSC01313-C.jpg', 'TDA_Trinetra0321-C(1).jpg', 'Jen Park - 1 FS.jpg',
  'TDA_Yeon0213-C.jpg', 'TDA_MariaDSC01499-C.jpg', 'DIGITAL 01_CE.jpg', 'MariaMendes 1 (1).png', 'Hyun Hwangbo1_Temporary_LS copy.jpg',
  'MD 1 FS.jpg', 'REA - FS.jpg', 'NA- no BG.png', 'MC no BG.jpg', 'TDA_Robert0343-C.jpg',
]
const who = (file: string) => matchHeadshots([file], people).matches[0]?.person.name

describe('the real headshot folder', () => {
  it('matches most files on its own, by name, first name or initials', () => {
    expect(who('Hyun Hwangbo1_Temporary_LS copy.jpg')).toBe('Hyun Hwangbo')
    expect(who('TDA_Shan0157-C.jpg')).toBe('Shan Jiang')
    expect(who('TDA_NoorDSC01382-C.jpg')).toBe('Noor Traboulsi')
    expect(who('ST 1 V2 No BG.png')).toBe('Suzan Tillotson')
    expect(who('SBH No BG.png')).toBe('Scott Baillie-Hinojosa')
    expect(who('REA - FS.jpg')).toBe('Roberto Esquenazi-Alkabes')
    expect(who('DIGITAL 01_CE.jpg')).toBe('Carlos Edeza')
    expect(who('TDA_Robert0343-C.jpg')).toBe('Robert Tillotson')
    expect(who('MariaMendes 1 (1).png')).toBe('Maria Mendes')
  })

  it('leaves nicknames and shared first names to a person', () => {
    expect(who('TDA_Gaby0823-C.jpg')).toBeUndefined() // Gabriela
    expect(who('Jen Park - 1 FS.jpg')).toBeUndefined() // Seoyeon
    expect(who('TDA_MariaDSC01499-C.jpg')).toBeUndefined() // two Marias
  })

  it('takes a filled-in list, and refuses a file given to two people', () => {
    const rows = [
      { person: 'Seoyeon Park', file: 'Jen Park - 1 FS.jpg' },
      { person: 'Yeon Soo Cha', file: 'TDA_Yeon0213-C.jpg' },
      { person: 'Kai-Di Peng', file: 'TDA_Yeon0213-C.jpg' },
      { person: 'Amanda Adams', file: '' },
      { person: 'Nobody Here', file: 'MC no BG.jpg' },
    ]
    const { matches, problems } = matchesFromList(rows, people, files)
    expect(matches.map((m) => [m.person.name, m.file])).toEqual([['Seoyeon Park', 'Jen Park - 1 FS.jpg']])
    expect(problems).toEqual([
      'Yeon Soo Cha: TDA_Yeon0213-C.jpg is listed for more than one person',
      'Kai-Di Peng: TDA_Yeon0213-C.jpg is listed for more than one person',
      'Nobody Here: not in the admin (check the spelling)',
    ])
  })

  it('matches every file in the folder with the full list', () => {
    const rows = files.map((file) => ({ file, person: '' }))
    expect(matchesFromList(rows, people, files).matches).toEqual([])
    const auto = matchHeadshots(files, people)
    expect(auto.matches.length).toBeGreaterThanOrEqual(15)
  })
})
