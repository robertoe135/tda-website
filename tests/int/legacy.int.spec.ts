import { getPayload, Payload } from 'payload'
import config from '@/payload.config'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { resolveLegacyPath } from '@/lib/legacy'

let payload: Payload
const prefix = `zz-legacy-${Date.now()}`

beforeAll(async () => {
  payload = await getPayload({ config: await config })
})

afterAll(async () => {
  await payload.delete({ collection: 'projects', where: { name: { like: prefix } } })
})

describe('old Squarespace addresses', () => {
  it('send a project page and its credits page to the project, in any case, with or without a slash', async () => {
    const project = await payload.create({
      collection: 'projects',
      data: {
        name: `${prefix} Hall`,
        status: 'completed',
        _status: 'published',
        legacyUrls: [{ path: `/museums/${prefix}-hall` }, { path: `/${prefix}-hall-full-project-credits` }],
      },
    })
    expect(await resolveLegacyPath(`/museums/${prefix}-hall`)).toBe(`/projects/${project.slug}`)
    expect(await resolveLegacyPath(`/${prefix}-hall-full-project-credits/`)).toBe(`/projects/${project.slug}`)
    expect(await resolveLegacyPath(`/Museums/${prefix.toUpperCase()}-Hall`)).toBe(`/projects/${project.slug}`)
  })

  it('never point at a project that is not published', async () => {
    await payload.create({
      collection: 'projects',
      data: { name: `${prefix} Draft`, legacyUrls: [{ path: `/academic/${prefix}-draft` }] },
      draft: true,
    })
    expect(await resolveLegacyPath(`/academic/${prefix}-draft`)).toBeUndefined()
  })

  it('open category pages as the filtered portfolio, and leave unknown addresses alone', async () => {
    const typology = (await payload.find({ collection: 'typologies', limit: 1 })).docs[0]
    if (typology?.slug) expect(await resolveLegacyPath(`/${typology.slug}`)).toBe(`/projects?typology=${typology.slug}`)
    expect(await resolveLegacyPath('/on-the-boards')).toBe('/projects?status=in-progress')
    expect(await resolveLegacyPath(`/${prefix}-nothing`)).toBeUndefined()
  })
})
