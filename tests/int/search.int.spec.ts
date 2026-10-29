import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { getSearchIndex, normalize, type SearchDoc, searchProjects, searchShortcuts } from '@/lib/search'
import config from '@/payload.config'

const doc = (id: number, name: string, year: number, facts: [string, string, number, string?][]): SearchDoc => ({
  id,
  name,
  slug: `p-${id}`,
  year,
  status: 'completed',
  facts: facts.map(([label, value, weight, href]) => ({ label, value, weight, href })),
})
const docs = [
  doc(1, 'One Vanderbilt', 2020, [
    ['Location', 'New York, NY', 6, '/projects?location=new-york-ny'],
    ['Design architect', 'Kohn Pedersen Fox', 6, '/projects?architect=kpf'],
    ['Structural Engineer', 'Severud Associates', 3, '/projects?collaborator=severud'],
  ]),
  doc(2, 'Vanderbilt Hall', 2015, [['Location', 'New Haven, CT', 6]]),
  doc(3, 'Museo Soumaya', 2011, [
    ['Location', 'Mexico City', 6],
    ['Design architect', 'FR-EE Fernando Romero', 6, '/projects?architect=fr-ee'],
    ['Structural Engineer', 'Ove Arup & Partners', 3, '/projects?collaborator=arup'],
  ]),
]
const names = (q: string) => searchProjects(docs, q).map((r) => r.doc.name)

describe('search', () => {
  it('reads names alike whatever the accents, case and punctuation', () => {
    expect(normalize('Höweler + Yoon / Studio')).toBe('howeler and yoon studio')
  })

  it('finds a building by name, best match first', () => {
    expect(names('vanderbilt')).toEqual(['One Vanderbilt', 'Vanderbilt Hall'])
    expect(names('one vanderbilt')).toEqual(['One Vanderbilt'])
  })

  it('finds projects by any credit, in part of a word too, and says where it matched', () => {
    expect(names('severud')).toEqual(['One Vanderbilt'])
    expect(names('arup')).toEqual(['Museo Soumaya'])
    const [hit] = searchProjects(docs, 'sever')
    expect(hit.matched.map((f) => `${f.label}: ${f.value}`)).toEqual(['Structural Engineer: Severud Associates'])
  })

  it('finds a year exactly, and needs every word to match', () => {
    expect(names('2011')).toEqual(['Museo Soumaya'])
    expect(names('201')).toEqual([]) // a number is not matched in part
    expect(names('vanderbilt 2015')).toEqual(['Vanderbilt Hall'])
    expect(names('vanderbilt mexico')).toEqual([])
    expect(names('the')).toEqual([]) // too common to search on
  })

  it('offers firms and places whose name is searched, to open their projects', () => {
    expect(searchShortcuts(docs, 'kohn pedersen')).toEqual([{ label: 'Kohn Pedersen Fox', kind: 'Firm', href: '/projects?architect=kpf' }])
    expect(searchShortcuts(docs, 'new york')).toEqual([{ label: 'New York, NY', kind: 'Location', href: '/projects?location=new-york-ny' }])
  })

  describe('in the database', () => {
    let payload: Payload
    const tag = `zs${Date.now().toString(36)}`

    beforeAll(async () => {
      payload = await getPayload({ config })
      const typology = (await payload.create({ collection: 'typologies', data: { name: `${tag} Typology` } })).id
      const owner = (await payload.create({ collection: 'clients', data: { name: `Secretowner ${tag}` } })).id
      const role = (await payload.create({ collection: 'creditRoles', data: { name: `${tag} Acoustics` } })).id
      const acoustician = (await payload.create({ collection: 'firms', data: { name: `Quietroom ${tag}` } })).id
      await payload.create({
        collection: 'projects',
        data: {
          name: `${tag} Residence`,
          status: 'completed',
          typologies: [typology],
          clients: [owner],
          confidential: true,
          credits: [{ role, firms: [acoustician] }],
          aliases: [{ name: `Codename${tag}` }],
          projectNumber: `${tag}-77`,
          _status: 'published',
        },
      })
      await payload.create({
        collection: 'projects',
        data: { name: `${tag} Public Hall`, status: 'completed', typologies: [typology], clients: [owner], confidential: false, _status: 'published' },
      })
      await payload.create({ collection: 'projects', draft: true, data: { name: `${tag} Unpublished`, status: 'completed', typologies: [typology], _status: 'draft' } })
    })

    afterAll(async () => {
      await payload.delete({ collection: 'projects', where: { name: { like: tag } } })
      await payload.delete({ collection: 'firms', where: { name: { like: tag } } })
      await payload.delete({ collection: 'clients', where: { name: { like: tag } } })
      await payload.delete({ collection: 'creditRoles', where: { name: { like: tag } } })
      await payload.delete({ collection: 'typologies', where: { name: { like: tag } } })
    })

    it('searches credits, but never an owner, internal names, project numbers or unpublished work', async () => {
      const index = await getSearchIndex()
      const hits = (q: string) => searchProjects(index, q).map((r) => r.doc.name)
      expect(hits(`quietroom ${tag}`)).toEqual([`${tag} Residence`])
      // Clients are not searchable, even on a project that is not confidential.
      expect(hits(`secretowner ${tag}`)).toEqual([])
      expect(hits(`codename${tag}`)).toEqual([])
      expect(hits(`${tag}-77`)).toEqual([])
      expect(hits(`${tag} unpublished`)).toEqual([])
    })
  })
})
