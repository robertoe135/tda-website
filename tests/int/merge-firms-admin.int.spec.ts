import { createLocalReq, getPayload, type Payload, type PayloadRequest } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { mergeHandler } from '@/collections/merge-endpoint'
import config from '@/payload.config'
import type { Firm, Project, User, YearsOfLight } from '@/payload-types'

const mergeFirm = mergeHandler('firms')

describe('merging two firms in the admin', () => {
  let payload: Payload
  let user: User
  const tag = `zm${Date.now().toString(36)}`
  let keep: Firm
  let dupe: Firm
  let other: Firm
  let project: Project
  let year: YearsOfLight

  beforeAll(async () => {
    payload = await getPayload({ config })
    user = await payload.create({ collection: 'users', data: { email: `${tag}@example.test`, password: `${tag}-pass-1`, role: 'editor' } as never })
    keep = await payload.create({ collection: 'firms', data: { name: `Quillfeather ${tag} Partners` } })
    dupe = await payload.create({ collection: 'firms', data: { name: `Quillfeather ${tag} Partners Architects LLP`, website: 'https://quill.example', listAsCollaborator: true } })
    other = await payload.create({ collection: 'firms', data: { name: `Brightwater ${tag} Engineers` } })
    const typology = await payload.create({ collection: 'typologies', data: { name: `${tag} Typology` } })
    project = await payload.create({
      collection: 'projects',
      data: { name: `${tag} Hall`, status: 'completed', typologies: [typology.id], architects: [dupe.id, other.id], _status: 'published' },
    })
    year = await payload.create({ collection: 'years-of-light', data: { year: 1991, collaborators: [dupe.id], _status: 'published' } })
  })

  afterAll(async () => {
    await payload.delete({ collection: 'years-of-light', where: { year: { equals: 1991 } } })
    await payload.delete({ collection: 'projects', where: { name: { like: tag } } })
    await payload.delete({ collection: 'firms', where: { name: { like: tag } } })
    await payload.delete({ collection: 'typologies', where: { name: { like: tag } } })
    await payload.delete({ collection: 'users', where: { email: { like: tag } } })
  })

  const req = async (id?: number, body?: unknown, signedIn = true) => {
    const r = (await createLocalReq({ user: signedIn ? { ...user, collection: 'users' } : undefined }, payload)) as PayloadRequest
    r.routeParams = id ? { id: String(id) } : {}
    r.json = async () => body
    return r
  }

  it('is for staff only', async () => {
    expect((await mergeFirm(await req(keep.id, { mergeId: dupe.id }, false))).status).toBe(401)
  })

  it('previews a merge without changing anything', async () => {
    const plan = await (await mergeFirm(await req(keep.id, { mergeId: dupe.id }))).json()
    expect(plan).toMatchObject({ merged: false, projects: [`${tag} Hall`], years: [1991], filled: ['website', 'listAsCollaborator'] })
    expect(await payload.findByID({ collection: 'firms', id: dupe.id })).toBeTruthy()
  })

  it('merges: projects and Years of Light name the kept firm, which takes the other’s name, website and listing', async () => {
    const result = await (await mergeFirm(await req(keep.id, { mergeId: dupe.id, confirm: true }))).json()
    expect(result.merged).toBe(true)
    const live = (await payload.findByID({ collection: 'projects', id: project.id, depth: 0 })) as Project
    expect(live.architects).toEqual([keep.id, other.id])
    const y = (await payload.findByID({ collection: 'years-of-light', id: year.id, depth: 0 })) as YearsOfLight
    expect(y.collaborators).toEqual([keep.id])
    const kept = (await payload.findByID({ collection: 'firms', id: keep.id })) as Firm
    expect(kept.aliases?.map((a) => a.name)).toEqual([dupe.name])
    expect(kept).toMatchObject({ website: 'https://quill.example', listAsCollaborator: true })
    await expect(payload.findByID({ collection: 'firms', id: dupe.id })).rejects.toThrow()
  })

  it('refuses merging a record into itself or one that is gone', async () => {
    expect((await mergeFirm(await req(keep.id, { mergeId: keep.id, confirm: true }))).status).toBe(400)
    expect((await mergeFirm(await req(keep.id, { mergeId: dupe.id, confirm: true }))).status).toBe(404)
  })
})
