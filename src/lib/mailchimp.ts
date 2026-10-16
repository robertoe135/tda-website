import { createHash } from 'crypto'

/**
 * Newsletter signups go straight to TDA's Mailchimp audience; nothing is stored on the site.
 * Double opt-in: Mailchimp emails the visitor to confirm before adding them. The signup form
 * appears only once MAILCHIMP_API_KEY and MAILCHIMP_AUDIENCE_ID are set (Vercel → Settings →
 * Environment Variables). The key ends in the account's data center, e.g. "…-us21".
 */

export const mailchimpConfigured = () => Boolean(process.env.MAILCHIMP_API_KEY && process.env.MAILCHIMP_AUDIENCE_ID)

export type SignupResult = { ok: true } | { ok: false; error: string }

export async function subscribe(rawEmail: string, fetchImpl: typeof fetch = fetch): Promise<SignupResult> {
  const email = rawEmail.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: 'Please enter a valid email address.' }
  const key = process.env.MAILCHIMP_API_KEY
  const audience = process.env.MAILCHIMP_AUDIENCE_ID
  const dc = key?.split('-').pop()
  if (!key || !audience || !dc) return { ok: false, error: 'Signups are not open yet.' }

  // PUT on the member's hash adds them or leaves an existing subscriber as they are.
  const member = createHash('md5').update(email).digest('hex')
  const response = await fetchImpl(`https://${dc}.api.mailchimp.com/3.0/lists/${audience}/members/${member}`, {
    method: 'PUT',
    headers: { Authorization: `Basic ${Buffer.from(`tda:${key}`).toString('base64')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email_address: email, status_if_new: 'pending' }),
  })
  if (response.ok) return { ok: true }
  // Mailchimp refuses fake-looking addresses and people who unsubscribed and must rejoin
  // through its own form; the visitor gets a plain message, the details stay in the log.
  console.error('Mailchimp signup failed', response.status, await response.text().catch(() => ''))
  return { ok: false, error: 'We could not sign up this address. Please check it and try again.' }
}
