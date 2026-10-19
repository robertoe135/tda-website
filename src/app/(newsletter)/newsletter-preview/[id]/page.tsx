import config from '@payload-config'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'

import { EmailPreview } from '@/components/admin/EmailPreview'
import { renderNewsletter } from '@/emails/Newsletter'
import { loadIssue } from '@/lib/newsletter'
import { siteUrl } from '@/lib/seo'

export const dynamic = 'force-dynamic'

/**
 * The live preview beside a newsletter in the admin (collections/newsletters): the latest draft,
 * drawn exactly as it will be emailed. Logged-in editors only; refreshed on every autosave.
 */
export default async function NewsletterPreview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await headers() })
  if (!user) notFound()
  const doc = await payload
    .findByID({ collection: 'newsletters', id, draft: true, depth: 0, user, overrideAccess: false })
    .catch(() => undefined)
  if (!doc) notFound()
  const issue = await loadIssue(payload, doc)
  const { html } = await renderNewsletter(issue, {
    browserHref: doc.sentAt ? `${siteUrl()}/newsletter/${doc.id}` : undefined,
    unsubscribeHref: '#',
  })
  // Links open in a new tab rather than inside the preview.
  const framed = html.replace(/<head>/i, '<head><base target="_blank">')
  return <EmailPreview html={framed} empty={issue.items.length === 0} />
}
