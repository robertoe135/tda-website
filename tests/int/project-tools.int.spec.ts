import { createLocalReq, getPayload, type Payload, type PayloadRequest } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { exportProjects, importTeam } from '@/collections/projects-endpoints'
import { parseCsv } from '@/lib/csv'
import { EXPORT_COLUMNS, projectRow } from '@/lib/project-export'
import { onTimeline } from '@/lib/projects'
import { readSheet } from '@/lib/team-credits'
import config from '@/payload.config'
import type { Project, User } from '@/payload-types'

describe('the Timeline', () => {
  it('shows completed and in-progress projects with a year, never unbuilt or cancelled ones', () => {
    expect(onTimeline({ year: 2020, status: 'completed' })).toBe(true)
    expect(onTimeline({ year: 2027, status: 'in-progress' })).toBe(true)
    expect(onTimeline({ year: 2019, status: 'unbuilt' })).toBe(false)
    expect(onTimeline({ year: 2019, status: 'cancelled' })).toBe(false)
    expect(onTimeline({ status: 'completed' })).toBe(false)
  })
})

describe('a project as a spreadsheet row', () => {
  it('writes each list the way the page reads, and says what is live', () => {
    const row = projectRow(
      {
        id: 7,
        name: 'Hall',
        slug: 'hall',
        status: 'cancelled',
        year: 2019,
        _status: 'draft',
        location: { displayName: 'New York, NY' },
        typologies: [{ name: 'Performing Arts' }],
        architects: [{ name: 'Studio A' }, { name: 'Studio B' }],
        credits: [{ role: { name: 'Structural Engineer' }, firms: [{ name: 'Eng One' }, { name: 'Eng Two' }] }],
        clients: [{ name: 'Owner' }],
        team: [
          { role: 'designer', person: { name: 'Dee' } },
          { role: 'principal', person: { name: 'Pat' } },
          { role: 'designer', person: { name: 'Dan' } },
        ],
        certifications: [{ system: 'leed', level: 'gold' }],
        stillNeeded: ['photos'],
        updatedAt: '2026-10-20T10:00:00.000Z',
      } as unknown as Project,
      { live: true, awards: ['2020 Award of Merit (IES)'], press: 2, site: 'https://example.test' },
    )
    expect(Object.keys(row)).toEqual([...EXPORT_COLUMNS])
    expect(row).toMatchObject({
      'on the site': 'live, with unpublished changes',
      status: 'Cancelled',
      architects: 'Studio A; Studio B',
      credits: 'Structural Engineer: Eng One, Eng Two',
      'TDA team': 'Principal in Charge: Pat; Designer: Dee, Dan',
      certifications: 'LEED Gold',
      awards: '2020 Award of Merit (IES)',
      'still needed': 'Photos',
      page: 'https://example.test/projects/hall',
      updated: '2026-10-20',
    })
  })

  it('reads a sheet saved with tabs as well as commas', () => {
    expect(readSheet('project\tperson\nhall\tPat\n')).toEqual([
      ['project', 'person'],
      ['hall', 'Pat'],
    ])
  })
})

describe('the admin’s spreadsheet tools', () => {
  let payload: Payload
  let user: User
  const tag = `zt${Date.now().toString(36)}`
  let projectId: number
  let personId: number

  beforeAll(async () => {
    payload = await getPayload({ config })
    user = await payload.create({ collection: 'users', data: { email: `${tag}@example.test`, password: `${tag}-pass-1`, role: 'editor' } as never })
    const typology = (await payload.create({ collection: 'typologies', data: { name: `${tag} Typology` } })).id
    projectId = (
      await payload.create({ collection: 'projects', data: { name: `${tag} Hall`, slug: `${tag}-hall`, status: 'completed', typologies: [typology], summary: 'Live.', _status: 'published' } })
    ).id
    personId = (await payload.create({ collection: 'people', data: { name: `Quinn Larkspur ${tag}`, showOnSite: true, isCurrent: true, _status: 'published' } })).id
  })

  afterAll(async () => {
    await payload.delete({ collection: 'projects', where: { name: { like: tag } } })
    await payload.delete({ collection: 'people', where: { name: { like: tag } } })
    await payload.delete({ collection: 'typologies', where: { name: { like: tag } } })
    await payload.delete({ collection: 'users', where: { email: { like: tag } } })
  })

  const req = async (body?: unknown, signedIn = true) => {
    const r = (await createLocalReq({ user: signedIn ? { ...user, collection: 'users' } : undefined }, payload)) as PayloadRequest
    r.json = async () => body
    return r
  }

  it('exports every project for staff only', async () => {
    expect((await exportProjects(await req(undefined, false))).status).toBe(401)
    const res = await exportProjects(await req())
    expect(res.headers.get('Content-Disposition')).toMatch(/attachment; filename="tda-projects-/)
    const rows = parseCsv(await res.text())
    expect(rows[0]).toEqual([...EXPORT_COLUMNS])
    expect(rows.find((r) => r[1] === `${tag} Hall`)?.[2]).toBe('live')
  })

  it('checks a team sheet, refuses one with problems, and saves teams as drafts', async () => {
    const sheet = ['project,person,role', `${tag}-hall,Quinn Larkspur ${tag},PIC`, `${tag}-hall,Nobody Atall ${tag},Designer`].join('\n')
    const bad = await (await importTeam(await req({ csv: sheet, save: true }))).json()
    expect(bad.saved).toBe(false)
    expect(bad.problems.map((p: { line: number }) => p.line)).toEqual([3])

    const good = await (await importTeam(await req({ csv: sheet.split('\n').slice(0, 2).join('\n'), save: true }))).json()
    expect(good).toMatchObject({ saved: true, projects: [{ id: projectId, team: [`Quinn Larkspur ${tag} (Principal in Charge)`] }] })
    const draft = (await payload.findByID({ collection: 'projects', id: projectId, draft: true, depth: 0 })) as Project
    expect(draft.team?.map((t) => [t.person, t.role])).toEqual([[personId, 'principal']])
    const live = (await payload.findByID({ collection: 'projects', id: projectId, depth: 0 })) as Project
    expect(live.team ?? []).toEqual([]) // the live page changes when someone publishes
  })
})
