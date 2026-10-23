import { expect, test } from '@playwright/test'

import { login } from '../helpers/login'
import { cleanupTestUser, seedTestUser, testUser } from '../helpers/seedUser'

// Its own user: other specs run in parallel and remove the shared one when they finish.
const user = { ...testUser, email: 'firm-merge-e2e@payloadcms.com' }
const BASE = 'http://localhost:3000'

test.describe('Merging duplicate firms', () => {
  test.beforeAll(async () => seedTestUser(user))
  test.afterAll(async () => cleanupTestUser(user))

  test('from the list and from a firm’s page, with a preview first', async ({ page }) => {
    test.setTimeout(90_000)
    await login({ page, user })
    const tag = `Zephyrine${Date.now().toString(36)}`
    const make = async (name: string) => (await (await page.request.post(`${BASE}/api/firms`, { data: { name } })).json()).doc as { id: number; name: string }
    const keep = await make(`${tag} Partners`)
    const dupe = await make(`${tag} Partners Architects LLP`)
    const third = await make(`${tag} Partners Inc.`)
    try {
      // The list: pick which to keep.
      await page.goto(`${BASE}/admin/collections/firms`)
      await page.getByRole('button', { name: 'Find possible duplicates' }).click()
      const row = page
        .getByRole('row')
        .filter({ has: page.getByRole('link', { name: dupe.name, exact: true }) })
        .filter({ has: page.getByRole('link', { name: keep.name, exact: true }) })
      await row.getByRole('button', { name: `Keep ${keep.name}`, exact: true }).click()
      await expect(row.getByText(`Keep ${keep.name}; remove ${dupe.name}.`)).toBeVisible()
      await expect(row.getByText('No project names')).toBeVisible()
      await row.getByRole('button', { name: `Merge into ${keep.name}`, exact: true }).click()
      await expect(page.getByText(`Merged ${dupe.name} into ${keep.name}.`)).toBeVisible()
      expect((await page.request.get(`${BASE}/api/firms/${dupe.id}`)).status()).toBe(404)

      // A firm's page: suggestions, then merge one in.
      await page.goto(`${BASE}/admin/collections/firms/${keep.id}`)
      await page.getByRole('button', { name: 'Find likely duplicates' }).click()
      await page
        .getByRole('listitem')
        .filter({ has: page.getByRole('link', { name: third.name, exact: true }) })
        .getByRole('button', { name: 'Merge in' })
        .click()
      await page.getByRole('button', { name: `Merge into ${keep.name}`, exact: true }).click()
      await expect(page.getByText(`Merged ${third.name} into this record.`)).toBeVisible()
      const kept = await (await page.request.get(`${BASE}/api/firms/${keep.id}`)).json()
      expect(kept.aliases.map((a: { name: string }) => a.name)).toEqual([dupe.name, third.name])
    } finally {
      for (const f of [keep, dupe, third]) await page.request.delete(`${BASE}/api/firms/${f.id}`)
    }
  })
})
