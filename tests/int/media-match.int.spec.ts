import { describe, expect, it } from 'vitest'

import { guessProject, matchText } from '../../scripts/media/lib'

const projects = [
  'New York University John A. Paulson Center',
  'NYC Vietnam Veterans Memorial',
  'U.S. Olympic & Paralympic Museum',
  'Rice University Music & Performing Arts Center',
  'Hôtel Barrière Fouquet’s',
  'Seattle Central Library',
  'Museum of Modern Art (MoMA) Public Spaces',
].map((name) => ({ slug: name, name }))

describe('folder names marketing writes', () => {
  it('reads accents and abbreviations as the full words', () => {
    expect(matchText('Hôtel Barrière')).toBe('hotel barriere')
    expect(matchText('NYU Paulson')).toBe('new york university paulson')
    expect(matchText('U.S. Olympic')).toBe('united states olympic')
    expect(matchText('Music & PAC')).toBe('music and performing arts center')
  })

  it.each([
    ['NYU John A. Paulson Center', 'New York University John A. Paulson Center'],
    ['New York City Vietnam Veterans Memorial', 'NYC Vietnam Veterans Memorial'],
    ['United States Olympic & Paralympic Museum', 'U.S. Olympic & Paralympic Museum'],
    ['Rice University Music & PAC', 'Rice University Music & Performing Arts Center'],
    ['Hotel Barriere Le Fouquets', 'Hôtel Barrière Fouquet’s'],
  ])('%s → %s, accepted', (folder, project) => {
    const guess = guessProject(folder, '', projects)
    expect(guess?.candidate.name).toBe(project)
    expect(guess?.accepted).toBe(true)
  })
})

describe('one project entered twice', () => {
  it('takes the closer of two near-identical names and says so', () => {
    const twins = [
      { slug: 'barrier', name: 'Hotel Barrier Fouquet’s' },
      { slug: 'barriere', name: 'Hôtel Barrière Fouquet’s' },
      { slug: 'other', name: 'Seattle Central Library' },
    ]
    const guess = guessProject('Hotel Barriere Le Fouquets', 'Restaurants', twins)
    expect(guess).toMatchObject({ accepted: true, twin: true, candidate: { slug: 'barriere' } })
  })
})
