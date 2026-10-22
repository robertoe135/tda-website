import { describe, expect, it } from 'vitest'

import { duplicateReason, personIssues, possibleDuplicates, projectIssues } from '../../scripts/content/lib'

const words = (text: string) => ({ root: { children: [{ children: [{ text }] }] } })

describe('content check', () => {
  it('flags names that may be one project entered twice', () => {
    expect(duplicateReason('Hotel Barrier Fouquet’s', 'Hôtel Barrière Fouquet’s')).toBe('Same name, one word spelled differently')
    expect(duplicateReason('Smith College Nielson Library', 'Smith College Neilson Library')).toBe('Same name, one word spelled differently')
    expect(duplicateReason('Tiffany & Co. Landmark', 'Tiffany and Co Landmark')).toBe('Same name, written differently')
    expect(duplicateReason('Rainbow Room', 'Rainbow Room at Rockefeller Center')).toBe('One name contains the other')
  })

  it('leaves different projects alone', () => {
    expect(duplicateReason('Bronx Children’s Museum', 'The Broad Museum')).toBeUndefined()
    expect(duplicateReason('Brooklyn Public Library', 'New York Public Library')).toBeUndefined()
    expect(duplicateReason('MIT Museum', 'MoMA')).toBeUndefined()
    expect(possibleDuplicates([{ name: 'One Vanderbilt' }, { name: 'The Shed' }])).toEqual([])
  })

  it('lists what a project still needs, and photos that are on the draft only', () => {
    const draft = { id: 1, name: 'X', status: 'completed', heroImage: 5, typologies: [], description: words('') }
    expect(projectIssues(draft, { id: 1, name: 'X' }).map((i) => i.issue)).toEqual([
      'Photos not published',
      'No photographer credit',
      'No category',
      'No completion year',
      'No location',
      'No design architect',
      'No write-up',
    ])
    const done = { id: 2, name: 'Y', status: 'in-progress', announceApproved: true, heroImage: 5, photographers: [1], typologies: [1], location: 1, architects: [1], description: words('Light.') }
    expect(projectIssues(done, done)).toEqual([])
  })

  it('lists people on the team page without a headshot, title or bio', () => {
    expect(personIssues({ id: 1, name: 'A' }).map((i) => i.issue)).toEqual(['No headshot', 'No title', 'No bio'])
    expect(personIssues({ id: 1, name: 'A', title: 'Designer', headshot: 3, bio: words('Bio.') })).toEqual([])
  })
})
