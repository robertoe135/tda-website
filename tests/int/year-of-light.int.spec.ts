import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { ProjectCard } from '@/lib/projects'
import { buildStory, type Card, describeStory, getStory, getStoryYears, kelvinToHex, mostAwardedFirms, type StoryInput } from '@/lib/year-of-light'
import config from '@/payload.config'

const nyc = { displayName: 'New York, NY', slug: 'new-york-ny', worldRegion: 'north-america' as const }
const card = (id: number, extra: Partial<ProjectCard> = {}): ProjectCard => ({
  id,
  name: `Project ${id}`,
  slug: `project-${id}`,
  year: 2023,
  status: 'completed',
  location: nyc,
  typologies: [{ name: 'Performing Arts', slug: 'performing-arts' }],
  architects: [],
  collaboratorSlugs: [],
  clientSlugs: [],
  photographers: [],
  ...extra,
})
const input = (extra: Partial<StoryInput> = {}): StoryInput => ({
  edition: { year: 2023 },
  projects: [],
  awards: [],
  credited: new Map(),
  picked: [],
  years: [2023],
  ...extra,
})
const kinds = (cards: Card[]) => cards.map((c) => c.kind)
const find = <K extends Card['kind']>(cards: Card[], kind: K) => cards.find((c) => c.kind === kind) as Extract<Card, { kind: K }>

describe('the light', () => {
  it('turns colour temperatures into the colour of the light: warm amber to near white', () => {
    expect(kelvinToHex(2700)).toBe('#ffa757')
    expect(kelvinToHex(6500)).toBe('#fffefa')
  })

  it('runs from 2700 K on the first card to 6500 K on the last, however many cards there are', () => {
    const cards = buildStory(input({ projects: [card(1)] }))
    expect(kinds(cards)).toEqual(['cover', 'completed', 'where', 'closing'])
    expect(cards.map((c) => c.kelvin)).toEqual([2700, 4000, 5200, 6500])
  })
})

describe('building the story', () => {
  it('counts only completed projects of the year, links each one, and the count to the year on the Timeline', () => {
    const cards = buildStory(
      input({ projects: [card(1, { name: 'B Hall' }), card(2, { name: 'A Hall' }), card(3, { status: 'in-progress' }), card(4, { year: 2022 })] }),
    )
    const c = find(cards, 'completed')
    expect(c.count).toBe(2)
    expect(c.href).toBe('/timeline#year-2023')
    expect(c.projects).toEqual([
      { label: 'A Hall', href: '/projects/project-2' },
      { label: 'B Hall', href: '/projects/project-1' },
    ])
  })

  it('groups places as stored, never merging or renaming them, each linking to its filtered portfolio', () => {
    const fair = { displayName: 'Lightfair 2023 New York, NY', slug: 'lightfair-2023-new-york-ny', worldRegion: 'north-america' as const }
    const where = find(buildStory(input({ projects: [card(1), card(2), card(3, { location: fair }), card(4, { location: undefined })] })), 'where')
    expect(where.count).toBe(3)
    expect(where.places).toEqual([
      { label: 'New York, NY', href: '/projects?location=new-york-ny', count: 2 },
      { label: 'Lightfair 2023 New York, NY', href: '/projects?location=lightfair-2023-new-york-ny', count: 1 },
    ])
  })

  it('lists awards of published projects only, each linking to its project', () => {
    const awards = find(
      buildStory(
        input({
          projects: [card(1), card(2, { year: 2019 })],
          awards: [
            { name: 'Award of Merit', issuer: 'IES', project: 1 },
            { name: 'LIT Award Winner', project: 2 },
            { name: 'Unpublished project’s award', project: 99 },
          ],
        }),
      ),
      'awards',
    )
    expect(awards.count).toBe(2)
    expect(awards.projectCount).toBe(2)
    expect(awards.awards.map((a) => a.project.href)).toEqual(['/projects/project-1', '/projects/project-2'])
  })

  it('features the firm on the most awarded projects, architects and credited firms but never clients', () => {
    const projects = [
      card(1, { architects: [{ name: 'Studio A', slug: 'studio-a' }], collaboratorSlugs: ['eng-b'], clientSlugs: ['owner-c'] }),
      card(2, { architects: [{ name: 'Studio A', slug: 'studio-a' }], clientSlugs: ['owner-c'] }),
      card(3, { collaboratorSlugs: ['eng-b'], clientSlugs: ['owner-c'] }),
    ]
    const awards = [1, 2, 3].map((project) => ({ name: 'Award', project }))
    const credited = new Map([['eng-b', 'Engineer B']])
    const c = find(buildStory(input({ projects, awards, credited })), 'collaborators')
    expect(c.tie).toBe(true)
    expect(c.firms.map((f) => [f.label, f.href, f.projects.length])).toEqual([
      ['Engineer B', '/projects?collaborator=eng-b', 2],
      ['Studio A', '/projects?architect=studio-a', 2],
    ])
  })

  it('leaves the collaborator card out when no firm stands out, or too many tie', () => {
    const one = [card(1, { architects: [{ name: 'A', slug: 'a' }] })]
    expect(mostAwardedFirms({ projects: one, awards: [{ name: 'x', project: 1 }], credited: new Map() })).toEqual([])
    const many = [1, 2].map((id) => card(id, { architects: ['a', 'b', 'c', 'd'].map((s) => ({ name: s, slug: s })) }))
    expect(mostAwardedFirms({ projects: many, awards: [1, 2].map((project) => ({ name: 'x', project })), credited: new Map() })).toEqual([])
  })

  it('shows the firms marketing picked instead, with their projects of the year', () => {
    const projects = [card(1, { architects: [{ name: 'Picked', slug: 'picked' }] })]
    const c = find(buildStory(input({ projects, picked: [{ name: 'Picked', slug: 'picked' }] })), 'collaborators')
    expect(c.picked).toBe(true)
    expect(c.firms[0]).toMatchObject({ label: 'Picked', href: '/projects?architect=picked', projects: [{ label: 'Project 1' }] })
  })

  it('shows only the studio numbers and lines marketing wrote, and leaves out cards it hid', () => {
    const story = buildStory(
      input({
        projects: [card(1)],
        edition: { year: 2023, studio: [{ value: '48', label: 'mock-ups built' }], hiddenCards: ['where'], thanks: 'Thanks.' },
      }),
    )
    expect(kinds(story)).toEqual(['cover', 'completed', 'studio', 'closing'])
    expect(find(story, 'studio').numbers).toEqual([{ value: '48', label: 'mock-ups built' }])
    expect(find(story, 'closing').thanks).toBe('Thanks.')
    expect(buildStory(input()).map((c) => c.kind)).toEqual(['cover', 'closing'])
  })

  it('links the light of the year’s categories, place and quote author', () => {
    const light = find(
      buildStory(
        input({
          edition: { year: 2023, quote: 'Why.', quoteBy: { name: 'A Person', slug: 'a-person' } },
          light: { project: card(1), credit: ['Photographer'] },
        }),
      ),
      'light',
    )
    expect(light.details).toEqual([
      { label: 'Performing Arts', href: '/projects?typology=performing-arts' },
      { label: 'New York, NY', href: '/projects?location=new-york-ny' },
    ])
    expect(light.quoteBy).toEqual({ label: 'A Person', href: '/about/team/a-person' })
  })

  it('describes the year for search results from its numbers', () => {
    const cards = buildStory(input({ projects: [card(1)], awards: [{ name: 'x', project: 1 }] }))
    expect(describeStory(2023, cards)).toBe(
      '2023 at Tillotson Design Associates, from the first warm light to full daylight: 1 project completed, 1 award for 1 project.',
    )
  })
})

