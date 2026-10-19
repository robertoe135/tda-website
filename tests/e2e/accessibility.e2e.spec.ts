import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test } from '@playwright/test'

/**
 * Every kind of public page, checked with axe against WCAG 2.1 A and AA: contrast, labels,
 * headings, landmarks, alt text, link names. Run at desktop and phone width. A failure lists
 * each rule broken and where, so it can be fixed rather than skipped.
 */
const BASE = 'http://localhost:3000'
const FIXED = ['/', '/projects', '/timeline', '/about', '/about/team', '/about/collaborators', '/contact', '/careers', '/no-such-page']

async function firstLink(page: Page, from: string, selector: string) {
  await page.goto(`${BASE}${from}`)
  return page.locator(selector).first().getAttribute('href').catch(() => null)
}

async function check(page: Page, path: string, before?: () => Promise<void>) {
  await page.goto(`${BASE}${path}`)
  if (before) await before()
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  const report = violations.map((v) => `${v.id} (${v.impact}): ${v.help}\n  ${v.nodes.map((n) => n.target.join(' ')).slice(0, 5).join('\n  ')}`)
  expect(report, `${path}\n${report.join('\n')}`).toEqual([])
}

for (const [label, size] of [
  ['desktop', { width: 1280, height: 900 }],
  ['phone', { width: 390, height: 844 }],
] as const) {
  test.describe(`Accessibility (${label})`, () => {
    test.use({ viewport: size })

    for (const path of FIXED) test(path, async ({ page }) => check(page, path))

    test('a category', async ({ page }) => {
      const href = await firstLink(page, '/projects', '.category-nav a:nth-child(2)')
      test.skip(!href, 'no categories with published projects')
      await check(page, href!)
    })

    test('a Year of Light', async ({ page }) => {
      const href = await firstLink(page, '/timeline', 'a.timeline-story')
      test.skip(!href, 'no published Year of Light')
      // Every card lit at once (cards light up as they scroll into view otherwise).
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await check(page, href!)
    })

    test('a project page', async ({ page }) => {
      const href = await firstLink(page, '/projects', '.portfolio-grid a')
      test.skip(!href, 'no published projects')
      await check(page, href!)
    })

    test('a project photo opened full screen', async ({ page }) => {
      const href = await firstLink(page, '/projects', '.portfolio-grid a')
      test.skip(!href, 'no published projects')
      await check(page, href!, async () => {
        const photo = page.locator('.hero-button').first()
        test.skip((await photo.count()) === 0, 'the first project has no photos')
        await photo.click()
        await expect(page.locator('dialog.lightbox')).toBeVisible()
        await page.keyboard.press('ArrowRight')
      })
    })

    test('a person page', async ({ page }) => {
      const href = await firstLink(page, '/about/team', 'a[href^="/about/team/"]')
      test.skip(!href, 'no people shown on the team page')
      await check(page, href!)
    })
  })
}
