import { describe, expect, it, vi } from 'vitest'

import { guardFetch, HEIC_REFUSED, isMediaSave, NO_ANSWER, TOO_LARGE } from '@/lib/upload-guard'
import { fitInside } from '@/lib/upload-limits'

const photo = (name = 'IMG_1234.jpg', type = 'image/jpeg', bytes = 10) => new File([new Uint8Array(bytes)], name, { type })
const form = (file: File) => {
  const f = new FormData()
  f.append('_payload', JSON.stringify({ alt: 'Lobby' }))
  f.append('file', file, file.name)
  return f
}
const json = (body: unknown, status = 201) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const small = photo('small.jpg', 'image/jpeg', 3)
const shrink = vi.fn(async () => small)

describe('photo uploads in the admin', () => {
  it('fits a photo inside 3000 px on its longest side, never enlarging it', () => {
    expect(fitInside(6000, 4000)).toEqual({ width: 3000, height: 2000 })
    expect(fitInside(3024, 4032)).toEqual({ width: 2250, height: 3000 })
    expect(fitInside(1200, 800)).toEqual({ width: 1200, height: 800 })
  })

  it('recognises saves to the Images collection only', () => {
    expect(isMediaSave('/api/media?depth=0', 'POST', '/api')).toBe(true)
    expect(isMediaSave('https://tda.test/api/media/12?locale=en', 'PATCH', '/api')).toBe(true)
    expect(isMediaSave('/api/media', 'GET', '/api')).toBe(false)
    expect(isMediaSave('/api/media/12/preview', 'POST', '/api')).toBe(false)
    expect(isMediaSave('/api/videos', 'POST', '/api')).toBe(false)
    expect(isMediaSave('/api/mediakit', 'POST', '/api')).toBe(false)
  })

  it('sends the shrunk photo and keeps the rest of the form', async () => {
    const sent = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => json({ doc: { id: 1 } }))
    const res = await guardFetch(sent as typeof fetch, { apiRoute: '/api', shrink })('/api/media', { method: 'POST', body: form(photo()) })
    expect(res.status).toBe(201)
    const body = sent.mock.calls[0][1]?.body as FormData
    expect((body.get('file') as File).name).toBe('small.jpg')
    expect(body.get('_payload')).toBe(JSON.stringify({ alt: 'Lobby' }))
  })

  it('leaves every other request alone', async () => {
    const sent = vi.fn(async () => json({ ok: true }, 200))
    const other = new FormData()
    await guardFetch(sent as typeof fetch, { apiRoute: '/api', shrink })('/api/projects/1', { method: 'PATCH', body: other })
    expect((sent.mock.calls[0] as unknown[])[1]).toMatchObject({ body: other })
  })

  it('turns Vercel’s “too large” page and a dropped connection into errors the admin shows, never a false success', async () => {
    const tooLarge = vi.fn(async () => new Response('Request Entity Too Large', { status: 413, headers: { 'Content-Type': 'text/plain' } }))
    const r1 = await guardFetch(tooLarge as typeof fetch, { apiRoute: '/api', shrink })('/api/media', { method: 'POST', body: form(photo()) })
    expect(r1.status).toBe(400)
    expect(await r1.json()).toEqual({ errors: [{ message: TOO_LARGE }] })

    const dropped = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    })
    const r2 = await guardFetch(dropped as typeof fetch, { apiRoute: '/api', shrink })('/api/media', { method: 'POST', body: form(photo()) })
    expect(await r2.json()).toEqual({ errors: [{ message: NO_ANSWER }] })

    // Payload's own errors (missing description, say) pass through as they are.
    const invalid = vi.fn(async () => json({ errors: [{ message: 'The following field is invalid: alt' }] }, 400))
    const r3 = await guardFetch(invalid as typeof fetch, { apiRoute: '/api', shrink })('/api/media', { method: 'POST', body: form(photo()) })
    expect(await r3.json()).toEqual({ errors: [{ message: 'The following field is invalid: alt' }] })
  })

  it('refuses a HEIC photo the browser could not convert, without sending it', async () => {
    const sent = vi.fn()
    const heic = photo('IMG_1.HEIC', 'image/heic')
    const res = await guardFetch(sent as typeof fetch, { apiRoute: '/api', shrink: async (f) => f })('/api/media', { method: 'POST', body: form(heic) })
    expect(sent).not.toHaveBeenCalled()
    expect(await res.json()).toEqual({ errors: [{ message: HEIC_REFUSED }] })
  })
})
