import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { addSubscriber } from '@/lib/resend'
import { confirmSignup, readSignupToken, signupToken, startSignup } from '@/lib/subscribe'

type Call = [string, RequestInit]
const resend = (...answers: [number, unknown][]) => {
  const fake = vi.fn(async () => {
    const [status, body] = answers.shift() ?? [200, {}]
    return Response.json(body, { status })
  })
  return fake as unknown as typeof fetch & { mock: { calls: Call[] } }
}

beforeEach(() => {
  vi.stubEnv('PAYLOAD_SECRET', 'test-secret')
  vi.stubEnv('RESEND_API_KEY', 're_test')
  vi.stubEnv('RESEND_SEGMENT_ID', 'seg-1')
  vi.stubEnv('NEWSLETTER_FROM', 'TDA <news@example.com>')
  vi.stubEnv('NEXT_PUBLIC_SERVER_URL', 'https://tda.test')
})
afterEach(() => vi.unstubAllEnvs())

describe('the confirmation link', () => {
  it('carries the address, signed, for 7 days', () => {
    const now = Date.UTC(2026, 9, 19)
    const t = signupToken('a@example.com', now)
    expect(readSignupToken(t, now + 6 * 86400_000)).toBe('a@example.com')
    expect(readSignupToken(t, now + 8 * 86400_000)).toBeUndefined()
  })

  it('refuses a link that was altered or signed with another secret', () => {
    const t = signupToken('a@example.com')
    const [data, mac] = t.split('.')
    const other = Buffer.from(JSON.stringify({ e: 'b@example.com', t: Date.now() })).toString(
      'base64url',
    )
    expect(readSignupToken(`${other}.${mac}`)).toBeUndefined()
    expect(readSignupToken(`${data}.${mac.slice(0, -2)}xx`)).toBeUndefined()
    expect(readSignupToken(signupToken('a@example.com', Date.now(), 'another'))).toBeUndefined()
    expect(readSignupToken(undefined)).toBeUndefined()
  })
})

describe('signing up in the footer', () => {
  it('emails a confirmation link and adds nobody yet', async () => {
    const fake = resend([200, { id: 'e1' }])
    expect(await startSignup(' Person@Example.com ', fake)).toEqual({ ok: true })
    expect(fake.mock.calls).toHaveLength(1)
    const [url, init] = fake.mock.calls[0]
    expect(url).toBe('https://api.resend.com/emails')
    const body = JSON.parse(String(init.body))
    expect(body.to).toEqual(['person@example.com'])
    const link = body.html.match(/href="(https:\/\/tda\.test\/subscribe\/confirm\?t=[^"]+)"/)?.[1]
    expect(link).toBeTruthy()
    const token = decodeURIComponent(new URL(link.replace(/&amp;/g, '&')).searchParams.get('t')!)
    expect(readSignupToken(token)).toBe('person@example.com')
  })

  it('checks the address, and does nothing until Resend is set up', async () => {
    const fake = resend()
    expect(await startSignup('not-an-email', fake)).toMatchObject({
      ok: false,
      error: expect.stringMatching(/valid/),
    })
    vi.stubEnv('RESEND_SEGMENT_ID', '')
    expect(await startSignup('person@example.com', fake)).toMatchObject({ ok: false })
    expect(fake.mock.calls).toHaveLength(0)
  })
})

describe('confirming', () => {
  it('adds a new address to the list', async () => {
    const fake = resend([201, { id: 'c1' }], [201, {}])
    expect(await confirmSignup(signupToken('new@example.com'), fake)).toEqual({ ok: true })
    const [[u1, i1], [u2]] = fake.mock.calls
    expect(u1).toBe('https://api.resend.com/contacts')
    expect(JSON.parse(String(i1.body))).toMatchObject({
      email: 'new@example.com',
      unsubscribed: false,
    })
    expect(u2).toBe('https://api.resend.com/contacts/new%40example.com/segments/seg-1')
  })

  it('resubscribes someone who once unsubscribed, since they just confirmed', async () => {
    const fake = resend(
      [409, { message: 'Contact already exists' }],
      [200, {}],
      [409, { message: 'Already in segment' }],
    )
    expect(await confirmSignup(signupToken('back@example.com'), fake)).toEqual({ ok: true })
    const [, [u2, i2]] = fake.mock.calls
    expect(u2).toBe('https://api.resend.com/contacts/back%40example.com')
    expect(i2.method).toBe('PATCH')
    expect(JSON.parse(String(i2.body))).toEqual({ unsubscribed: false })
  })

  it('refuses an expired link without calling Resend', async () => {
    const fake = resend()
    const old = signupToken('a@example.com', Date.now() - 9 * 86400_000)
    expect(await confirmSignup(old, fake)).toMatchObject({
      ok: false,
      error: expect.stringMatching(/expired/),
    })
    expect(fake.mock.calls).toHaveLength(0)
  })
})

describe('importing a contact', () => {
  it('never undoes an unsubscribe', async () => {
    const fake = resend([409, { message: 'Contact already exists' }], [201, {}])
    expect(
      await addSubscriber(
        { email: 'left@example.com' },
        { segmentId: 'seg-1', resubscribe: false },
        fake,
      ),
    ).toEqual({ created: false })
    expect(fake.mock.calls.map(([, i]) => i.method)).toEqual(['POST', 'POST']) // no PATCH
  })

  it('stops on any other refusal', async () => {
    const fake = resend([401, { message: 'Invalid API key' }])
    await expect(
      addSubscriber({ email: 'a@example.com' }, { segmentId: 'seg-1', resubscribe: false }, fake),
    ).rejects.toThrow('Invalid API key')
  })
})
