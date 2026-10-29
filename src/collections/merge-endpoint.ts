import { commitTransaction, initTransaction, killTransaction, type PayloadHandler, type PayloadRequest } from 'payload'

import { mergeFirmRecords } from '@/lib/merge-firms'
import { type MergeableCollection, mergeRecords } from '@/lib/merge-records'

/**
 * Merging two records of one firm, client or photographer from the admin
 * (components/admin/MergeRecords). A person picks both records and confirms. Staff only.
 */

type Collection = 'firms' | MergeableCollection

const refuse = () => Response.json({ error: 'Log in to the admin first.' }, { status: 401 })
const idParam = (req: PayloadRequest) => Number(req.routeParams?.id)

/**
 * POST /api/<collection>/:id/merge with { mergeId, confirm }: merges that record into this one.
 * Without confirm, says what would change and changes nothing. With it, does it all in one
 * transaction: on any error nothing is changed.
 */
export const mergeHandler =
  (collection: Collection): PayloadHandler =>
  async (req) => {
    if (!req.user) return refuse()
    const body = (await req.json?.().catch(() => ({}))) as { mergeId?: number; confirm?: boolean }
    const keepId = idParam(req)
    const mergeId = Number(body.mergeId)
    if (!mergeId) return Response.json({ error: 'Choose the record to merge into this one.' }, { status: 400 })
    if (mergeId === keepId) return Response.json({ error: 'That is this record.' }, { status: 400 })

    const find = (id: number) => req.payload.findByID({ collection, id, depth: 0, req }).catch(() => undefined)
    const keep = await find(keepId)
    const merge = await find(mergeId)
    if (!keep || !merge) return Response.json({ error: 'One of the two records no longer exists. Reload the page.' }, { status: 404 })

    const run = (write: boolean) =>
      collection === 'firms'
        ? mergeFirmRecords(req.payload, keep as never, merge as never, write, req)
        : mergeRecords(req.payload, collection, keep, merge, write, req)

    if (!body.confirm) return Response.json({ ...(await run(false)), merged: false })

    const started = await initTransaction(req)
    try {
      const result = await run(true)
      if (started) await commitTransaction(req)
      return Response.json({ ...result, merged: true })
    } catch (error) {
      if (started) await killTransaction(req)
      const detail = (error as { data?: { errors?: { message?: string }[] } })?.data?.errors?.[0]?.message
      const message = detail ?? (error instanceof Error ? error.message : 'The merge failed.')
      return Response.json({ error: `Nothing was changed: ${message}` }, { status: 400 })
    }
  }
