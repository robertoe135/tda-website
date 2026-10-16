import { parse } from 'node-html-parser'
import { describe, expect, it } from 'vitest'

import { roleFor } from '../../scripts/migrate/credit-labels'
import { parseCredits, parseLocation, parseProjectPage } from '../../scripts/migrate/extract'

describe('parseLocation', () => {
  it('reads US city and state', () => {
    expect(parseLocation('New York, NY')).toEqual({
      asWritten: 'New York, NY',
      city: 'New York',
      region: 'NY',
      country: 'United States',
    })
  })
  it('keeps a non-US country exactly as written', () => {
    expect(parseLocation('London, UK')).toEqual({ asWritten: 'London, UK', city: 'London', country: 'UK' })
  })
})

describe('credit labels', () => {
  it('maps spelling variants to one role', () => {
    expect(roleFor('Architect on Record')).toBe('architectOfRecord')
    expect(roleFor('Architect of Record')).toBe('architectOfRecord')
    expect(roleFor('Photos')).toBe('photography')
    expect(roleFor('Something New')).toBe('unmapped')
  })
})

describe('parseCredits', () => {
  const text = [
    'One Vanderbilt',
    'Location: New York, NY',
    'Project Completed: 2021',
    'Design Architect: Kohn Pederson Fox',
    'Owner: Example Owner',
    'Photography: Max Touhey / Michael Moran- OTTO',
    'Consultants:',
    'Engineer: Jaros Baum & Bolles',
    'Design Architect: REX | Rockwell Group',
    'Awards:',
    '2023 IES Illumination Award of Merit',
    '2023 LIT Award Honorable Mention',
  ]
  const c = parseCredits(text)

  it('reads facts without correcting spellings', () => {
    expect(c.name).toBe('One Vanderbilt')
    expect(c.completed).toBe('2021')
    expect(c.location?.region).toBe('NY')
    expect(c.entries.find((e) => e.role === 'designArchitect')?.value).toBe('Kohn Pederson Fox')
  })
  it('splits photographers but never splits a firm on &', () => {
    expect(c.photography).toEqual(['Max Touhey', 'Michael Moran- OTTO'])
    expect(c.entries.find((e) => e.label === 'Engineer')?.values).toEqual(['Jaros Baum & Bolles'])
  })
  it('splits firms listed with a pipe', () => {
    expect(c.entries.filter((e) => e.role === 'designArchitect')[1].values).toEqual(['REX', 'Rockwell Group'])
  })
  it('reads awards with their year', () => {
    expect(c.awards).toEqual([
      { year: 2023, text: 'IES Illumination Award of Merit' },
      { year: 2023, text: 'LIT Award Honorable Mention' },
    ])
  })
})

describe('parseProjectPage', () => {
  const cdn = 'https://images.squarespace-cdn.com/content/v1/x'
  const context = JSON.stringify({
    userItems: [
      { title: '"A headline"', description: '<p><a href="https://example.com/a">The Outlet</a></p>' },
    ],
  }).replace(/"/g, '&quot;')
  const html = `<main>
    <section><h3>One Vanderbilt</h3><p>New York, NY | Kohn Pedersen Fox</p></section>
    <section><div class="gallery-grid-item"><img data-src="${cdn}/One+Vanderbilt_01.jpg" alt="Crown"></div></section>
    <section><p>First paragraph.</p><p>Second paragraph.</p><a href="/one-vanderbilt-full-project-credits">Full Project Stats</a></section>
    <section><div class="user-items-list-carousel__slide"><img data-src="${cdn}/One+Vanderbilt_02.jpg" alt="Lobby"></div></section>
    <section><div class="list-section-title"><p>press</p></div><ul data-current-context="${context}"></ul></section>
    <section><p>Other Projects with Kohn Pedersen Fox</p><div class="sqs-block-image"><img data-src="${cdn}/Other.jpg"></div></section>
  </main>`
  const page = parseProjectPage(parse(html).querySelector('main')!)

  it('splits the old label into location and firms', () => {
    expect(page.name).toBe('One Vanderbilt')
    expect(page.location?.city).toBe('New York')
    expect(page.labelFirms).toEqual(['Kohn Pedersen Fox'])
  })
  it('keeps the description verbatim and stops before the credits link', () => {
    expect(page.description).toEqual(['First paragraph.', 'Second paragraph.'])
    expect(page.creditsPath).toBe('/one-vanderbilt-full-project-credits')
  })
  it('takes hero and gallery images but not related-project thumbnails', () => {
    expect(page.heroImage?.alt).toBe('Crown')
    expect(page.gallery.map((i) => i.filename)).toEqual(['One Vanderbilt_02.jpg'])
  })
  it('reads press items with outlet and link', () => {
    expect(page.press).toEqual([{ title: 'A headline', outlet: 'The Outlet', url: 'https://example.com/a' }])
  })
})
