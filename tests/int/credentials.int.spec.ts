import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { badgesOf, getTeam } from '@/lib/site'
import config from '@/payload.config'

describe('credential badges', () => {
  it('keeps the person’s order and skips anything without an address', () => {
    expect(
      badgesOf([
        { id: 1, name: 'LEED AP', slug: 'leed-ap' },
        { id: 2, name: 'CLD', slug: 'cld', fullName: 'Certified Lighting Designer' },
        3,
        { id: 4, name: 'No slug' },
      ]),
    ).toEqual([
      { name: 'LEED AP', slug: 'leed-ap', fullName: undefined },
      { name: 'CLD', slug: 'cld', fullName: 'Certified Lighting Designer' },
    ])
    expect(badgesOf(undefined)).toEqual([])
  })

  describe('on the team page', () => {
    let payload: Payload
    const tag = `zb${Date.now().toString(36)}`
    let slug: string

    beforeAll(async () => {
      payload = await getPayload({ config })
      const credential = await payload.create({ collection: 'credentials', data: { name: `${tag} CLD`, fullName: 'Full name' } })
      slug = credential.slug!
      await payload.create({ collection: 'people', data: { name: `${tag} Holder`, showOnSite: true, isCurrent: true, credentials: [credential.id], _status: 'published' } as never })
      await payload.create({ collection: 'people', data: { name: `${tag} Other`, showOnSite: true, isCurrent: true, _status: 'published' } as never })
      await payload.create({ collection: 'people', data: { name: `${tag} Hidden`, showOnSite: false, isCurrent: true, credentials: [credential.id], _status: 'published' } as never })
    })

    afterAll(async () => {
      await payload.delete({ collection: 'people', where: { name: { like: tag } } })
      await payload.delete({ collection: 'credentials', where: { name: { like: tag } } })
    })

    it('shows each person’s badges, and a badge filters the team to those who hold it', async () => {
      const everyone = (await getTeam()).flatMap((g) => g.people).filter((p) => p.name.startsWith(tag))
      expect(everyone.map((p) => [p.name, p.credentials.map((c) => c.name)])).toEqual([
        [`${tag} Holder`, [`${tag} CLD`]],
        [`${tag} Other`, []],
      ])
      const holders = (await getTeam(slug)).flatMap((g) => g.people).map((p) => p.name)
      expect(holders).toEqual([`${tag} Holder`]) // never someone with "Show on site" off
    })
  })
})
