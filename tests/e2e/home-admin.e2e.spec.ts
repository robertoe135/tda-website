import { expect, test } from '@playwright/test'

import { login } from '../helpers/login'
import { cleanupTestUser, seedTestUser, testUser } from '../helpers/seedUser'

test.describe('Homepage and videos in the admin', () => {
  test.beforeAll(async () => {
    await seedTestUser()
  })
  test.afterAll(async () => {
    await cleanupTestUser()
  })

  test('the Homepage editor shows rows with a layout', async ({ page }) => {
    await login({ page, user: testUser })
    await page.goto('http://localhost:3000/admin/globals/home')
    await expect(page.getByText('Rows', { exact: false }).first()).toBeVisible()
    await expect(page.locator('[id^="field-rows__0__layout"], [id*="rows"]').first()).toBeVisible()
  })

  test('the Videos library opens and accepts uploads', async ({ page }) => {
    await login({ page, user: testUser })
    await page.goto('http://localhost:3000/admin/collections/videos/create')
    await expect(page.locator('input[type="file"]').first()).toBeAttached()
    await expect(page.getByText('Still image').first()).toBeVisible()
  })
})
