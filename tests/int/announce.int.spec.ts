import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { getPublishedProjects } from '@/lib/projects'
import config from '@/payload.config'
import type { Project, User } from '@/payload-types'

describe('announcing work in progress', () => {
  let payload: Payload
  let user: User
  const tag = `za${Date.now().toString(36)}`
  let typology: number
  const ids: Record<'built' | 'secret' | 'announced', number> = { built: 0, secret: 0, announced: 0 }

  beforeAll(async () => {
    payload = await getPayload({ config })
    user = await payload.create({ collection: 'users', data: { email: `${tag}@example.test`, password: `${tag}-pass-1`, role: 'editor' } as never })
    typology = (await payload.create({ collection: 'typologies', data: { name: `${tag} Typology` } })).id
    const make = (name: string, data: Partial<Project>) =>
      payload.create({ collection: 'projects', data: { name: `${tag} ${name}`, typologies: [typology], _status: 'published', ...data } as never })
    ids.built = (await make('Built Hall', { status: 'completed', year: 2020 })).id
    ids.secret = (await make('Secret Tower', { status: 'in-progress', year: 2029 })).id
    ids.announced = (
      await make('Announced Museum', { status: 'in-progress', year: 2028, announceApproved: true, announceApprovedBy: 'Owner, by email', announceApprovedOn: '2026-10-20T00:00:00.000Z' })
    ).id
  })

  afterAll(async () => {
    await payload.delete({ collection: 'projects', where: { name: { like: tag } } })
    await payload.delete({ collection: 'typologies', where: { name: { like: tag } } })
    await payload.delete({ collection: 'users', where: { email: { like: tag } } })
  })

  const publicNames = async () =>
    (await payload.find({ collection: 'projects', overrideAccess: false, where: { name: { like: tag } }, pagination: false, depth: 0 })).docs.map((d) => d.name).sort()

  it('keeps published work in progress off the site until someone approves announcing it', async () => {
    expect(await publicNames()).toEqual([`${tag} Announced Museum`, `${tag} Built Hall`])
    expect((await getPublishedProjects()).map((p) => p.name).filter((n) => n.startsWith(tag))).not.toContain(`${tag} Secret Tower`)
    // Nor by its address.
    const bySlug = await payload.find({ collection: 'projects', overrideAccess: false, where: { id: { equals: ids.secret } } })
    expect(bySlug.docs).toEqual([])
    // Staff see everything in the admin.
    const staff = await payload.find({ collection: 'projects', overrideAccess: false, user: { ...user, collection: 'users' }, where: { name: { like: tag } }, depth: 0 })
    expect(staff.docs).toHaveLength(3)
  })

  it('shows it once approved, without saying who approved it', async () => {
    await payload.update({ collection: 'projects', id: ids.secret, data: { announceApproved: true, announceApprovedBy: 'Architect, at the launch', _status: 'published' } })
    expect(await publicNames()).toContain(`${tag} Secret Tower`)
    const pub = (await payload.findByID({ collection: 'projects', id: ids.announced, overrideAccess: false })) as Project
    expect(pub.announceApprovedBy).toBeUndefined()
    expect(pub.announceApprovedOn).toBeUndefined()
  })

  it('asks who approved it before publishing an approval', async () => {
    const refused = await payload
      .update({ collection: 'projects', id: ids.built, data: { status: 'in-progress', announceApproved: true, announceApprovedBy: ' ', _status: 'published' } })
      .catch((e: { data?: { errors?: { path: string }[] } }) => e)
    expect((refused as { data?: { errors?: { path: string }[] } }).data?.errors?.map((e) => e.path)).toEqual(['announceApprovedBy'])
  })
})
