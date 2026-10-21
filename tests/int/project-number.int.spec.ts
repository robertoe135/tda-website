import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import type { Project, User } from '@/payload-types'

describe('internal project number and names', () => {
  let payload: Payload
  let user: User
  const tag = `zn${Date.now().toString(36)}`
  const number = `${tag}-001`
  let typology: number
  let id: number

  beforeAll(async () => {
    payload = await getPayload({ config })
    user = await payload.create({ collection: 'users', data: { email: `${tag}@example.test`, password: `${tag}-pass-1`, role: 'editor' } as never })
    typology = (await payload.create({ collection: 'typologies', data: { name: `${tag} Typology` } })).id
    id = (
      await payload.create({
        collection: 'projects',
        data: { name: `${tag} Hall`, status: 'completed', typologies: [typology], projectNumber: ` ${number} `, aliases: [{ name: `Codename ${tag}` }], _status: 'published' },
      })
    ).id
  })

  afterAll(async () => {
    await payload.delete({ collection: 'projects', where: { name: { like: tag } } })
    await payload.delete({ collection: 'typologies', where: { name: { like: tag } } })
    await payload.delete({ collection: 'users', where: { email: { like: tag } } })
  })

  // What the admin list search sends: the same "or" of like conditions.
  const search = (text: string) =>
    payload.find({
      collection: 'projects',
      overrideAccess: false,
      user: { ...user, collection: 'users' },
      depth: 0,
      where: { or: ['name', 'projectNumber', 'aliases.name', 'summary'].map((f) => ({ [f]: { like: text } })) },
    })

  it('finds the project by its number or an internal name in the admin search', async () => {
    expect((await search(number)).docs.map((d) => d.id)).toEqual([id])
    expect((await search(`codename ${tag}`)).docs.map((d) => d.id)).toEqual([id])
  })

  it('stores the number trimmed and never shows it or the internal names to the public', async () => {
    const staff = (await payload.findByID({ collection: 'projects', id, overrideAccess: false, user: { ...user, collection: 'users' } })) as Project
    expect(staff.projectNumber).toBe(number)
    const pub = (await payload.findByID({ collection: 'projects', id, overrideAccess: false })) as Project
    expect(pub.name).toBe(`${tag} Hall`)
    expect(pub.projectNumber).toBeUndefined()
    expect(pub.aliases ?? []).toEqual([])
    // Nor can a visitor probe for it with a query.
    await expect(payload.find({ collection: 'projects', overrideAccess: false, where: { projectNumber: { equals: number } } })).rejects.toThrow()
  })

  it('refuses a number another project already has, even on a draft', async () => {
    const refused = await payload
      .create({ collection: 'projects', draft: true, data: { name: `${tag} Copy`, status: 'completed', typologies: [typology], projectNumber: number, _status: 'draft' } })
      .catch((e: { data?: { errors?: { message: string }[] } }) => e)
    expect((refused as { data?: { errors?: { message: string }[] } }).data?.errors?.[0]?.message).toBe(`${number} is already the number of "${tag} Hall".`)
    const blank = await payload.create({ collection: 'projects', draft: true, data: { name: `${tag} Blank`, status: 'completed', typologies: [typology], projectNumber: '  ', _status: 'draft' } })
    expect(blank.projectNumber ?? null).toBeNull()
  })
})
