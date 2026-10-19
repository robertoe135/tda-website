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

async function call<T>(path: string, body: unknown, fetcher: typeof fetch = fetch): Promise<T> {
  const { apiKey } = newsletterConfig()
  if (!apiKey) throw new Error('RESEND_API_KEY is not set')
  const res = await fetcher(`${API}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = (await res.json().catch(() => ({}))) as { message?: string } & T
  if (!res.ok)
    throw new Error(`Resend refused it (${res.status}): ${data.message ?? res.statusText}`)
  return data
}

/** One email, for tests. */
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
