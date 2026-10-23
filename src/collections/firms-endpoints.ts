import { commitTransaction, initTransaction, killTransaction, type PayloadHandler, type PayloadRequest } from 'payload'

import { mergeFirmRecords } from '@/lib/merge-firms'

/**
 * Merging two records of one firm or client from the admin (components/admin/MergeFirm). A person
 * picks both records and confirms. Staff only.
 */

const refuse = () => Response.json({ error: 'Log in to the admin first.' }, { status: 401 })
const idParam = (req: PayloadRequest) => Number(req.routeParams?.id)

/**
 * POST /api/firms/:id/merge with { mergeId, confirm }: merges that record into this one.
 * Without confirm, says what would change and changes nothing. With it, does it all in one
 * transaction: on any error nothing is changed.
 */
export const mergeFirm: PayloadHandler = async (req) => {
  if (!req.user) return refuse()
  const body = (await req.json?.().catch(() => ({}))) as { mergeId?: number; confirm?: boolean }
  const keepId = idParam(req)
  const mergeId = Number(body.mergeId)
  if (!mergeId) return Response.json({ error: 'Choose the record to merge into this one.' }, { status: 400 })
  if (mergeId === keepId) return Response.json({ error: 'That is this record.' }, { status: 400 })

  const find = (id: number) => req.payload.findByID({ collection: 'firms', id, depth: 0, req }).catch(() => undefined)
  const keep = await find(keepId)
  const merge = await find(mergeId)
  if (!keep || !merge) return Response.json({ error: 'One of the two records no longer exists. Reload the page.' }, { status: 404 })

  if (!body.confirm) return Response.json({ ...(await mergeFirmRecords(req.payload, keep, merge, false, req)), merged: false })

  const started = await initTransaction(req)
  try {
    const result = await mergeFirmRecords(req.payload, keep, merge, true, req)
    if (started) await commitTransaction(req)
    return Response.json({ ...result, merged: true })
  } catch (error) {
    if (started) await killTransaction(req)
    const detail = (error as { data?: { errors?: { message?: string }[] } })?.data?.errors?.[0]?.message
    const message = detail ?? (error instanceof Error ? error.message : 'The merge failed.')
    return Response.json({ error: `Nothing was changed: ${message}` }, { status: 400 })
  }
}
