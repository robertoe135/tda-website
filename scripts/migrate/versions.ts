import type { Payload } from 'payload'

import type { Project } from '../../src/payload-types'

type Change = (doc: Project) => Partial<Project> | undefined | Promise<Partial<Project> | undefined>

const strip = ({ id: _id, createdAt: _c, updatedAt: _u, _status: _s, ...rest }: Project) => rest

/**
 * Applies one change to a project everywhere it is seen: the published version (the live site)
 * and the latest draft (the admin), keeping each as it is otherwise.
 *
 * A published project can have a newer, unpublished draft. Saving the change as a draft would
 * leave the live site unchanged, and publishing it would also publish that draft's other edits.
 * So the published version is republished with only this change, and the draft is then saved
 * again on top, still unpublished. `change` returns undefined for a version that needs nothing.
 */
export async function changeProject(payload: Payload, id: number, change: Change) {
  const latest = (await payload.findByID({ collection: 'projects', id, draft: true, depth: 0 })) as Project
  const published =
    latest._status === 'published'
      ? latest
      : ((await payload.findByID({ collection: 'projects', id, depth: 0 }).catch(() => undefined)) as Project | undefined)
  const live = published?._status === 'published' ? published : undefined

  const forLive = live ? await change(live) : undefined
  const forDraft = latest !== live ? await change(latest) : undefined
  if (forLive) {
    await payload.update({ collection: 'projects', id, draft: false, data: { ...strip(live!), ...forLive, _status: 'published' } as never })
  }
  if (forDraft || (forLive && latest !== live)) {
    // Republishing made the published version the latest; the draft goes back on top.
    await payload.update({ collection: 'projects', id, draft: true, data: { ...strip(latest), ...forDraft, _status: 'draft' } as never })
  }
  return { live: Boolean(forLive), draft: Boolean(forDraft) }
}
