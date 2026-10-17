import { describe, expect, it } from 'vitest'

import { folderPlace, possibleProjects } from '../../scripts/media/why-lib'

const reason = (path: string, web = 1, other = 0) => {
  const place = folderPlace(path.split('/'), web, other)
  return place.kind === 'importable' ? 'importable' : place.reason
}

describe('why a photo folder did not reach the site', () => {
  it('names what stops each folder', () => {
    expect(reason('Photos/Corporate/1. Comcast Technology Center')).toBe('importable')
    expect(reason('Archive/Bloomberg London')).toBe('Outside Photos (in Archive)')
    expect(reason('Photos/Academic/2. Vagelos/Web')).toBe('In a subfolder of a project folder')
    expect(reason('Photos/Corporate/One Vanderbilt NO RIGHTS')).toBe('Marked NO RIGHTS')
    expect(reason('Photos/Lifestyle Photos/Oxman')).toBe('Category "Lifestyle Photos" is not a portfolio category')
    expect(reason('Photos/Museums/!temp MoMA')).toBe('Marked removed, unused or temporary')
    expect(reason('Photos/Corporate/Comcast', 0, 3)).toBe('Only HEIC, PSD or RAW files')
    expect(reason('Projects to Add/0 - Archive/Holt Renfrew')).toBe('In Projects to Add')
  })

  it('suggests projects for a short folder name only when the word is distinctive', () => {
    const projects = [{ name: 'Bloomberg European Headquarters' }, { name: 'London Mithraeum' }, { name: 'MIT Museum' }, { name: 'Museum of Modern Art' }]
    expect(possibleProjects('Bloomberg London', projects).map((p) => p.name)).toEqual(['Bloomberg European Headquarters', 'London Mithraeum'])
    expect(possibleProjects('Museum', projects)).toEqual([]) // too common to point anywhere
  })
})

describe('portfolio categories on the drive', () => {
  it('accepts a singular category name, word by word', () => {
    expect(reason('Photos/Place of Worship/1. Christ Church')).toBe('importable')
    expect(reason('Photos/Museum/2. MIT Museum')).toBe('importable')
    expect(reason('Photos/Site - Public Realm/3. East River')).toBe('importable')
  })
})
