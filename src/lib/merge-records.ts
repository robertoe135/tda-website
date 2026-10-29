import type { Payload, PayloadRequest, Where } from 'payload'

import type { Client, Photographer, Project } from '@/payload-types'

import { changeProject } from './project-versions'

/**
 * Merging two records of one client or one photographer, once a person has decided which is
 * right (the admin's Merge panel in the kept record's sidebar). Firms have their own merge, as
 * they carry other names and Years of Light (lib/merge-firms).
 *
 * Every project naming the merged record names the kept one instead (no repeats), in its
 * published version and its latest draft alike. For a photographer, so does every photo
 * credited to them, and the kept record takes the merged one's website when it has none. The
 * merged record is then deleted.
 */

type Ref = number | { id: number } | null | undefined
const idOf = (r: Ref) => (r && typeof r === 'object' ? r.id : r)
const swap = (refs: Ref[] | null | undefined, from: number, to: number) => {
  const ids = (refs ?? []).map(idOf).filter((id): id is number => typeof id === 'number')
  return [...new Set(ids.map((id) => (id === from ? to : id)))]
}

export type MergeableCollection = 'clients' | 'photographers'
type Record = Pick<Client | Photographer, 'id' | 'name'> & { website?: string | null }

export async function mergeRecords(
  payload: Payload,
  collection: MergeableCollection,
  keep: Record,
  merge: Record,
  write: boolean,
  req?: PayloadRequest,
) {
  if (keep.id === merge.id) throw new Error('Keep and merge are the same record.')
  const field = collection // the projects field that names them has the collection's name

  // In the latest draft or in the published version: either can name it without the other.
  const where: Where = { [field]: { in: [merge.id] } }
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

  const photos =
    collection === 'photographers'
      ? (await payload.find({ req, collection: 'media', pagination: false, depth: 0, select: {}, where: { photographer: { equals: merge.id } } })).docs.map((m) => m.id)
      : []
  const fill = collection === 'photographers' && !keep.website && merge.website ? { website: merge.website } : {}

  if (write) {
    // Moved before the record is deleted, which would also remove it from every version.
    for (const id of found.keys())
      await changeProject(
        payload,
        id,
        (p: Project) => {
          const refs = p[field] as Ref[] | null | undefined
          return (refs ?? []).some((r) => idOf(r) === merge.id) ? { [field]: swap(refs, merge.id, keep.id) } : undefined
        },
        req,
      )
    if (photos.length)
      await payload.update({ req, collection: 'media', where: { photographer: { equals: merge.id } }, data: { photographer: keep.id } })
    await payload.delete({ req, collection, id: merge.id })
    if (Object.keys(fill).length) await payload.update({ req, collection, id: keep.id, data: fill })
  }
  return {
    keep: keep.name,
    merge: merge.name,
    projects: [...found.values()].sort(),
    photos: photos.length,
    filled: Object.keys(fill),
  }
}
