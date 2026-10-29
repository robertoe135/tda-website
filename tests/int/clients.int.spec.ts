import sharp from 'sharp'
import { createLocalReq, getPayload, type Payload, type PayloadRequest } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { mergeHandler } from '@/collections/merge-endpoint'
import { withClientNames } from '@/lib/client-names'
import { getPublishedProject } from '@/lib/projects'
import config from '@/payload.config'
import type { Client, Media, Photographer, Project, User } from '@/payload-types'

describe('clients and photographers', () => {
  let payload: Payload
  let user: User
  const tag = `zc${Date.now().toString(36)}`
  let typology: number
  let owner: Client
  let secret: Client
  let open: Project
  let hidden: Project

  beforeAll(async () => {
    payload = await getPayload({ config })
    user = await payload.create({ collection: 'users', data: { email: `${tag}@example.test`, password: `${tag}-pass-1`, role: 'editor' } as never })
    typology = (await payload.create({ collection: 'typologies', data: { name: `${tag} Typology` } })).id
    owner = await payload.create({ collection: 'clients', data: { name: `Openowner ${tag}` } })
    secret = await payload.create({ collection: 'clients', data: { name: `Secretowner ${tag}` } })
    open = await payload.create({
      collection: 'projects',
      data: { name: `${tag} Hall`, slug: `${tag}-hall`, status: 'completed', typologies: [typology], clients: [owner.id], confidential: false, _status: 'published' },
    })
    hidden = await payload.create({
      collection: 'projects',
      data: { name: `${tag} Residence`, slug: `${tag}-residence`, status: 'completed', typologies: [typology], clients: [secret.id], confidential: true, _status: 'published' },
    })
  })

  afterAll(async () => {
    await payload.delete({ collection: 'projects', where: { name: { like: tag } } })
    await payload.delete({ collection: 'clients', where: { name: { like: tag } } })
    await payload.delete({ collection: 'media', where: { alt: { like: tag } } })
    await payload.delete({ collection: 'photographers', where: { name: { like: tag } } })
    await payload.delete({ collection: 'typologies', where: { name: { like: tag } } })
    await payload.delete({ collection: 'users', where: { email: { like: tag } } })
  })

  const req = async (id: number, body: unknown, signedIn = true) => {
    const r = (await createLocalReq({ user: signedIn ? { ...user, collection: 'users' } : undefined }, payload)) as PayloadRequest
    r.routeParams = { id: String(id) }
    r.json = async () => body
    return r
  }

  it('keeps the list of clients from the public, confidential owners included', async () => {
    await expect(payload.find({ collection: 'clients', overrideAccess: false, where: { name: { like: tag } } })).rejects.toThrow()
    await expect(payload.findByID({ collection: 'clients', id: secret.id, overrideAccess: false })).rejects.toThrow()
    // A public read of a project gives its owner's id at most, never the record.
    const project = await payload.findByID({ collection: 'projects', id: open.id, depth: 2, overrideAccess: false })
    expect(project.clients).toEqual([owner.id])
  })

  it('shows the owner of a project by name, as text, only when it is not confidential', async () => {
    const a = await getPublishedProject(`${tag}-hall`)
    const b = await getPublishedProject(`${tag}-residence`)
    expect(b.clients ?? []).toEqual([]) // removed by field access
    const [named, none] = await withClientNames(payload, [a, b])
    expect((named.clients as Client[]).map((c) => c.name)).toEqual([owner.name])
    expect(none.clients).toEqual([])
    // Even a confidential project read by staff gets no names.
    const staff = await payload.findByID({ collection: 'projects', id: hidden.id, depth: 0 })
    expect((await withClientNames(payload, [staff]))[0].clients).toEqual([])
  })

  it('merges two records of one client', async () => {
    const merge = mergeHandler('clients')
    const dupe = await payload.create({ collection: 'clients', data: { name: `Openowner ${tag} Inc` } })
    const other = await payload.create({
      collection: 'projects',
      data: { name: `${tag} Annex`, status: 'completed', typologies: [typology], clients: [dupe.id, owner.id], confidential: false, _status: 'published' },
    })
    expect((await merge(await req(owner.id, { mergeId: dupe.id }, false))).status).toBe(401)
    const plan = await (await merge(await req(owner.id, { mergeId: dupe.id }))).json()
    expect(plan).toMatchObject({ merged: false, projects: [`${tag} Annex`] })
    const done = await (await merge(await req(owner.id, { mergeId: dupe.id, confirm: true }))).json()
    expect(done.merged).toBe(true)
    expect((await payload.findByID({ collection: 'projects', id: other.id, depth: 0 })).clients).toEqual([owner.id]) // no repeat
    expect((await payload.find({ collection: 'clients', where: { id: { equals: dupe.id } } })).totalDocs).toBe(0)
    expect((await payload.findByID({ collection: 'projects', id: open.id, depth: 0 })).clients).toEqual([owner.id])
  })

  it('merges two records of one photographer: projects and photos credit the kept one', async () => {
    const merge = mergeHandler('photographers')
    const keep = (await payload.create({ collection: 'photographers', data: { name: `Lenscraft ${tag}` } })) as Photographer
    const dupe = (await payload.create({ collection: 'photographers', data: { name: `Lens Craft ${tag} Studio`, website: 'https://lens.example' } })) as Photographer
    const data = await sharp({ create: { width: 40, height: 30, channels: 3, background: '#888' } }).jpeg().toBuffer()
    const photo = (await payload.create({
      collection: 'media',
      data: { alt: `${tag} photo`, photographer: dupe.id },
      file: { data, mimetype: 'image/jpeg', name: `${tag}.jpg`, size: data.length },
    })) as Media
    const project = await payload.create({
      collection: 'projects',
      data: { name: `${tag} Gallery`, status: 'completed', typologies: [typology], photographers: [dupe.id], _status: 'published' },
    })
    const plan = await (await merge(await req(keep.id, { mergeId: dupe.id }))).json()
    expect(plan).toMatchObject({ merged: false, projects: [`${tag} Gallery`], photos: 1, filled: ['website'] })
    const done = await (await merge(await req(keep.id, { mergeId: dupe.id, confirm: true }))).json()
    expect(done.merged).toBe(true)
    expect((await payload.findByID({ collection: 'projects', id: project.id, depth: 0 })).photographers).toEqual([keep.id])
    expect((await payload.findByID({ collection: 'media', id: photo.id, depth: 0 })).photographer).toBe(keep.id)
    expect((await payload.findByID({ collection: 'photographers', id: keep.id })).website).toBe('https://lens.example')
    expect((await payload.find({ collection: 'photographers', where: { id: { equals: dupe.id } } })).totalDocs).toBe(0)
  })
})
