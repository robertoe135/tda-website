import type { Payload, PayloadRequest } from 'payload'

import type { Project, YearsOfLight } from '@/payload-types'

type Docs = { projects: Project; 'years-of-light': YearsOfLight }
type Change<T> = (doc: T) => Partial<T> | undefined | Promise<Partial<T> | undefined>

const strip = <T extends { id: number; createdAt: string; updatedAt: string; _status?: unknown }>({
  id: _id,
  createdAt: _c,
  updatedAt: _u,
  _status: _s,
  ...rest
}: T) => rest

/**
 * Applies one change to a document with drafts everywhere it is seen: the published version
 * (the live site) and the latest draft (the admin), keeping each as it is otherwise.
 *
 * A published document can have a newer, unpublished draft. Saving the change as a draft would
 * leave the live site unchanged, and publishing it would also publish that draft's other edits.
 * So the published version is republished with only this change, and the draft is then saved
 * again on top, still unpublished. `change` returns undefined for a version that needs nothing.
 */
export async function changeDoc<C extends keyof Docs>(
  payload: Payload,
  collection: C,
  id: number,
  change: Change<Docs[C]>,
  req?: PayloadRequest,
) {
  const latest = (await payload.findByID({ collection, id, draft: true, depth: 0, req })) as Docs[C]
  const published =
    latest._status === 'published'
      ? latest
      : ((await payload.findByID({ collection, id, depth: 0, req }).catch(() => undefined)) as
          Docs[C] | undefined)
  const live = published?._status === 'published' ? published : undefined

  const forLive = live ? await change(live) : undefined
  const forDraft = latest !== live ? await change(latest) : undefined
  if (forLive) {
    await payload.update({
      collection,
      id,
      req,
      draft: false,
      data: { ...strip(live!), ...forLive, _status: 'published' } as never,
    })
  }
  if (forDraft || (forLive && latest !== live)) {
    // Republishing made the published version the latest; the draft goes back on top.
    await payload.update({
      collection,
      id,
      req,
      draft: true,
      data: { ...strip(latest), ...forDraft, _status: 'draft' } as never,
    })
  }
  return { live: Boolean(forLive), draft: Boolean(forDraft) }
}

/** changeDoc for a project. */
export const changeProject = (
  payload: Payload,
  id: number,
  change: Change<Project>,
  req?: PayloadRequest,
) => changeDoc(payload, 'projects', id, change, req)
