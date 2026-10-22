import { expect, test } from '@playwright/test'
import sharp from 'sharp'

import { login } from '../helpers/login'
import { cleanupTestUser, seedTestUser, testUser } from '../helpers/seedUser'

// Its own user: other specs run in parallel and remove the shared one when they finish.
const user = { ...testUser, email: 'gallery-e2e@payloadcms.com' }
const BASE = 'http://localhost:3000'
// Vercel refuses any request over 4.5 MB before Payload sees it; the local server does not.
const VERCEL_LIMIT = 4.5 * 1024 * 1024

/** A camera-sized photo, far over the limit: 6000 × 4000 px, about 17 MB. */
async function cameraPhoto(name: string) {
  const w = 1500
  const h = 1000
  const raw = Buffer.alloc(w * h * 3)
  for (let i = 0; i < raw.length; i++) raw[i] = (Math.random() * 255) | 0
  const buffer = await sharp(raw, { raw: { width: w, height: h, channels: 3 } }).resize(6000, 4000, { kernel: 'cubic' }).jpeg({ quality: 97 }).toBuffer()
  return { name, mimeType: 'image/jpeg', buffer }
}

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

  test('photos over the 4.5 MB limit are shrunk as they upload and saved', async ({ page }) => {
    test.setTimeout(120_000)
    await login({ page, user })
    const sizes: number[] = []
    await page.route('**/api/media**', async (route) => {
      const req = route.request()
      // Uploads only: the admin also POSTs queries here (as GET overrides).
      if (req.method() !== 'POST' || !req.headers()['content-type']?.startsWith('multipart/form-data')) return route.continue()
      const size = req.postDataBuffer()?.length ?? 0
      sizes.push(size)
      if (size > VERCEL_LIMIT) return route.fulfill({ status: 413, contentType: 'text/plain', body: 'Request Entity Too Large' })
      return route.continue()
    })
    const res = await page.request.post(`${BASE}/api/projects?draft=true`, { data: { name: `E2E large photos ${Date.now()}`, _status: 'draft' } })
    const id = (await res.json()).doc.id
    const photos = [await cameraPhoto('big1.jpg'), await cameraPhoto('big2.jpg')]
    expect(photos.every((p) => p.buffer.length > VERCEL_LIMIT)).toBe(true)
    try {
      await page.goto(`${BASE}/admin/collections/projects/${id}`)
      await page.getByRole('button', { name: 'Images' }).click()
      await page.setInputFiles('input[type=file][multiple]', photos)
      for (let i = 1; i <= 2; i++) {
        await page.locator('#field-alt').fill(`E2E large photo ${i}`)
        if (i < 2) await page.locator('.bulk-upload--actions-bar__controls button').nth(1).click()
      }
      await page.getByRole('button', { name: 'Save', exact: true }).last().click()
      await expect(page.getByText('Image 02')).toBeVisible({ timeout: 60000 })
      expect(sizes.length).toBe(2)
      expect(sizes.every((s) => s <= VERCEL_LIMIT)).toBe(true)
      await page.getByRole('button', { name: /Save Draft/ }).click()
      await expect
        .poll(async () => {
          const doc = await (await page.request.get(`${BASE}/api/projects/${id}?draft=true&depth=1`)).json()
          return (doc.gallery ?? []).map((g: { image: { alt: string; width: number; height: number } }) => [g.image.alt, g.image.width, g.image.height])
        })
        .toEqual([
          ['E2E large photo 1', 3000, 2000],
          ['E2E large photo 2', 3000, 2000],
        ])
    } finally {
      const doc = await (await page.request.get(`${BASE}/api/projects/${id}?draft=true&depth=0`)).json()
      await page.request.delete(`${BASE}/api/projects/${id}`)
      for (const g of doc.gallery ?? []) await page.request.delete(`${BASE}/api/media/${g.image}`)
    }
  })

  test('a photo the server refuses is reported as not saved, never as saved', async ({ page }) => {
    test.setTimeout(90_000)
    await login({ page, user })
    await page.route('**/api/media**', (route) =>
      route.request().method() === 'POST' && route.request().headers()['content-type']?.startsWith('multipart/form-data') ? route.fulfill({ status: 413, contentType: 'text/plain', body: 'Request Entity Too Large' }) : route.continue(),
    )
    const res = await page.request.post(`${BASE}/api/projects?draft=true`, { data: { name: `E2E refused photo ${Date.now()}`, _status: 'draft' } })
    const id = (await res.json()).doc.id
    try {
      await page.goto(`${BASE}/admin/collections/projects/${id}`)
      await page.getByRole('button', { name: 'Images' }).click()
      await page.setInputFiles('input[type=file][multiple]', [
        { name: 'refused.jpg', mimeType: 'image/jpeg', buffer: await sharp({ create: { width: 400, height: 300, channels: 3, background: '#c33' } }).jpeg().toBuffer() },
      ])
      await page.locator('#field-alt').fill('E2E refused photo')
      await page.getByRole('button', { name: 'Save', exact: true }).last().click()
      await expect(page.getByText('Failed to save 1 files')).toBeVisible({ timeout: 30000 })
      await expect(page.getByText(/still too large to upload/)).toBeVisible()
      await expect(page.getByText(/Successfully saved/)).toHaveCount(0)
    } finally {
      await page.request.delete(`${BASE}/api/projects/${id}`)
    }
  })
})
