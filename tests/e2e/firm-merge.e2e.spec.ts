import { expect, test } from '@playwright/test'

import { login } from '../helpers/login'
import { cleanupTestUser, seedTestUser, testUser } from '../helpers/seedUser'

// Its own user: other specs run in parallel and remove the shared one when they finish.
const user = { ...testUser, email: 'firm-merge-e2e@payloadcms.com' }
const BASE = 'http://localhost:3000'

test.describe('Merging two firms', () => {
  test.beforeAll(async () => seedTestUser(user))
  test.afterAll(async () => cleanupTestUser(user))

  test('from a firm’s page, with a preview first', async ({ page }) => {
    test.setTimeout(90_000)
    await login({ page, user })
    const tag = `Zephyrine${Date.now().toString(36)}`
    const make = async (name: string) => (await (await page.request.post(`${BASE}/api/firms`, { data: { name } })).json()).doc as { id: number; name: string }
    const keep = await make(`${tag} Partners`)
    const dupe = await make(`${tag} Partners Architects LLP`)
    try {
      // A firm's page: find the other record by name, check, merge.
      await page.goto(`${BASE}/admin/collections/firms/${keep.id}`)
      await page.getByRole('searchbox', { name: 'Search firms and clients by name' }).fill(`${tag} Partners`)
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
      expect((await page.request.get(`${BASE}/api/firms/${dupe.id}`)).status()).toBe(404)
      const kept = await (await page.request.get(`${BASE}/api/firms/${keep.id}`)).json()
      expect(kept.aliases.map((a: { name: string }) => a.name)).toEqual([dupe.name])
    } finally {
      for (const f of [keep, dupe]) await page.request.delete(`${BASE}/api/firms/${f.id}`)
    }
  })
})
