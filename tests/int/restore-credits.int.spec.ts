import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { roleFor } from '../../scripts/migrate/credit-labels'
import type { ProjectRecord } from '../../scripts/migrate/extract'
import { looksJoined, planFirmCredits } from '../../scripts/migrate/import'
import { restoreCredits } from '../../scripts/migrate/restore-credits'
import config from '@/payload.config'
import type { Project } from '@/payload-types'

const entry = (label: string, value: string) => ({ label, role: roleFor(label), value, values: value.split('|').map((v) => v.trim()) })

describe('planning a project’s firm credits from the old pages', () => {
  it('reads the labels that used to be dropped', () => {
    for (const label of ['Vertical Transportation', 'Millwork', 'MEP Engineers', 'Theater', 'Signage/Wayfinding', 'Exhibit Lighting Design']) expect(roleFor(label)).toBe('consultant')
    expect(roleFor('Client Representative')).toBe('ownerRepresentative')
    expect(roleFor('Director, Real Estate Expansion, MoMA')).toBe('unmapped') // a person, for review
  })

  it('keeps an architect the credits page names and the label line leaves out, as a credit', () => {
    const plan = planFirmCredits({
      labelFirms: ['Foster + Partners'],
      credits: { name: 'X', awards: [], photography: [], entries: [entry('Design Architect', 'Foster + Partners'), entry('Collaborating Architect', 'Kendall Heaton'), entry('Structural Engineer', 'Thornton Tomasetti'), entry('Lighting Design', 'Tillotson Design Associates')] },
    } as Pick<ProjectRecord, 'labelFirms' | 'credits'>)
    expect(plan.architects).toEqual(['Foster + Partners'])
    expect(plan.credits.map((c) => [c.roleName, c.values])).toEqual([
      ['Design Architect', ['Foster + Partners']], // dropped later as a repeat of the architect
      ['Collaborating Architect', ['Kendall Heaton']],
      ['Structural Engineer', ['Thornton Tomasetti']],
    ])
  })

  it('takes the architects from the credits page when there is no label line', () => {
    const plan = planFirmCredits({ labelFirms: [], credits: { name: 'X', awards: [], photography: [], entries: [entry('Design Architect', 'A | B')] } } as Pick<ProjectRecord, 'labelFirms' | 'credits'>)
    expect(plan.architects).toEqual(['A', 'B'])
    expect(plan.credits).toEqual([])
  })

  it('spots several firms written in one line', () => {
    expect(looksJoined('Gensler/WKSHPS')).toBe(true)
    expect(looksJoined('Diller Scofidio + Renfro / FX Collaborative')).toBe(true)
    expect(looksJoined('Thornton Tomasetti')).toBe(false)
  })
})

describe('restoring lost credits', () => {
  let payload: Payload
  const prefix = `zz${Date.now().toString(36)}`
  const path = `/${prefix}/project`
  let projectId: number
  const firm: Record<string, number> = {}
  // Unlike names: names that share most letters are taken for one firm spelled two ways.
  const firmName: Record<string, string> = {
    'Label Architect': `Harbourside Atelier ${prefix}`,
    'Lost Architect': `Quintessa Bureau ${prefix}`,
    'Removed Engineer': `Volta Structures ${prefix}`,
    'Kept Engineer': `Meridian Engineering ${prefix}`,
  }

  beforeAll(async () => {
    payload = await getPayload({ config })
    for (const name of ['Label Architect', 'Lost Architect', 'Removed Engineer', 'Kept Engineer'])
      firm[name] = (await payload.create({ collection: 'firms', data: { name: firmName[name] } })).id
    const typology = (await payload.create({ collection: 'typologies', data: { name: `${prefix} Typology` } })).id
    const role = (await payload.create({ collection: 'creditRoles', data: { name: `${prefix} Engineer` } })).id
    // Published with the architect and both engineers; a person then took one engineer off, and
    // an unpublished draft has other edits.
    projectId = (
      await payload.create({
        collection: 'projects',
        data: {
          name: `${prefix} Project`, status: 'completed', typologies: [typology], summary: 'Live text.', legacyUrls: [{ path }],
          architects: [firm['Label Architect']],
          credits: [{ role, firms: [firm['Kept Engineer'], firm['Removed Engineer']] }],
          _status: 'published',
        },
      })
    ).id
    await payload.update({ collection: 'projects', id: projectId, data: { credits: [{ role, firms: [firm['Kept Engineer']] }] }, draft: false })
    await payload.update({ collection: 'projects', id: projectId, draft: true, data: { summary: 'Unpublished edit.' } })
  })

  afterAll(async () => {
    await payload.delete({ collection: 'projects', where: { name: { like: prefix } } })
    await payload.delete({ collection: 'firms', where: { name: { like: prefix } } })
    await payload.delete({ collection: 'creditRoles', where: { name: { like: prefix } } })
    await payload.delete({ collection: 'typologies', where: { name: { like: prefix } } })
  })

  const record = {
    key: prefix,
    name: 'Project',
    legacyPaths: [path],
    labelFirms: [firmName['Label Architect'], firmName['Lost Architect']],
    credits: {
      name: 'Project',
      awards: [],
      photography: [],
      entries: [
        entry('Structural Engineer', firmName['Kept Engineer']),
        entry('Structural Engineer', firmName['Removed Engineer']),
        entry('Millwork', `Oakhaven Joinery ${prefix}`),
        entry('Signage/Wayfinding', `Studio/Other Studio ${prefix}`),
        entry('Design Architect', `Harbourside Ateleir ${prefix}`), // another spelling of one already there
      ],
    },
  } as unknown as ProjectRecord

  it('lists what is missing without changing anything', async () => {
    const { rows, skipped } = await restoreCredits(payload, [record], [], false)
    expect(rows.map((r) => [r.role, r.firm, r.where])).toEqual([
      ['Architect', firmName['Lost Architect'], 'live site'],
      ['Millwork', `Oakhaven Joinery ${prefix}`, 'live site'],
      ['Architect', firmName['Lost Architect'], 'draft'],
      ['Millwork', `Oakhaven Joinery ${prefix}`, 'draft'],
    ])
    expect(skipped.map((s) => [s.firm, s.where])).toEqual([
      [`Studio/Other Studio ${prefix}`, 'several firms in one line: add by hand'],
      [`Harbourside Ateleir ${prefix}`, `probably already credited as "${firmName['Label Architect']}"`],
    ])
    const live = await payload.findByID({ collection: 'projects', id: projectId, depth: 0 })
    expect(live.architects).toEqual([firm['Label Architect']])
  })

  it('adds them to the live site and the draft, never what a person removed, and keeps the draft unpublished', async () => {
    await restoreCredits(payload, [record], [], true)
    const millworker = (await payload.find({ collection: 'firms', where: { name: { equals: `Oakhaven Joinery ${prefix}` } } })).docs[0]
    expect(millworker).toBeDefined()
    for (const draft of [false, true]) {
      const v = (await payload.findByID({ collection: 'projects', id: projectId, depth: 0, draft })) as Project
      expect(v.architects).toEqual([firm['Label Architect'], firm['Lost Architect']])
      const firms = (v.credits ?? []).flatMap((c) => c.firms)
      expect(firms).toContain(millworker.id)
      expect(firms).not.toContain(firm['Removed Engineer'])
      expect(v.summary).toBe(draft ? 'Unpublished edit.' : 'Live text.')
      expect(v._status).toBe(draft ? 'draft' : 'published')
    }
    // A second run finds nothing to do.
    expect((await restoreCredits(payload, [record], [], false)).rows).toEqual([])
  })
})
