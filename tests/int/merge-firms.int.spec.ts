import { getPayload, Payload } from 'payload'
import config from '@/payload.config'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { mergeFirms } from '../../scripts/migrate/merge-firms'

let payload: Payload
const prefix = `zz-merge-${Date.now()}`

beforeAll(async () => {
  payload = await getPayload({ config: await config })
})

afterAll(async () => {
  await payload.delete({ collection: 'projects', where: { name: { like: prefix } } })
  await payload.delete({ collection: 'firms', where: { name: { like: prefix } } })
  await payload.delete({ collection: 'creditRoles', where: { name: { like: prefix } } })
})

describe('merging two records of one firm', () => {
  it('moves architects, clients and credits to the kept firm, without repeats, then deletes the other', async () => {
    const keep = await payload.create({ collection: 'firms', data: { name: `${prefix} Keep Partners` } })
    const merge = await payload.create({ collection: 'firms', data: { name: `${prefix} Zzz Other Spelling` } })
    const role = await payload.create({ collection: 'creditRoles', data: { name: `${prefix} Engineer` } })
    const project = await payload.create({
      collection: 'projects',
      data: {
        name: `${prefix} Project`,
        architects: [keep.id, merge.id],
        clients: [merge.id],
        credits: [{ role: role.id, firms: [merge.id] }],
      },
      draft: true,
    })

    const dry = await mergeFirms(payload, keep.name, merge.name, false)
    expect(dry.projects).toEqual([project.name])
    expect((await payload.find({ collection: 'firms', where: { id: { equals: merge.id } } })).totalDocs).toBe(1)

    await mergeFirms(payload, keep.name, merge.name, true)
    const after = await payload.findByID({ collection: 'projects', id: project.id, draft: true, depth: 0 })
    expect(after.architects).toEqual([keep.id])
    expect(after.clients).toEqual([keep.id])
    expect(after.credits?.[0].firms).toEqual([keep.id])
    expect(after._status).toBe('draft')
    expect((await payload.find({ collection: 'firms', where: { id: { equals: merge.id } } })).totalDocs).toBe(0)
  })

  it('refuses a name it cannot find exactly', async () => {
    await expect(mergeFirms(payload, `${prefix} Nobody`, `${prefix} Also Nobody`, false)).rejects.toThrow(/Expected one firm/)
  })
})
