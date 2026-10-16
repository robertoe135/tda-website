import { createHmac } from 'crypto'

import type { Payload } from 'payload'

/**
 * Career applications from the site's form: checked, saved as a Lead, and emailed to the
 * jobs inbox with the CV attached. The CV is not stored anywhere else.
 */

export const MAX_CV_MB = 4
const MIN_SECONDS_ON_FORM = 3 // people take longer than this; most bots do not
const MAX_PER_HOUR = 5 // per sender

export type ApplicationResult =
  | { ok: true }
  | { ok: false; errors: Partial<Record<'name' | 'email' | 'portfolioUrl' | 'cv' | 'form', string>> }

const text = (form: FormData, key: string, max = 200) => String(form.get(key) ?? '').trim().slice(0, max)
const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
const isWebAddress = (s: string) => {
  try {
    return ['http:', 'https:'].includes(new URL(s).protocol)
  } catch {
    return false
  }
}

/** A one-way hash of the sender's address, enough to count repeat submissions. */
export const senderHash = (ip: string) =>
  createHmac('sha256', process.env.PAYLOAD_SECRET || 'local').update(ip).digest('hex').slice(0, 32)

export async function submitApplication(payload: Payload, form: FormData, ip: string, now = Date.now()): Promise<ApplicationResult> {
  // Bots fill in a field people never see: a quiet success, so they learn nothing.
  if (text(form, 'website')) return { ok: true }

  const name = text(form, 'name', 120)
  const email = text(form, 'email', 200).toLowerCase()
  const phone = text(form, 'phone', 40)
  const position = text(form, 'position', 120)
  let portfolioUrl = text(form, 'portfolioUrl', 300)
  if (portfolioUrl && !/^https?:\/\//i.test(portfolioUrl)) portfolioUrl = `https://${portfolioUrl}`
  const message = text(form, 'message', 5000)
  const cv = form.get('cv')

  const errors: Extract<ApplicationResult, { ok: false }>['errors'] = {}
  if (!name) errors.name = 'Please enter your name.'
  if (!isEmail(email)) errors.email = 'Please enter an email address we can reply to.'
  if (portfolioUrl && !isWebAddress(portfolioUrl)) errors.portfolioUrl = 'Please enter a full web address, or leave this empty.'
  let cvData: Buffer | undefined
  if (!(cv instanceof File) || cv.size === 0) errors.cv = 'Please attach your CV as a PDF.'
  else if (cv.size > MAX_CV_MB * 1024 * 1024) errors.cv = `Your CV is over ${MAX_CV_MB} MB. Please send a smaller PDF.`
  else {
    cvData = Buffer.from(await cv.arrayBuffer())
    if (cvData.subarray(0, 5).toString('latin1') !== '%PDF-') errors.cv = 'Please attach your CV as a PDF.'
  }
  if (Object.keys(errors).length) return { ok: false, errors }

  // A complete form sent faster than anyone could fill it in is a bot: quiet success too.
  // (Checked after the fields, so a person who clicks Send early sees what is missing.)
  const startedAt = Number(form.get('startedAt'))
  if (!startedAt || now - startedAt < MIN_SECONDS_ON_FORM * 1000) return { ok: true }

  const hash = senderHash(ip)
  const recent = await payload.count({
    collection: 'leads',
    where: { and: [{ senderHash: { equals: hash } }, { createdAt: { greater_than: new Date(now - 3600_000).toISOString() } }] },
  })
  if (recent.totalDocs >= MAX_PER_HOUR) {
    return { ok: false, errors: { form: 'We have received several applications from you in the last hour. Please try again later.' } }
  }

  const cvFileName = (cv as File).name.replace(/[^\w.\- ]+/g, '').slice(0, 120) || 'cv.pdf'
  const lead = await payload.create({
    collection: 'leads',
    data: { type: 'career', status: 'new', name, email, phone, position, portfolioUrl, message, cvFileName, senderHash: hash },
  })

  const settings = await payload.findGlobal({ slug: 'siteSettings' })
  const to = settings.careersEmail || 'jobs@tillotsondesign.com'
  const adminUrl = `${process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'}/admin/collections/leads/${lead.id}`
  const rows: [string, string][] = [
    ['Name', name],
    ['Email', email],
    ['Phone', phone],
    ['Position of interest', position],
    ['Portfolio', portfolioUrl],
  ]
  // Without an email service Payload only logs the message, so it must not count as sent.
  if (!process.env.SMTP_HOST) {
    payload.logger.warn({ lead: lead.id }, 'Career application saved but not emailed: SMTP is not configured')
    return { ok: true }
  }
  try {
    await payload.sendEmail({
      to,
      replyTo: email,
      subject: `Application: ${name}${position ? ` (${position})` : ''}`,
      html: `<p>A career application from the website.</p><table>${rows
        .filter(([, v]) => v)
        .map(([k, v]) => `<tr><td style="padding:2px 12px 2px 0;color:#555">${k}</td><td>${escapeHtml(v)}</td></tr>`)
        .join('')}</table>${message ? `<p style="white-space:pre-wrap">${escapeHtml(message)}</p>` : ''}<p>CV attached. <a href="${adminUrl}">Open in Leads</a>. Reply to this email to answer the applicant.</p>`,
      attachments: [{ filename: cvFileName.toLowerCase().endsWith('.pdf') ? cvFileName : `${cvFileName}.pdf`, content: cvData, contentType: 'application/pdf' }],
    })
    await payload.update({ collection: 'leads', id: lead.id, data: { emailSent: true } })
  } catch (error) {
    // The application is saved either way; the admin shows that the email did not go out.
    payload.logger.error({ err: error, lead: lead.id }, 'Career application email failed')
  }
  return { ok: true }
}

/**
 * When the form was handed out, for the bot timing check. The careers page renders on every
 * request (force-dynamic), so this runs once per visit.
 */
export const formIssuedAt = () => Date.now()
