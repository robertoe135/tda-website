import { createHmac, timingSafeEqual } from 'crypto'

import { renderConfirmEmail } from '../emails/ConfirmSignup'
import { addSubscriber, newsletterConfig, sendEmail } from './resend'
import { siteUrl } from './seo'

/**
 * Newsletter sign-ups, with double opt-in: the footer box emails a link, and the address joins
 * the Resend segment only once its owner opens it and confirms (/subscribe/confirm). Nothing is
 * stored on the site: the link carries the address, signed so it can't be forged, valid 7 days.
 * The box appears once Resend is set up (RESEND_API_KEY, RESEND_SEGMENT_ID, NEWSLETTER_FROM).
 */

export type SignupResult = { ok: true } | { ok: false; error: string }

export const signupConfigured = () => {
  const c = newsletterConfig()
  return Boolean(c.apiKey && c.segmentId && c.from)
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DAYS = 7
const b64 = (s: string) => Buffer.from(s).toString('base64url')
const sign = (data: string, secret: string) =>
  createHmac('sha256', `newsletter-signup:${secret}`).update(data).digest('base64url')

export function signupToken(
  email: string,
  now = Date.now(),
  secret = process.env.PAYLOAD_SECRET ?? '',
) {
  const data = b64(JSON.stringify({ e: email, t: now }))
  return `${data}.${sign(data, secret)}`
}

/** The address a confirmation link was sent to, or undefined if it was altered or has expired. */
export function readSignupToken(
  token: string | undefined,
  now = Date.now(),
  secret = process.env.PAYLOAD_SECRET ?? '',
) {
  const [data, mac] = (token ?? '').split('.')
  if (!data || !mac || !secret) return undefined
  const want = Buffer.from(sign(data, secret))
  const got = Buffer.from(mac)
  if (want.length !== got.length || !timingSafeEqual(want, got)) return undefined
  try {
    const { e, t } = JSON.parse(Buffer.from(data, 'base64url').toString()) as {
      e?: string
      t?: number
    }
    if (
      typeof e !== 'string' ||
      typeof t !== 'number' ||
      now - t > DAYS * 86400_000 ||
      t > now + 60_000
    )
      return undefined
    return e
  } catch {
    return undefined
  }
}

/** The footer box: sends the confirmation email. Says the same whether or not the address is already on the list. */
export async function startSignup(raw: string, fetcher?: typeof fetch): Promise<SignupResult> {
  const email = raw.trim().toLowerCase()
  if (!EMAIL.test(email) || email.length > 254)
    return { ok: false, error: 'Please enter a valid email address.' }
  const { from } = newsletterConfig()
  if (!signupConfigured() || !from) return { ok: false, error: 'Signups are not open yet.' }
  const link = `${siteUrl()}/subscribe/confirm?t=${encodeURIComponent(signupToken(email))}`
  const { html, text } = await renderConfirmEmail(link)
  try {
    await sendEmail(
      { from, to: [email], subject: 'Confirm your subscription', html, text },
      fetcher,
    )
    return { ok: true }
  } catch (e) {
    console.error('Newsletter signup email failed', (e as Error).message)
    return { ok: false, error: 'We could not sign up this address. Please check it and try again.' }
  }
}

/** The confirmation page's button: adds the address to the list (resubscribing it if needed). */
export async function confirmSignup(
  token: string | undefined,
  fetcher?: typeof fetch,
): Promise<SignupResult> {
  const email = readSignupToken(token)
  if (!email)
    return { ok: false, error: 'This link has expired or is incomplete. Please sign up again.' }
  const { segmentId } = newsletterConfig()
  if (!signupConfigured() || !segmentId) return { ok: false, error: 'Signups are not open yet.' }
  try {
    await addSubscriber({ email }, { segmentId, resubscribe: true }, fetcher)
    return { ok: true }
  } catch (e) {
    console.error('Newsletter confirmation failed', (e as Error).message)
    return {
      ok: false,
      error: 'Something went wrong on our side. Please try the link again later.',
    }
  }
}
