import config from '@payload-config'
import { getPayload } from 'payload'

import { renderNewsletter } from '@/emails/Newsletter'
import { loadIssue } from '@/lib/newsletter'

export const dynamic = 'force-dynamic'

/** "View in browser": a sent issue as it went out, without the unsubscribe line. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const payload = await getPayload({ config })
  const doc = await payload
    .findByID({ collection: 'newsletters', id, depth: 0, overrideAccess: true })
    .catch(() => undefined)
  // Only sent issues are public; drafts and unsent issues stay in the admin.
  if (!doc?.sentAt) return new Response('Not found', { status: 404 })
  const { html } = await renderNewsletter(await loadIssue(payload, doc))
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}
