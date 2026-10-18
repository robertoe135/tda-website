import { describe, expect, it } from 'vitest'

import type { ProjectCard } from '@/lib/projects'
import { otherProjects, relatedProjects } from '@/lib/related'

const card = (id: number, o: Partial<ProjectCard> = {}): ProjectCard => ({
  id,
  name: `P${id}`,
  slug: `p${id}`,
  typologies: [],
  architects: [],
  collaboratorSlugs: [],
  clientSlugs: [],
  status: 'completed',
  ...o,
})
const corporate = { name: 'Corporate', slug: 'corporate' }
const kpf = { name: 'KPF', slug: 'kpf' }

describe('related projects', () => {
  const me = card(1, { year: 2020, typologies: [corporate], architects: [kpf] })
  const all = [
    me,
    card(2, { architects: [kpf] }),
    card(3, { architects: [kpf] }),
    card(4, { typologies: [corporate] }),
    card(5, { typologies: [corporate] }),
    card(6, { year: 2020 }),
    card(7, { year: 2020, status: 'in-progress' }),
    card(8, { year: 2019 }),
  ]

  it('mixes architect, category and year, never repeats or includes the project itself', () => {
    const picks = relatedProjects(me, all)
    const ids = picks.map((p) => p.project.id)
    expect(ids).toHaveLength(4)
    expect(new Set(ids).size).toBe(4)
    expect(ids).not.toContain(1)
    expect(ids).not.toContain(8) // nothing in common
    expect(ids).not.toContain(7) // on the boards: no completion year to share
    expect(new Set(picks.map((p) => p.reason.label))).toEqual(new Set(['KPF', 'Corporate', '2020']))
  })

  it('links every reason to a filtered view or the Timeline year', () => {
    const hrefs = relatedProjects(me, all).map((p) => p.reason.href)
    for (const h of hrefs)
      expect(h).toMatch(/^\/projects\?(architect=kpf|typology=corporate)$|^\/timeline#year-2020$/)
  })

  it('gives the same set every time for one project, and puts projects with photos first', () => {
    expect(relatedProjects(me, all)).toEqual(relatedProjects(me, all))
    const withPhoto = all.map((p) => (p.id === 5 ? { ...p, image: { src: 'x', alt: '' } } : p))
    const picks = relatedProjects(me, withPhoto).filter((p) => p.reason.label === 'Corporate')
    expect(picks[0].project.id).toBe(5)
  })

  it('returns nothing for a project with nothing in common', () => {
    expect(relatedProjects(card(9), [card(9), card(10)])).toEqual([])
  })
})

describe('otherProjects', () => {
  const dsr = { name: 'DS+R', slug: 'dsr' }
  const museums = { name: 'Museums', slug: 'museums' }
  it('takes the architect first, newest first, photos before none', () => {
    const me = card(1, { architects: [dsr], typologies: [museums] })
    const all = [
      me,
      card(2, { architects: [dsr] }),
      card(3, { architects: [dsr], image: { src: 'x', alt: '' } }),
      card(4, { architects: [dsr] }),
    ]
    const o = otherProjects(me, all)!
    expect(o.by).toBe('architect')
    expect(o.total).toBe(4)
    expect(o.projects.map((p) => p.id)).toEqual([3, 2])
    expect(o.href).toContain('dsr')
  })
  it('falls back to the category when the architect has no other project', () => {
    const me = card(1, { architects: [dsr], typologies: [museums] })
    const o = otherProjects(me, [me, card(5, { typologies: [museums] })])!
    expect(o.by).toBe('typology')
    expect(o.name).toBe('Museums')
    expect(o.total).toBe(2)
  })
  it('is undefined when nothing else matches', () => {
    const me = card(1, { architects: [dsr], typologies: [museums] })
    expect(otherProjects(me, [me, card(6)])).toBeUndefined()
  })
})

describe('otherProjects, year fallback', () => {
  it('uses projects completed the same year when architect and category have none', () => {
    const me = card(1, { year: 2015, typologies: [] })
    const o = otherProjects(me, [
      me,
      card(7, { year: 2015 }),
      card(8, { year: 2015, status: 'in-progress' }),
      card(9, { year: 2014 }),
    ])!
    expect(o.by).toBe('year')
    expect(o.href).toBe('/timeline#year-2015')
    expect(o.projects.map((p) => p.id)).toEqual([7])
    expect(o.total).toBe(2)
  })
})
