import type { Access } from 'payload'

/** Globals with drafts: editors read drafts; the public reads the published version only. */
export const publishedGlobal: Access = ({ req: { user } }) =>
  user ? true : { _status: { equals: 'published' } }
