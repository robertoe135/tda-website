import { parse } from 'node-html-parser'
import { getPayload, Payload } from 'payload'
import config from '@/payload.config'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { parseAbout, parseContact, parseHome, parseTimeline } from '../../scripts/migrate/pages'

const main = (html: string) => parse(`<main>${html}</main>`).querySelector('main')!

describe('old page parsers', () => {
  it('keeps homepage projects and quotes in page order, once each', () => {
    const items = parseHome(
      main(`<a href="/a/one"><img></a><a href="/a/one">One</a>
        <h3>“Light is intentional.”</h3><p>-[Person]</p>
        <a href="https://www.tillotsondesign.com/b/two/">Two</a>`),
    )
    expect(items).toEqual([
      { kind: 'project', path: '/a/one' },
      { kind: 'quote', text: 'Light is intentional.', attribution: '[Person]' },
      { kind: 'project', path: '/b/two' },
    ])
  })

  it('reads About sections word for word', () => {
    expect(parseAbout(main('<h2>Philosophy</h2><p>We  seek.</p><p>We aim.</p><h2>Empty</h2>'))).toEqual([
      { heading: 'Philosophy', paragraphs: ['We seek.', 'We aim.'] },
    ])
  })

  it('pairs each timeline link with its title, where the year heading sits between them', () => {
    const items = parseTimeline(
      main(`<a href="/x/a"></a><h3>2024</h3><p>A</p><a href="/x/b"></a><p>B</p>
        <a href="/x/c"></a><h3>2023</h3><a href="/x/d"></a><p>C</p><p>D</p>`),
    )
    expect(items.map((i) => [i.path, i.year, i.title])).toEqual([
      ['/x/a', 2024, 'A'],
      ['/x/b', 2024, 'B'],
      ['/x/c', 2023, 'C'],
      ['/x/d', 2023, 'D'],
    ])
  })

  it('reads the contact blocks as written', () => {
    expect(
      parseContact(['Intro line.', 'ADDRESS', '40 Worth Street Ste. 703 New York, NY 10013', 'PHONE NUMBER', '212-675-7760', 'info@example.com', 'CAREERS AT TDA', 'We hire.']),
    ).toMatchObject({ intro: 'Intro line.', street: '40 Worth Street', suite: 'Ste. 703', city: 'New York', region: 'NY', postalCode: '10013', phone: '212-675-7760', email: 'info@example.com', careers: 'We hire.' })
  })
})

describe('homepage and About drafts', () => {
  let payload: Payload
  let before: unknown
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    before = await payload.findGlobal({ slug: 'home', draft: true })
  })
  afterAll(async () => {
    await payload.updateGlobal({ slug: 'home', data: before as never, draft: true })
  })

  it('shows visitors the published homepage, never a newer draft', async () => {
    await payload.updateGlobal({ slug: 'home', data: { items: [{ blockType: 'quote', text: 'Published', attribution: 'A' }], _status: 'published' } })
    await payload.updateGlobal({ slug: 'home', data: { items: [{ blockType: 'quote', text: 'Draft', attribution: 'B' }] }, draft: true })
    const anon = await payload.findGlobal({ slug: 'home', overrideAccess: false })
    expect(anon.items?.map((i) => (i.blockType === 'quote' ? i.text : ''))).toEqual(['Published'])
    const asDraft = await payload.findGlobal({ slug: 'home', overrideAccess: false, draft: true })
    expect(asDraft.items?.map((i) => (i.blockType === 'quote' ? i.text : ''))).not.toContain('Draft')
  })
})
