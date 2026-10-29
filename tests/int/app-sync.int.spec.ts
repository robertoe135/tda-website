import { getPayload, type Payload, type PayloadRequest } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { fromApp } from '@/collections/app-sync-endpoint'
import { readAppProject } from '@/lib/app-sync'
import config from '@/payload.config'

// "Send to website" from the internal app's Marketing tab (docs/app-sync.md).
describe('projects sent from the TDA app', () => {
  let payload: Payload
  const tag = `za${Date.now().toString(36)}`
  const number = `${tag}-001`
  const TOKEN = 'test-app-sync-token-0123456789'

  const send = (body: unknown, auth = `Bearer ${TOKEN}`) =>
    fromApp({
      payload,
      headers: new Headers({ authorization: auth }),
      text: async () => JSON.stringify(body),
    } as unknown as PayloadRequest)

  const project = (extra: Record<string, unknown> = {}) => ({
    projectNumber: number,
    name: `${tag} Concert Hall`,
    year: 2024,
    areaSqFt: 120000,
    location: `${tag}ville, NY`,
    architects: [`${tag} Architects`],
    credits: [{ role: `${tag} Electrical Engineer`, firm: `${tag} Engineers` }],
    client: `${tag} Owner LLC`,
    summary: 'A short summary written by marketing.',
    description: ['Scope paragraph.', 'Goals paragraph.\n\nSecond goals paragraph.'],
    team: [
      { name: `Pat ${tag}`, role: 'principal' },
      { name: `Sam ${tag}`, role: 'designer' },
      { name: `Hidden ${tag}`, role: 'designer' },
      { name: `Nobody ${tag}`, role: 'project-manager' },
    ],
    sentBy: 'Tester',
    ...extra,
  })

  beforeAll(async () => {
    process.env.APP_SYNC_TOKEN = TOKEN
    payload = await getPayload({ config })
    await payload.create({ collection: 'locations', data: { city: `${tag}ville`, region: 'NY', country: 'USA' } })
    await payload.create({ collection: 'firms', data: { name: `${tag} Architects` } })
    await payload.create({ collection: 'firms', data: { name: `${tag} Engineers` } })
    await payload.create({ collection: 'creditRoles', data: { name: `${tag} Electrical Engineer` } })
    await payload.create({ collection: 'clients', data: { name: `${tag} Owner LLC` } })
    await payload.create({ collection: 'people', data: { name: `Pat ${tag}`, showOnSite: true, isCurrent: true }, draft: true })
    await payload.create({ collection: 'people', data: { name: `Sam ${tag}`, showOnSite: true, isCurrent: true }, draft: true })
    await payload.create({ collection: 'people', data: { name: `Hidden ${tag}`, showOnSite: false, isCurrent: true }, draft: true })
  })

  afterAll(async () => {
    await payload.delete({ collection: 'projects', where: { name: { like: tag } } })
    await payload.delete({ collection: 'people', where: { name: { like: tag } } })
    for (const collection of ['firms', 'creditRoles', 'clients'] as const) await payload.delete({ collection, where: { name: { like: tag } } })
    await payload.delete({ collection: 'locations', where: { city: { like: tag } } })
  })

  it('refuses a request without the website token', async () => {
    expect((await send(project(), 'Bearer wrong')).status).toBe(401)
    expect((await send(project(), '')).status).toBe(401)
  })

  it('keeps only the allowlisted fields', () => {
    const { project: read } = readAppProject({ ...project(), clientContactEmail: 'owner@example.com', fee: 1, ndaRestrictions: 'secret' })
    expect(Object.keys(read!)).not.toContain('clientContactEmail')
    expect(Object.keys(read!)).not.toContain('ndaRestrictions')
    expect(JSON.stringify(read)).not.toContain('owner@example.com')
    expect(readAppProject({ name: 'No number' }).problems).toHaveLength(1)
  })

  it('previews without writing anything', async () => {
    const res = await (await send(project())).json()
    expect(res.saved).toBe(false)
    expect(res.project.isNew).toBe(true)
    const found = await payload.find({ collection: 'projects', draft: true, where: { projectNumber: { equals: number } } })
    expect(found.totalDocs).toBe(0)
  })

  it('creates a hidden draft, matching names and listing the ones it could not', async () => {
    const res = await (await send({ ...project(), save: true })).json()
    expect(res.saved).toBe(true)
    expect(res.project.isNew).toBe(true)
    expect(res.adminUrl).toContain(`/admin/collections/projects/${res.project.id}`)
    const notFound = res.matches.filter((m: { status: string }) => m.status === 'missing').map((m: { sent: string }) => m.sent)
    expect(notFound.sort()).toEqual([`Hidden ${tag}`, `Nobody ${tag}`].sort())
    expect(res.matches.filter((m: { status: string }) => m.status === 'suggested')).toEqual([])

    const doc = await payload.findByID({ collection: 'projects', id: res.project.id, draft: true, depth: 1 })
    expect(doc._status).toBe('draft')
    expect(doc.status).toBe('in-progress')
    expect(doc.confidential).toBe(true)
    expect(doc.year).toBe(2024)
    expect(doc.areaSqFt).toBe(120000)
    expect((doc.location as { city: string }).city).toBe(`${tag}ville`)
    expect(doc.architects).toHaveLength(1)
    expect(doc.credits).toHaveLength(1)
    expect(doc.team?.map((t) => [(t.person as { name: string }).name, t.role])).toEqual([
      [`Pat ${tag}`, 'principal'],
      [`Sam ${tag}`, 'designer'],
    ])
    const paragraphs = (doc.description as { root: { children: unknown[] } }).root.children
    expect(paragraphs).toHaveLength(3)
    // What was sent is kept on the draft for the "From the TDA app" tab.
    const fromApp = doc.fromApp as { sent: { client: string }; matches: unknown[] }
    expect(fromApp.sent.client).toBe(`${tag} Owner LLC`)
    expect(fromApp.matches.length).toBeGreaterThan(5)
    // Public reads still see nothing: it is an unpublished draft.
    const pub = await payload.find({ collection: 'projects', overrideAccess: false, where: { name: { equals: `${tag} Concert Hall` } } })
    expect(pub.totalDocs).toBe(0)
  })

  it('on a second send fills only what is empty and keeps what marketing wrote', async () => {
    const first = await payload.find({ collection: 'projects', draft: true, where: { projectNumber: { equals: number } } })
    const id = first.docs[0].id
    await payload.update({ collection: 'projects', id, data: { summary: 'Edited on the website.', year: null }, draft: true })

    const res = await (await send({ ...project({ summary: 'Changed in the app.', year: 2025 }), save: true })).json()
    expect(res.project).toMatchObject({ id, isNew: false })
    expect(res.kept).toContain('Summary')
    expect(res.filled).toContain('Year')

    const doc = await payload.findByID({ collection: 'projects', id, draft: true, depth: 0 })
    expect(doc.summary).toBe('Edited on the website.')
    expect(doc.year).toBe(2025)
    const all = await payload.find({ collection: 'projects', draft: true, where: { projectNumber: { equals: number } } })
    expect(all.totalDocs).toBe(1)
  })

  it('reports a summary longer than the website allows instead of cutting it', async () => {
    const res = await (await send(project({ projectNumber: `${tag}-002`, summary: 'x'.repeat(301) }))).json()
    expect(res.warnings.some((w: string) => w.includes('301 characters'))).toBe(true)
    expect(res.filled).not.toContain('Summary')
  })

  it('uses the closest name as a suggestion, and nothing when no name is close', async () => {
    const res = await (
      await send({
        ...project({ projectNumber: `${tag}-003`, architects: [`${tag} Architect`, 'Completely Different Firm'], client: `${tag} Owner L.L.C.` }),
        save: true,
      })
    ).json()
    const byName = Object.fromEntries(res.matches.map((m: { sent: string }) => [m.sent, m]))
    expect(byName[`${tag} Architect`]).toMatchObject({ status: 'suggested', usedName: `${tag} Architects` })
    expect(byName['Completely Different Firm']).toMatchObject({ status: 'missing' })
    // Punctuation-only differences are the same name.
    expect(byName[`${tag} Owner L.L.C.`]).toMatchObject({ status: 'matched' })
    const doc = await payload.findByID({ collection: 'projects', id: res.project.id, draft: true, depth: 0 })
    expect(doc.architects).toHaveLength(1)
  })

  it('never shows what was sent to the public', async () => {
    const found = await payload.find({ collection: 'projects', draft: true, where: { projectNumber: { equals: `${tag}-003` } } })
    await payload.update({ collection: 'projects', id: found.docs[0].id, data: { _status: 'published', status: 'completed' } as never })
    const pub = await payload.findByID({ collection: 'projects', id: found.docs[0].id, overrideAccess: false, depth: 0 })
    expect(pub.fromApp).toBeUndefined()
    expect(pub.projectNumber).toBeUndefined()
  })
})
