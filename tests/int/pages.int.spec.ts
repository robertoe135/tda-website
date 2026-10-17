import { parse } from 'node-html-parser'
import { getPayload, Payload } from 'payload'
import config from '@/payload.config'
import type { Home } from '@/payload-types'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { parseAbout, parseContact, parseHomeRows, parseTimeline } from '../../scripts/migrate/pages'

const main = (html: string) => parse(`<main>${html}</main>`).querySelector('main')!

describe('old page parsers', () => {
  it('rebuilds homepage rows from the old grid: pairs, layouts, quotes and videos', () => {
    const area = (id: string, a: string) => `\n  @media (min-width: 768px) {\n    .fe-block-${id} {\n      grid-area: ${a};\n    }\n  }\n`
    const block = (id: string, inner: string) => `<div class="fe-block fe-block-${id}">${inner}</div>`
    const video = `<div data-config-video='{"alexandriaUrl":"https://video.example/v/{variant}"}'></div>`
    const html = `<html><head><style>${[
      area('a', '1/2/13/15'), area('b', '1/2/12/15'), area('q', '2/16/10/25'),
      area('c', '13/2/20/10'), area('d', '13/2/20/10'), area('e', '13/10/20/18'), area('f', '13/10/20/18'), area('g', '13/18/20/26'), area('h', '13/18/20/26'),
      area('i', '22/2/34/12'), area('j', '22/2/34/12'),
    ].join('')}</style></head><body><main>${[
      block('a', video), block('b', '<p><a href="/x/pac">PAC</a></p>'), block('q', '<h3>“Light is intentional.”</h3><p>-[Person]</p>'),
      block('c', '<img src="x">'), block('d', '<a href="/x/one">One</a>'), block('e', '<a href="/x/elsewhere"><img src="x"></a>'), block('f', '<a href="/x/two">Two</a>'),
      block('g', '<img src="x">'), block('h', '<a href="/x/three">Three</a>'),
      block('i', '<img src="x">'), block('j', '<a href="/x/four">Four</a>'),
    ].join('')}</main></body></html>`
    const rows = parseHomeRows(html)
    expect(rows.map((r) => r.layout)).toEqual(['wide-narrow', 'three', 'one'])
    // Photo heights from the grid: 12 rows is about a third of the width, 7 rows a fifth.
    expect(rows.map((r) => r.height)).toEqual(['taller', 'low', 'taller'])
    expect(rows[0].items).toEqual([
      { kind: 'project', path: '/x/pac', name: 'PAC', video: 'https://video.example/v/1920:1080', imagePath: undefined },
      { kind: 'quote', text: 'Light is intentional.', attribution: '[Person]' },
    ])
    // The name's link wins over a photo that links elsewhere; the mismatch is kept for review.
    expect(rows[1].items[1]).toMatchObject({ path: '/x/two', imagePath: '/x/elsewhere' })
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

  const texts = (home: Home) => (home.rows ?? []).flatMap((r) => (r.items ?? []).map((i) => (i.blockType === 'quote' ? i.text : '')))

  it('refuses a row whose items do not fit its layout', async () => {
    const error = await payload
      .updateGlobal({ slug: 'home', data: { rows: [{ layout: 'three', items: [{ blockType: 'quote', text: 'x', attribution: 'y' }] }], _status: 'published' } })
      .catch((e: { data?: { errors?: { message: string }[] } }) => e)
    expect((error as { data?: { errors?: { message: string }[] } }).data?.errors?.[0]?.message).toMatch(/holds 3 items; this row has 1/)
  })

  it('shows visitors the published homepage, never a newer draft', async () => {
    await payload.updateGlobal({ slug: 'home', data: { rows: [{ layout: 'one', items: [{ blockType: 'quote', text: 'Published', attribution: 'A' }] }], _status: 'published' } })
    await payload.updateGlobal({ slug: 'home', data: { rows: [{ layout: 'one', items: [{ blockType: 'quote', text: 'Draft', attribution: 'B' }] }] }, draft: true })
    const anon = await payload.findGlobal({ slug: 'home', overrideAccess: false })
    expect(texts(anon)).toEqual(['Published'])
    const asDraft = await payload.findGlobal({ slug: 'home', overrideAccess: false, draft: true })
    expect(texts(asDraft)).not.toContain('Draft')
  })
})
