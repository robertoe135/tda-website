/**
 * Resend, which sends the newsletter and keeps its list (docs/newsletter.md). Called over its
 * HTTP API; nothing is sent unless RESEND_API_KEY is set. The list is a Resend segment, whose
 * unsubscribe page and bounce handling Resend runs.
 */
const API = 'https://api.resend.com'

export const newsletterConfig = () => ({
  apiKey: process.env.RESEND_API_KEY || undefined,
  segmentId: process.env.RESEND_SEGMENT_ID || undefined,
  from: process.env.NEWSLETTER_FROM || undefined,
})

export class ResendError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(`Resend refused it (${status}): ${message}`)
  }
}

async function call<T>(
  path: string,
  body: unknown,
  fetcher: typeof fetch = fetch,
  method: 'POST' | 'PATCH' = 'POST',
): Promise<T> {
  const { apiKey } = newsletterConfig()
  if (!apiKey) throw new Error('RESEND_API_KEY is not set')
  const res = await fetcher(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = (await res.json().catch(() => ({}))) as { message?: string } & T
  if (!res.ok) throw new ResendError(res.status, data.message ?? res.statusText)
  return data
}

/** One email: a test issue, or a sign-up confirmation. */
export const sendEmail = (
  email: { from: string; to: string[]; subject: string; html: string; text: string },
  fetcher?: typeof fetch,
) => call<{ id: string }>('/emails', email, fetcher)

/** The issue to the whole segment, sent at once. */
export const sendBroadcast = (
  b: { segmentId: string; from: string; subject: string; html: string; name: string },
  fetcher?: typeof fetch,
) =>
  call<{ id: string }>(
    '/broadcasts',
    {
      segment_id: b.segmentId,
      from: b.from,
      subject: b.subject,
      html: b.html,
      name: b.name,
      send: true,
    },
    fetcher,
  )

export type Contact = { email: string; firstName?: string; lastName?: string }

/**
 * Adds someone to the list's segment. A new address becomes a subscribed contact. An existing one
 * is only resubscribed when `resubscribe` is set, i.e. the person just confirmed a sign-up; an
 * import never undoes an unsubscribe.
 */
export async function addSubscriber(
  c: Contact,
  { segmentId, resubscribe }: { segmentId: string; resubscribe: boolean },
  fetcher?: typeof fetch,
) {
  const email = c.email.trim().toLowerCase()
  let created = true
  try {
    await call(
      '/contacts',
      { email, first_name: c.firstName, last_name: c.lastName, unsubscribed: false },
      fetcher,
    )
  } catch (e) {
    // Already a contact (Resend answers 409 or 422): keep it, and its unsubscribe, as it is.
    if (!(e instanceof ResendError) || ![409, 422].includes(e.status)) throw e
    created = false
    if (resubscribe)
      await call(
        `/contacts/${encodeURIComponent(email)}`,
        { unsubscribed: false },
        fetcher,
        'PATCH',
      )
  }
  try {
    await call(`/contacts/${encodeURIComponent(email)}/segments/${segmentId}`, undefined, fetcher)
  } catch (e) {
    if (!(e instanceof ResendError) || e.status !== 409) throw e // 409: already in the segment
  }
  return { created }
}
