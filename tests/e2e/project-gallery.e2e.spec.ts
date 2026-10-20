import { expect, test } from '@playwright/test'
import sharp from 'sharp'

import { login } from '../helpers/login'
import { cleanupTestUser, seedTestUser, testUser } from '../helpers/seedUser'

// Its own user: other specs run in parallel and remove the shared one when they finish.
const user = { ...testUser, email: 'gallery-e2e@payloadcms.com' }
const BASE = 'http://localhost:3000'

test.describe('Project gallery', () => {
  test.beforeAll(async () => seedTestUser(user))
  test.afterAll(async () => cleanupTestUser(user))

  test('several photos are added at once, each with its description, in the order chosen', async ({ page }) => {
    await login({ page, user })
    const res = await page.request.post(`${BASE}/api/projects?draft=true`, { data: { name: 'E2E gallery', _status: 'draft' } })
    const id = (await res.json()).doc.id
    const photos = await Promise.all(
      ['#c33', '#3c3', '#33c'].map(async (background, i) => ({
        name: `photo${i + 1}.jpg`,
        mimeType: 'image/jpeg',
        buffer: await sharp({ create: { width: 400, height: 300, channels: 3, background } }).jpeg().toBuffer(),
      })),
    )
    try {
      await page.goto(`${BASE}/admin/collections/projects/${id}`)
      await page.getByRole('button', { name: 'Images' }).click()
      await page.setInputFiles('input[type=file][multiple]', photos)
      for (let i = 1; i <= 3; i++) {
        await page.locator('#field-alt').fill(`E2E gallery photo ${i}`)
        if (i < 3) await page.locator('.bulk-upload--actions-bar__controls button').nth(1).click()
      }
      await page.getByRole('button', { name: 'Save', exact: true }).last().click()
      await expect(page.getByText('Image 03')).toBeVisible({ timeout: 30000 })
      await page.getByRole('button', { name: /Save Draft/ }).click()
      await expect
        .poll(async () => {
          const doc = await (await page.request.get(`${BASE}/api/projects/${id}?draft=true&depth=1`)).json()
          return (doc.gallery ?? []).map((g: { image: { alt: string } }) => g.image.alt)
        })
        .toEqual(['E2E gallery photo 1', 'E2E gallery photo 2', 'E2E gallery photo 3'])
    } finally {
      const doc = await (await page.request.get(`${BASE}/api/projects/${id}?draft=true&depth=0`)).json()
      await page.request.delete(`${BASE}/api/projects/${id}`)
      for (const g of doc.gallery ?? []) await page.request.delete(`${BASE}/api/media/${g.image}`)
    }
  })
})
