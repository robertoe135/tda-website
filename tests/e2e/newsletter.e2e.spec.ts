import { expect, test, type Page } from '@playwright/test'

import { login } from '../helpers/login'
import { cleanupTestUser, seedTestUser, testUser } from '../helpers/seedUser'

// Its own user: the admin spec runs in parallel and removes the shared one when it finishes.
const user = { ...testUser, email: 'newsletter-e2e@payloadcms.com' }

const BASE = 'http://localhost:3000'
const SHOTS = process.env.NEWSLETTER_SHOTS // a folder: save screenshots there (manual checks)

test.describe('Newsletter', () => {
  let page: Page
  let id: number | undefined

  test.beforeAll(async ({ browser }) => {
    await seedTestUser(user)
    page = await (await browser.newContext({ viewport: { width: 1440, height: 1000 } })).newPage()
    await login({ page, user })
  })

  test.afterAll(async () => {
    if (id) await page.request.delete(`${BASE}/api/newsletters/${id}`)
    await cleanupTestUser(user)
  })

  test('an issue is built from the site’s projects, previewed, and kept private until sent', async ({
    browser,
  }) => {
    const projects = await (
      await page.request.get(
        `${BASE}/api/projects?where[_status][equals]=published&limit=3&depth=0`,
      )
    ).json()
    test.skip(projects.docs.length < 3, 'needs published projects in the local database')
    const [a, b, c] = projects.docs
    const awards = await (await page.request.get(`${BASE}/api/awards?limit=2&depth=0`)).json()
    const press = await (await page.request.get(`${BASE}/api/press?limit=2&depth=0`)).json()

    const res = await page.request.post(`${BASE}/api/newsletters`, {
      data: {
        subject: 'E2E test issue',
        masthead: 'Test journal',
        issueNumber: 1,
        season: 'Autumn 2026',
        content: [
          {
            blockType: 'letter',
            body: 'First paragraph.\n\nSecond paragraph.',
            signatureName: 'A. Person',
          },
          { blockType: 'section', title: 'Recent work' },
          { blockType: 'project', project: a.id, showCredits: true },
          { blockType: 'section', title: 'In progress' },
          { blockType: 'projectGrid', projects: [b.id, c.id] },
          { blockType: 'section', title: 'Conversation' }, // nothing under it: dropped
          { blockType: 'conversation' },
          { blockType: 'section', title: 'Recognition' },
          { blockType: 'awards', awards: awards.docs.map((d: { id: number }) => d.id) },
          { blockType: 'press', items: press.docs.map((d: { id: number }) => d.id) },
        ],
      },
    })
    expect(res.ok()).toBe(true)
    id = (await res.json()).doc.id

    // The preview: the project's name, sections renumbered without the empty Conversation.
    await page.goto(`${BASE}/newsletter-preview/${id}`)
    const email = page.frameLocator('iframe[title="Newsletter preview"]')
    await expect(email.getByText(a.name).first()).toBeVisible()
    await expect(email.getByText(b.name).first()).toBeVisible()
    await expect(email.getByText('Second paragraph.')).toBeVisible()
    await expect(email.getByText('Conversation')).toHaveCount(0)
    await expect(email.getByText('03', { exact: true })).toBeVisible() // Recognition is the third section
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/nl-preview.png`, fullPage: true })

    // The admin: the issue's sidebar says what sending still needs.
    await page.goto(`${BASE}/admin/collections/newsletters/${id}`)
    await expect(page.getByText('Send a test to')).toBeVisible()
    await expect(page.getByRole('button', { name: /Send a test/ })).toBeVisible()
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/nl-admin.png` })

    // Not logged in: no preview, and an unsent issue has no public page.
    const anon = await (await browser.newContext()).newPage()
    expect((await anon.goto(`${BASE}/newsletter-preview/${id}`))?.status()).toBe(404)
    expect((await anon.request.get(`${BASE}/newsletter/${id}`)).status()).toBe(404)
    expect((await anon.request.get(`${BASE}/api/newsletters/${id}`)).status()).toBe(403)
    expect((await anon.request.post(`${BASE}/api/newsletters/${id}/send`)).status()).not.toBe(200)
  })

  test('a new issue starts from the agreed layout', async () => {
    await page.goto(`${BASE}/admin/collections/newsletters/create`)
    for (const block of [
      'Letter',
      'Section heading',
      'Projects, two across',
      'Conversation',
      'Awards',
      'Press',
      'Talks and events',
    ])
      await expect(page.getByText(block, { exact: true }).first()).toBeVisible()
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/nl-create.png`, fullPage: true })
  })
})
