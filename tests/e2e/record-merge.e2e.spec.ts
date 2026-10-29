import { expect, test } from '@playwright/test'

import { login } from '../helpers/login'
import { cleanupTestUser, seedTestUser, testUser } from '../helpers/seedUser'

// Its own user: other specs run in parallel and remove the shared one when they finish.
const user = { ...testUser, email: 'record-merge-e2e@payloadcms.com' }
const BASE = 'http://localhost:3000'

const KINDS = [
  { collection: 'firms', plural: 'firms', alias: true },
  { collection: 'clients', plural: 'clients', alias: false },
  { collection: 'photographers', plural: 'photographers', alias: false },
] as const

test.describe('Merging two records of one firm, client or photographer', () => {
  test.beforeAll(async () => seedTestUser(user))
  test.afterAll(async () => cleanupTestUser(user))

  for (const kind of KINDS)
    test(`from a record’s page in ${kind.collection}, with a preview first`, async ({ page }) => {
      test.setTimeout(90_000)
      await login({ page, user })
      const tag = `Zephyrine${Date.now().toString(36)}`
      const api = `${BASE}/api/${kind.collection}`
      const make = async (name: string) => (await (await page.request.post(api, { data: { name } })).json()).doc as { id: number; name: string }
      const keep = await make(`${tag} Partners`)
      const dupe = await make(`${tag} Partners Studio LLP`)
      try {
        // Find the other record by name, check, merge.
        await page.goto(`${BASE}/admin/collections/${kind.collection}/${keep.id}`)
        await page.getByRole('searchbox', { name: `Search ${kind.plural} by name` }).fill(`${tag} Partners`)
        await page.getByRole('button', { name: 'Search', exact: true }).click()
        await page
          .getByRole('listitem')
          .filter({ has: page.getByRole('link', { name: dupe.name, exact: true }) })
          .getByRole('button', { name: 'Merge in' })
          .click()
        await expect(page.getByText(`Keep ${keep.name}; remove ${dupe.name}.`)).toBeVisible()
        await expect(page.getByText('No project names')).toBeVisible()
        await page.getByRole('button', { name: `Merge into ${keep.name}`, exact: true }).click()
        await expect(page.getByText(`Merged ${dupe.name} into this record.`)).toBeVisible()
        expect((await page.request.get(`${api}/${dupe.id}`)).status()).toBe(404)
        if (kind.alias) {
          const kept = await (await page.request.get(`${api}/${keep.id}`)).json()
          expect(kept.aliases.map((a: { name: string }) => a.name)).toEqual([dupe.name])
        }
      } finally {
        for (const f of [keep, dupe]) await page.request.delete(`${api}/${f.id}`)
      }
    })
})