describe('Year of Light in the database', () => {
  let payload: Payload
  const year = 1997 // a year no real project uses
  const ids: { typology?: number; published?: number; draft?: number; edition?: number } = {}

  beforeAll(async () => {
    payload = await getPayload({ config })
    const prefix = `YoL test ${Date.now()}`
    ids.typology = (await payload.create({ collection: 'typologies', data: { name: prefix } })).id
    ids.published = (
      await payload.create({ collection: 'projects', data: { name: `${prefix} Hall`, year, status: 'completed', typologies: [ids.typology], _status: 'published' } })
    ).id
    ids.draft = (
      await payload.create({ collection: 'projects', draft: true, data: { name: `${prefix} Secret`, year, status: 'completed', typologies: [ids.typology], _status: 'draft' } })
    ).id
    for (const project of [ids.published, ids.draft]) await payload.create({ collection: 'awards', data: { name: `${prefix} Award`, year, project } })
    ids.edition = (await payload.create({ collection: 'years-of-light', draft: true, data: { year, intro: 'Draft line', _status: 'draft' } })).id
  })

  afterAll(async () => {
    await payload.delete({ collection: 'years-of-light', where: { year: { equals: year } }, overrideAccess: true })
    await payload.delete({ collection: 'awards', where: { year: { equals: year } }, overrideAccess: true })
    for (const id of [ids.published, ids.draft]) if (id) await payload.delete({ collection: 'projects', id, overrideAccess: true })
    if (ids.typology) await payload.delete({ collection: 'typologies', id: ids.typology, overrideAccess: true })
  })

  it('shows nothing until the year is published', async () => {
    expect(await getStory(year)).toBeUndefined()
    expect(await getStoryYears()).not.toContain(year)
  })

  it('once published, counts only what the public can see, and is titled for the admin list', async () => {
    const doc = await payload.update({ collection: 'years-of-light', id: ids.edition!, data: { _status: 'published' } })
    expect(doc.title).toBe(`Year of Light ${year}`)
    const story = await getStory(year)
    expect(story).toBeDefined()
    expect(find(story!.cards, 'cover').intro).toBe('Draft line')
    expect(find(story!.cards, 'completed').count).toBe(1)
    expect(find(story!.cards, 'awards').count).toBe(1) // the draft project's award stays hidden
    expect(await getStoryYears()).toContain(year)
  })

  it('refuses a second record for the same year', async () => {
    await expect(payload.create({ collection: 'years-of-light', data: { year, _status: 'published' } })).rejects.toThrow()
  })
})
