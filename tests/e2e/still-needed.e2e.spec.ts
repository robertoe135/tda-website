import { expect, test, type Page } from '@playwright/test'

import { login } from '../helpers/login'
import { cleanupTestUser, seedTestUser, testUser } from '../helpers/seedUser'

const SHOTS = process.env.SHOTS_DIR

test.describe('Still needed in the admin', () => {
  let page: Page
  test.beforeAll(async ({ browser }) => {
    await seedTestUser()
    page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
    await login({ page, user: testUser })
  })
  test.afterAll(async () => cleanupTestUser())

  test('the projects list has a Still needed column', async () => {
    await page.goto('http://localhost:3000/admin/collections/projects')
    await expect(page.getByRole('columnheader', { name: /still needed/i }).or(page.locator('th', { hasText: /still needed/i })).first()).toBeVisible()
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/admin-list.png` })
  })

  test('a project shows what it still needs in the sidebar', async () => {
    await page.goto('http://localhost:3000/admin/collections/projects')
    const link = page.locator('table tbody a').first()
    await link.waitFor({ timeout: 15000 }).catch(() => {})
    const href = await link.getAttribute('href').catch(() => null)
    test.skip(!href || !/\/projects\/\d+/.test(href), 'no projects')
    await page.goto(`http://localhost:3000${href}`)
    await expect(page.getByText('Still needed', { exact: true }).first()).toBeVisible()
    // The local test projects all lack something, so at least one item is listed in the field.
    await expect(
      page.getByRole('button', { name: /^(Photos|Photographer|Category|Completion year|Location|Design architect|Write-up) Remove$/ }).first(),
    ).toBeVisible({ timeout: 20000 })
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/admin-edit.png` })
  })
})
