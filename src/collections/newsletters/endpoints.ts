import type { PayloadHandler, PayloadRequest } from 'payload'

import { RESEND_UNSUBSCRIBE, renderNewsletter, renderParts } from '../../emails/Newsletter'
import { siteServesThis } from '../../lib/email-logo'
import { buildIssue, loadIssue, loadLookups } from '../../lib/newsletter'
import { emailLogo } from '../../lib/email-logo'
import { newsletterConfig, sendBroadcast, sendEmail } from '../../lib/resend'
import { siteUrl } from '../../lib/seo'
import type { Newsletter } from '../../payload-types'

/**
 * The admin's "Send a test" and "Send to the list" buttons (components/admin/NewsletterSend).
 * Tests go through Resend, or the site's SMTP mail when Resend isn't set up yet. The list send
 * takes the published version only, so half-finished edits never go out, and runs once.
 */

const json = (body: unknown, status = 200) => Response.json(body, { status })
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

async function read(req: PayloadRequest, draft: boolean) {
  const id = req.routeParams?.id as string | undefined
  if (!req.user) return { error: json({ error: 'Log in first.' }, 401) }
  if (!id) return { error: json({ error: 'No issue given.' }, 400) }
  const doc = await req.payload
    .findByID({ collection: 'newsletters', id, draft, depth: 0, req, overrideAccess: false })
    .catch(() => undefined)
  if (!doc) return { error: json({ error: 'Issue not found.' }, 404) }
  return { doc: doc as Newsletter }
}

/** Whether a test and a list send would work, and what is missing. */
export const sendingStatus: PayloadHandler = async (req) => {
  if (!req.user) return json({ error: 'Log in first.' }, 401)
  const c = newsletterConfig()
  const missing = [
    !c.apiKey && 'RESEND_API_KEY',
    !c.segmentId && 'RESEND_SEGMENT_ID',
    !c.from && 'NEWSLETTER_FROM',
  ].filter(Boolean)
  const site = siteUrl()
  return json({
    test: Boolean((c.apiKey && c.from) || process.env.SMTP_HOST),
    list: missing.length === 0,
    missing,
    // Links in the email are built from this address: it has to be where this site is served.
    site,
    siteOk: await siteServesThis(site),
  })
}

export const sendTest: PayloadHandler = async (req) => {
  const { doc, error } = await read(req, true) // the latest draft: tests are for checking edits
  if (error) return error
  const body = (req.json ? await req.json().catch(() => ({})) : {}) as { to?: string }
  const to = (body.to || req.user!.email || '')
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
  if (!to.length || to.length > 5 || !to.every((a) => EMAIL.test(a)))
    return json({ error: 'Enter up to five email addresses, separated by commas.' }, 400)

  const issue = await loadIssue(req.payload, doc!)
  if (!issue.items.length)
    return json({ error: 'The issue is empty: fill in at least one block.' }, 400)
  // The real unsubscribe link only exists in a list send; a test links to the site instead.
  const { html, text } = await renderNewsletter(issue, { unsubscribeHref: siteUrl() })
  const subject = `[Test] ${doc!.subject}`
  const c = newsletterConfig()
  try {
    if (c.apiKey && c.from) await sendEmail({ from: c.from, to, subject, html, text })
    else if (process.env.SMTP_HOST) await req.payload.sendEmail({ to, subject, html, text })
    else return json({ error: 'No email service is set up yet (docs/newsletter.md).' }, 503)
  } catch (e) {
    req.payload.logger.error({ err: e }, 'Newsletter test failed')
    return json({ error: (e as Error).message }, 502)
  }
  return json({ ok: true, to })
}

export const sendNewsletter: PayloadHandler = async (req) => {
  const c = newsletterConfig()
  if (!c.apiKey || !c.segmentId || !c.from)
    return json({ error: 'Sending to the list isn’t set up yet (docs/newsletter.md).' }, 503)
  const latest = await read(req, true)
  if (latest.error) return latest.error
  if (latest.doc!.sentAt) return json({ error: 'This issue was already sent.' }, 409)
  if (latest.doc!._status !== 'published')
    return json(
      { error: 'There are changes that aren’t published. Publish the issue, then send it.' },
      409,
    )
  const { doc } = await read(req, false)
  if (!doc) return json({ error: 'Publish the issue first.' }, 409)

  const issue = await loadIssue(req.payload, doc)
  if (!issue.items.length)
    return json({ error: 'The issue is empty: fill in at least one block.' }, 400)
  const { html } = await renderNewsletter(issue, {
    browserHref: `${siteUrl()}/newsletter/${doc.id}`,
    unsubscribeHref: RESEND_UNSUBSCRIBE,
  })

  // Marked sent before sending, so a second click can't send it twice; undone if Resend refuses.
  const sentAt = new Date().toISOString()
  const mark = (data: Partial<Newsletter>) =>
    req.payload.update({ collection: 'newsletters', id: doc.id, data, req, overrideAccess: true })
  await mark({ sentAt, sentBy: req.user!.email })
  try {
    const { id } = await sendBroadcast({
      segmentId: c.segmentId,
      from: c.from,
      subject: doc.subject,
      html,
      name: [doc.masthead, doc.issueNumber ? `No. ${doc.issueNumber}` : undefined, doc.subject]
        .filter(Boolean)
        .join(' · '),
    })
    await mark({ broadcastId: id })
    req.payload.logger.info({ id: doc.id, broadcast: id }, 'Newsletter sent')
    return json({ ok: true, sentAt })
  } catch (e) {
    await mark({ sentAt: null, sentBy: null })
    req.payload.logger.error({ err: e }, 'Newsletter send failed')
    return json({ error: (e as Error).message }, 502)
  }
}

/**
 * The visual editor's canvas: the blocks it holds (not yet saved), drawn as the email will be.
 * Read as the public sees the site, like a real send.
 */
export const previewBlocks: PayloadHandler = async (req) => {
  if (!req.user) return json({ error: 'Log in first.' }, 401)
  const body = (req.json ? await req.json().catch(() => ({})) : {}) as {
    content?: unknown
    issue?: Partial<Pick<Newsletter, 'masthead' | 'issueNumber' | 'theme' | 'season'>>
  }
  const content = (
    Array.isArray(body.content) ? body.content.slice(0, 200) : []
  ) as Newsletter['content']
  const { lookups, settings } = await loadLookups(req.payload, content)
  const { masthead, issueNumber, theme, season } = body.issue ?? {}
  const doc = { id: 0, subject: '', masthead, issueNumber, theme, season, content } as Newsletter
  const issue = buildIssue(doc, lookups, settings, siteUrl(), await emailLogo())
  return json(await renderParts(issue))
}
