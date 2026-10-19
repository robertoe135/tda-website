import { getPayload, Payload } from 'payload'
import config from '@/payload.config'

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { senderHash, submitApplication } from '@/lib/careers'

let payload: Payload
const ip = `203.0.113.${Math.floor(Math.random() * 250)}`
const now = Date.now()
const pdf = () => new File([Buffer.from('%PDF-1.4\n% test\n')], 'Jane Doe CV.pdf', { type: 'application/pdf' })

const form = (fields: Record<string, string | File>) => {
  const f = new FormData()
  f.set('startedAt', String(now - 60_000))
  for (const [k, v] of Object.entries(fields)) f.set(k, v)
  return f
}

beforeAll(async () => {
  payload = await getPayload({ config: await config })
})

beforeEach(() => vi.stubEnv('SMTP_HOST', 'smtp.example.test'))
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

afterAll(async () => {
  await payload.delete({ collection: 'leads', where: { senderHash: { equals: senderHash(ip) } } })
})

describe('career applications', () => {
  it('saves a lead and emails the jobs inbox with the CV attached', async () => {
    const send = vi.spyOn(payload, 'sendEmail').mockResolvedValue(undefined as never)
    const result = await submitApplication(
      payload,
      form({ name: '[Test Applicant]', email: 'Applicant@Example.com', position: 'Designer', portfolioUrl: 'example.com/work', cv: pdf() }),
      ip,
      now,
    )
    expect(result).toEqual({ ok: true })
    const mail = send.mock.calls[0][0] as { to: string; replyTo: string; subject: string; attachments: { filename: string }[] }
    expect(mail.to).toBe('jobs@tillotsondesign.com')
    expect(mail.replyTo).toBe('applicant@example.com')
    expect(mail.subject).toBe('Application: [Test Applicant] (Designer)')
    expect(mail.attachments[0].filename).toBe('Jane Doe CV.pdf')

    const lead = (await payload.find({ collection: 'leads', where: { senderHash: { equals: senderHash(ip) } } })).docs[0]
    expect(lead).toMatchObject({ type: 'career', status: 'new', email: 'applicant@example.com', portfolioUrl: 'https://example.com/work', cvFileName: 'Jane Doe CV.pdf', emailSent: true })
  })

  it('keeps the lead when the email fails, marked as not sent', async () => {
    vi.spyOn(payload, 'sendEmail').mockRejectedValue(new Error('SMTP down'))
    vi.spyOn(payload.logger, 'error').mockImplementation(() => undefined as never)
    await submitApplication(payload, form({ name: '[Second Applicant]', email: 'second@example.com', cv: pdf() }), ip, now)
    const lead = (await payload.find({ collection: 'leads', where: { name: { equals: '[Second Applicant]' } } })).docs[0]
    expect(lead.emailSent).toBe(false)
  })

  it('never marks a lead as emailed when no email service is set up', async () => {
    vi.stubEnv('SMTP_HOST', '')
    vi.spyOn(payload.logger, 'warn').mockImplementation(() => undefined as never)
    const send = vi.spyOn(payload, 'sendEmail')
    await submitApplication(payload, form({ name: '[No SMTP Applicant]', email: 'nosmtp@example.com', cv: pdf() }), ip, now)
    expect(send).not.toHaveBeenCalled()
    const lead = (await payload.find({ collection: 'leads', where: { name: { equals: '[No SMTP Applicant]' } } })).docs[0]
    expect(lead.emailSent).toBe(false)
  })

  it('refuses a CV that is not a PDF, and says what is missing', async () => {
    const fake = new File([Buffer.from('MZ not a pdf')], 'cv.pdf', { type: 'application/pdf' })
    const result = await submitApplication(payload, form({ name: '', email: 'nope', cv: fake }), ip, now)
    expect(result).toEqual({ ok: false, errors: { name: expect.any(String), email: expect.any(String), cv: 'Please attach your CV as a PDF.' } })
  })

  it('quietly drops bots: the hidden field, or a form sent within seconds', async () => {
    const send = vi.spyOn(payload, 'sendEmail')
    expect(await submitApplication(payload, form({ name: 'Bot', email: 'b@example.com', website: 'spam', cv: pdf() }), ip, now)).toEqual({ ok: true })
    const quick = form({ name: 'Bot', email: 'b@example.com', cv: pdf() })
    quick.set('startedAt', String(now - 500))
    expect(await submitApplication(payload, quick, ip, now)).toEqual({ ok: true })
    expect(send).not.toHaveBeenCalled()
    expect((await payload.count({ collection: 'leads', where: { name: { equals: 'Bot' } } })).totalDocs).toBe(0)
  })

  it('shows a person who clicks Send early what is missing, rather than a false thank-you', async () => {
    const early = form({ name: '', email: '' })
    early.set('startedAt', String(now - 500))
    expect(await submitApplication(payload, early, ip, now)).toMatchObject({ ok: false, errors: { name: expect.any(String) } })
  })

  it('limits one sender to five applications an hour', async () => {
    vi.spyOn(payload, 'sendEmail').mockResolvedValue(undefined as never)
    const results = []
    const before = (await payload.count({ collection: 'leads', where: { senderHash: { equals: senderHash(ip) } } })).totalDocs
    for (let i = before; i < 6; i++) results.push(await submitApplication(payload, form({ name: `[Repeat ${i}]`, email: 'r@example.com', cv: pdf() }), ip, now))
    expect(results.slice(0, -1).every((r) => r.ok)).toBe(true)
    expect(results.at(-1)).toMatchObject({ ok: false, errors: { form: expect.stringMatching(/last hour/) } })
  })

  it('is never readable or creatable through the public API', async () => {
    await expect(payload.find({ collection: 'leads', overrideAccess: false })).rejects.toThrow()
    await expect(payload.create({ collection: 'leads', overrideAccess: false, data: { type: 'career', status: 'new', name: 'x', email: 'x@example.com' } })).rejects.toThrow()
  })
})
