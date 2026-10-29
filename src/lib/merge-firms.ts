import type { Payload, PayloadRequest, Where } from 'payload'

import { normalizeName } from '@/hooks/preventNearDuplicates'
import type { Firm, Project } from '@/payload-types'

import { changeDoc, changeProject } from './project-versions'

/**
 * Merging two records of one firm, once a person has decided which is right (the admin's
 * "Merge a duplicate" on a firm, or pnpm migrate:merge-firms).
 *
 * Every project that names the merged firm as architect or in its credits names the
 * main firm instead (no repeats), in its published version and its latest draft alike; Years
 * of Light featuring it do too. The main firm takes the merged one's website and its place on
 * Collaborators when it has none. The merged record is deleted and its name, with its other
 * names, becomes an other name of the main firm: never shown, but old links, filters and
 * imports using it land on the main firm.
 */

type Ref = number | { id: number } | null | undefined
const idOf = (r: Ref) => (r && typeof r === 'object' ? r.id : r)
const swap = (refs: Ref[] | null | undefined, from: number, to: number) => {
  const ids = (refs ?? []).map(idOf).filter((id): id is number => typeof id === 'number')
  return [...new Set(ids.map((id) => (id === from ? to : id)))]
}

export async function mergeFirms(
  payload: Payload,
  keepName: string,
  mergeName: string,
  write: boolean,
) {
  const byName = async (name: string) => {
    const found = await payload.find({
      collection: 'firms',
      where: { name: { equals: name } },
      limit: 2,
      depth: 0,
    })
    if (found.docs.length !== 1)
      throw new Error(`Expected one firm named "${name}", found ${found.docs.length}.`)
    return found.docs[0]
  }
  return mergeFirmRecords(payload, await byName(keepName), await byName(mergeName), write)
}

/** The merge itself, for two firm records already looked up. Pass `req` to run inside its transaction. */
export async function mergeFirmRecords(
  payload: Payload,
  keep: Firm,
  merge: Firm,
  write: boolean,
  req?: PayloadRequest,
) {
  if (keep.id === merge.id) throw new Error('Keep and merge are the same firm.')

  // Projects naming the merged firm in their latest draft or in their published version: a
  // published project can have a newer draft without the firm, or the other way round.
  const where: Where = {
    or: [
      { architects: { in: [merge.id] } },
      { 'credits.firms': { in: [merge.id] } },
    ],
  }
  // One query at a time: inside a transaction they share one database connection.
  const drafts = await payload.find({ req, collection: 'projects', draft: true, pagination: false, depth: 0, where })
  const live = await payload.find({
    req,
    collection: 'projects',
    pagination: false,
    depth: 0,
    where: { and: [where, { _status: { equals: 'published' } }] },
  })
  const found = new Map([...drafts.docs, ...live.docs].map((p) => [p.id, p.name]))
  const changed = [...found.values()].sort()
  const names = (p: Project) =>
    [
      ...(p.architects ?? []),
      ...(p.credits ?? []).flatMap((c) => c.firms),
    ].map((r) => idOf(r as Ref))
  // The firm's record is deleted below, which also removes it from every version that still
  // names it, so each version is moved to the kept firm first (versions.ts).
  for (const id of write ? found.keys() : []) {
    await changeProject(
      payload,
      id,
      (p) =>
        names(p).includes(merge.id)
          ? {
              architects: swap(p.architects as Ref[], merge.id, keep.id),
              credits: (p.credits ?? []).map((c) => ({
                ...c,
                firms: swap(c.firms as Ref[], merge.id, keep.id),
              })),
            }
          : undefined,
      req,
    )
  }
  // The merged name joins the main firm's aliases, after the record is gone (a name may not be
  // both a firm and another firm's alias).
  const aliases = [
    ...(keep.aliases ?? []).map((a) => ({ name: a.name })),
    { name: merge.name },
    ...(merge.aliases ?? []).map((a) => ({ name: a.name })),
  ].filter(
    (a, i, all) => all.findIndex((b) => normalizeName(b.name) === normalizeName(a.name)) === i,
  )
  // Years of Light that feature the merged firm feature the main one instead.
  const yearWhere: Where = { collaborators: { in: [merge.id] } }
  const yearDrafts = await payload.find({
    req,
    collection: 'years-of-light',
    draft: true,
    pagination: false,
    depth: 0,
    where: yearWhere,
  })
  const yearsLive = await payload.find({
    req,
    collection: 'years-of-light',
    pagination: false,
    depth: 0,
    where: { and: [yearWhere, { _status: { equals: 'published' } }] },
  })
  const years = new Map([...yearDrafts.docs, ...yearsLive.docs].map((y) => [y.id, y.year]))
  // What the main record lacks and the merged one has: its website, its place on Collaborators.
  const fill = {
    ...(!keep.website && merge.website ? { website: merge.website } : {}),
    ...(!keep.listAsCollaborator && merge.listAsCollaborator ? { listAsCollaborator: true } : {}),
  }
  if (write) {
    for (const id of years.keys()) {
      await changeDoc(
        payload,
        'years-of-light',
        id,
        (y) =>
          (y.collaborators ?? []).some((r) => idOf(r as Ref) === merge.id)
            ? { collaborators: swap(y.collaborators as Ref[], merge.id, keep.id) }
            : undefined,
        req,
      )
    }
    await payload.delete({ collection: 'firms', id: merge.id, req })
    await payload.update({ collection: 'firms', id: keep.id, data: { aliases, ...fill }, req })
  }
  return {
    keep: keep.name,
    merge: merge.name,
    projects: changed,
    aliases: aliases.map((a) => a.name),
    years: [...years.values()].sort(),
    filled: Object.keys(fill),
  }
}
