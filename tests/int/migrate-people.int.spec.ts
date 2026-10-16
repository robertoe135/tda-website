import { getPayload, Payload } from 'payload'
import sharp from 'sharp'
import config from '@/payload.config'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { applyTeam, headshotNotes, parseTeamPage } from '../../scripts/migrate/people'

const block = (inner: string) => `<div class="fe-block fe-block-x">${inner}</div>`
const text = (t: string) => block(`<div class="sqs-html-content" data-sqsp-text-block-content><h4>${t}</h4></div>`)
const image = (src: string) => block(`<img data-src="${src}?format=750w" />`)

describe('the old team page', () => {
  it('pairs each name and title with the headshot before it, by group, in page order', () => {
    const html = [
      text('Leadership'),
      image('https://images.example/a/AB-No+BG.png'),
      text('Ann Bell, President and Founder'),
      text('Design Team'),
      image('https://images.example/b/TDA_Cy0001-C.jpg'),
      text('Cy Dee, Designer / Marketing Coordinator'),
      text('Ed Fox, Designer'),
    ].join('')
    expect(parseTeamPage(html)).toEqual([
      { name: 'Ann Bell', title: 'President and Founder', group: 'leadership', order: 1, headshot: 'https://images.example/a/AB-No+BG.png' },
      { name: 'Cy Dee', title: 'Designer / Marketing Coordinator', group: 'design', order: 1, headshot: 'https://images.example/b/TDA_Cy0001-C.jpg' },
      { name: 'Ed Fox', title: 'Designer', group: 'design', order: 2, headshot: undefined },
    ])
  })

  it("flags a headshot named for someone else's initials, or temporary", () => {
    const m = (name: string, file: string) => headshotNotes({ name, title: 'x', group: 'design', order: 1, headshot: `https://i.example/${file}` })
    expect(m('Seo Park', 'JP-No+BG.png')).toHaveLength(1)
    expect(m('Kai-Di Peng', 'KD-+no+BG.png')).toEqual([])
    expect(m('Noor Tee', 'TDA_NoorDSC01382-C.jpg')).toEqual([])
    expect(m('Hy Hwang', 'Hy+Hwang1_Temporary_LS+copy.jpg')[0]).toMatch(/temporary/)
  })
})

describe('pnpm migrate:people', () => {
  let payload: Payload
  const prefix = `zz-team-${Date.now()}`

  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  afterAll(async () => {
    const people = await payload.find({ collection: 'people', where: { name: { like: prefix } }, draft: true, pagination: false, depth: 0 })
    await payload.delete({ collection: 'people', where: { name: { like: prefix } } })
    for (const p of people.docs) if (p.headshot) await payload.delete({ collection: 'media', id: typeof p.headshot === 'object' ? p.headshot.id : p.headshot })
  })

  it('creates and publishes the team with headshots, keeping what an editor already set', async () => {
    const png = await sharp({ create: { width: 30, height: 40, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer()
    const fetchImpl = async () => ({ ok: true, status: 200, headers: { get: () => 'image/png' }, arrayBuffer: async () => png.buffer.slice(png.byteOffset, png.byteOffset + png.length) as ArrayBuffer })
    await payload.create({ collection: 'people', draft: true, data: { name: `${prefix} Kept Title`, title: 'Principal', showOnSite: false } as never })
    const team = [
      { name: `${prefix} New Person`, title: 'Designer', group: 'design' as const, order: 1, headshot: 'https://i.example/NP-No+BG.png' },
      { name: `${prefix} Kept Title`, title: 'Senior Principal', group: 'leadership' as const, order: 2, headshot: 'https://i.example/KT.png' },
    ]
    const dry = await applyTeam(payload, team, { write: false, publish: true, fetchImpl })
    expect(dry.log).toHaveLength(2)
    expect((await payload.count({ collection: 'people', where: { name: { equals: `${prefix} New Person` } } })).totalDocs).toBe(0)

    const { review } = await applyTeam(payload, team, { write: true, publish: true, fetchImpl })
    const visible = await payload.find({ collection: 'people', overrideAccess: false, where: { name: { like: prefix } }, sort: 'name', depth: 1 })
    expect(visible.docs.map((p) => [p.name, p.title, p.group])).toEqual([
      [`${prefix} Kept Title`, 'Principal', 'leadership'],
      [`${prefix} New Person`, 'Designer', 'design'],
    ])
    const headshot = visible.docs[1].headshot as { mimeType?: string; alt?: string }
    expect(headshot).toMatchObject({ mimeType: 'image/png', alt: `${prefix} New Person` })
    expect(review.map((r) => r.field)).toContain('title')

    // A second run changes nothing.
    expect((await applyTeam(payload, team, { write: true, publish: true, fetchImpl })).log).toEqual([])
  })
})
