import type { Payload } from 'payload'

import type { Client, Project } from '@/payload-types'

/**
 * Projects with their owners' names filled in, for a public page or email. Clients are
 * staff-only records (collections/Clients), so a public read gives only their ids, and only on
 * projects known not to be confidential (Projects.ts, field access). Their names are read here
 * on the server, for those projects only; a confidential project gets none, whatever it holds.
 */
export async function withClientNames<T extends Pick<Project, 'clients' | 'confidential'>>(
  payload: Payload,
  projects: T[],
): Promise<T[]> {
  const idOf = (c: number | Client) => (typeof c === 'number' ? c : c.id)
  const shown = (p: T) => (p.confidential === false ? (p.clients ?? []) : [])
  const ids = [...new Set(projects.flatMap((p) => shown(p).map(idOf)))]
  const found = ids.length
    ? await payload.find({
        collection: 'clients',
        overrideAccess: true, // only ids a public read already returned, of non-confidential projects
        where: { id: { in: ids } },
        pagination: false,
        depth: 0,
        select: { name: true },
      })
    : undefined
  const byId = new Map((found?.docs ?? []).map((c) => [c.id, c as Client]))
  return projects.map((p) => ({
    ...p,
    clients: shown(p)
      .map((c) => byId.get(idOf(c)))
      .filter((c): c is Client => Boolean(c)),
  }))
}
