import { expect, test } from '@playwright/test'

test.describe('Portfolio', () => {
  test('categories are links with their own address; All is chosen by default', async ({ page }) => {
    await page.goto('http://localhost:3000/projects')
    const nav = page.getByRole('navigation', { name: 'Categories' })
    await expect(nav.getByRole('link', { name: 'All' })).toHaveAttribute('aria-current', 'page')
    const second = nav.getByRole('link').nth(1)
    const name = (await second.innerText()).trim()
    await second.click()
    await expect(page).toHaveURL(/\/projects\?typology=/)
    await expect(nav.getByRole('link', { name, exact: true })).toHaveAttribute('aria-current', 'page')
  })

  test('on a phone the category line scrolls by itself, not the page', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('http://localhost:3000/projects')
    const pageWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    expect(pageWidth).toBeLessThanOrEqual(390)
    const nav = page.getByRole('navigation', { name: 'Categories' })
    const overflows = await nav.evaluate((n) => n.scrollWidth > n.clientWidth)
    expect(overflows).toBe(true)
  })
})
