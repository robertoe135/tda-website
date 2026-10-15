import type { Access, Where } from 'payload'

/**
 * Logged-in users read everything, drafts included. The public (REST, GraphQL and any
 * unauthenticated Local API call that respects access) only reads published documents,
 * plus any extra conditions a collection adds, e.g. people with showOnSite.
 */
export const publishedOrAuthenticated =
  (extra: Where[] = []): Access =>
  ({ req: { user } }) => {
    if (user) return true
    return { and: [{ _status: { equals: 'published' } }, ...extra] }
  }
