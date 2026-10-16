import { describe, expect, it } from 'vitest'

import { filterHref, matches, parseFilters, type ProjectCard, setHref, toggleHref } from '@/lib/projects'

const project: ProjectCard = {
  id: 1,
  name: 'One Vanderbilt',
  slug: 'one-vanderbilt',
  year: 2021,
  status: 'completed',
  featured: true,
  location: { displayName: 'New York, NY', slug: 'new-york-ny', worldRegion: 'north-america' },
  typologies: [{ name: 'Corporate', slug: 'corporate' }],
  architects: [{ name: 'Kohn Pedersen Fox', slug: 'kohn-pedersen-fox' }],
  collaboratorSlugs: ['severud-associates'],
  clientSlugs: ['sl-green-realty-corporation'],
}

describe('project filters', () => {
  it('reads repeated and comma-separated values', () => {
    const f = parseFilters({ typology: ['museums', 'libraries,academic'], status: 'featured' })
    expect(f.typology).toEqual(['museums', 'libraries', 'academic'])
    expect(f.status).toEqual(['featured'])
    expect(f.region).toEqual([])
  })

  it('treats values in one group as "any" and groups as "all"', () => {
    expect(matches(project, parseFilters({ typology: ['museums', 'corporate'] }))).toBe(true)
    expect(matches(project, parseFilters({ typology: 'corporate', region: 'europe' }))).toBe(false)
    expect(matches(project, parseFilters({ status: 'featured', region: 'north-america' }))).toBe(true)
    expect(matches(project, parseFilters({ status: 'in-progress' }))).toBe(false)
  })

  it('filters by the link-only keys used on project pages', () => {
    expect(matches(project, parseFilters({ collaborator: 'severud-associates' }))).toBe(true)
    expect(matches(project, parseFilters({ client: 'sl-green-realty-corporation' }))).toBe(true)
    expect(matches(project, parseFilters({ location: 'london-uk' }))).toBe(false)
  })

  it('builds links that add and remove one value', () => {
    const f = parseFilters({ typology: 'museums', region: 'europe' })
    expect(toggleHref(f, 'typology', 'libraries')).toBe('/projects?typology=museums&typology=libraries&region=europe')
    expect(toggleHref(f, 'typology', 'museums')).toBe('/projects?region=europe')
    expect(toggleHref(parseFilters({ region: 'europe' }), 'region', 'europe')).toBe('/projects')
    expect(filterHref('architect', 'kohn-pedersen-fox')).toBe('/projects?architect=kohn-pedersen-fox')
  })
})

describe('category links', () => {
  it('replace the category and keep every other filter', () => {
    const f = parseFilters({ typology: ['museums', 'libraries'], region: 'europe', status: 'in-progress' })
    expect(setHref(f, { typology: ['retail'], status: [] })).toBe('/projects?typology=retail&region=europe')
    expect(setHref(f, { typology: [], status: [] })).toBe('/projects?region=europe')
    expect(setHref(parseFilters({}), {})).toBe('/projects')
  })
})
