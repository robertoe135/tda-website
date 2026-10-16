import { mkdtemp } from 'fs/promises'
import { tmpdir } from 'os'
import path from 'path'

import { getPayload, Payload } from 'payload'
import config from '@/payload.config'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { publishProjects, readTouched, recordTouched } from '../../scripts/media/publish'

let payload: Payload
const prefix = `zz-pub-${Date.now()}`

beforeAll(async () => {
  payload = await getPayload({ config: await config })
})

afterAll(async () => {
  await payload.delete({ collection: 'projects', where: { name: { like: prefix } } })
  await payload.delete({ collection: 'typologies', where: { name: { like: prefix } } })
})

describe('pnpm media:publish', () => {
  it('keeps one list of the projects the imports saved', async () => {
    const file = path.join(await mkdtemp(path.join(tmpdir(), 'touched-')), 'touched.json')
    await recordTouched(3, file)
    await recordTouched(1, file)
    await recordTouched(3, file)
    expect(await readTouched(file)).toEqual([1, 3])
  })

  it('publishes the latest draft as it stands, and holds a project without categories', async () => {
    const typology = await payload.create({ collection: 'typologies', data: { name: `${prefix} Halls`, slug: `${prefix}-halls` } })
    // Live with an older year; the import then saved a draft with the new one.
    const live = await payload.create({ collection: 'projects', data: { name: `${prefix} Live Hall`, status: 'completed', year: 2020, typologies: [typology.id] } })
    await payload.update({ collection: 'projects', id: live.id, draft: true, data: { year: 2025 } })
    const bare = await payload.create({ collection: 'projects', draft: true, data: { name: `${prefix} New Hall`, status: 'completed' } })

    const dry = await publishProjects(payload, [live.id, bare.id], false)
    expect(dry.published).toEqual([`${prefix} Live Hall`])
    expect((await payload.findByID({ collection: 'projects', id: live.id, depth: 0 })).year).toBe(2020)

    const r = await publishProjects(payload, [live.id, bare.id, 999999999], true)
    expect(r.published).toEqual([`${prefix} Live Hall`])
    expect(r.held).toEqual([{ name: `${prefix} New Hall`, reason: expect.stringMatching(/categories/) }])
    expect(r.gone).toEqual([999999999])
    const now = await payload.findByID({ collection: 'projects', id: live.id, depth: 0 })
    expect(now).toMatchObject({ _status: 'published', year: 2025, typologies: [typology.id] })

    expect((await publishProjects(payload, [live.id], true)).live).toEqual([`${prefix} Live Hall`])
  })
})
