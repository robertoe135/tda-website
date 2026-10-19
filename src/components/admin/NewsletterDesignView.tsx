import type { DocumentViewServerProps } from 'payload'

import { userIsAdmin } from '@/access/isAdmin'

import { NewsletterDesign } from './NewsletterDesign'

/** The Design tab of a newsletter issue (collections/newsletters). */
export function NewsletterDesignView(props: DocumentViewServerProps) {
  const doc = props.doc as { id?: number | string; sentAt?: string | null } | undefined
  if (!doc?.id)
    return <p style={{ padding: 'var(--base)' }}>Save the issue first, then design it here.</p>
  // A sent issue is the record of what went out: only an admin may still change it.
  const readOnly = Boolean(doc.sentAt) && !userIsAdmin(props.initPageResult.req)
  return <NewsletterDesign id={String(doc.id)} readOnly={readOnly} />
}
