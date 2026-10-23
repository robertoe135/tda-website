import { commitTransaction, initTransaction, killTransaction, type PayloadHandler, type PayloadRequest } from 'payload'

import { duplicatePairs, likelySameFirm } from '@/lib/firm-names'
import { mergeFirmRecords } from '@/lib/merge-firms'
import type { Firm } from '@/payload-types'

/**
 * The admin's duplicate tools for Firms & clients (components/admin/MergeFirm, FirmDuplicates).
 * Suggestions only: a person picks the record to keep and confirms each merge. Staff only.
 */

const refuse = () => Response.json({ error: 'Log in to the admin first.' }, { status: 401 })
const namesOf = (f: Pick<Firm, 'name' | 'aliases'>) => [f.name, ...(f.aliases ?? []).map((a) => a.name)]
const alike = (a: Pick<Firm, 'name' | 'aliases'>, b: Pick<Firm, 'name' | 'aliases'>) =>
  namesOf(a).some((x) => namesOf(b).some((y) => likelySameFirm(x, y)))

async function allFirms(req: PayloadRequest) {
  const firms = await req.payload.find({ collection: 'firms', pagination: false, depth: 0, sort: 'name', select: { name: true, aliases: true } })
  return firms.docs
}

const idParam = (req: PayloadRequest) => Number(req.routeParams?.id)

/** GET /api/firms/:id/duplicates: other records that look like the same firm. */
export const firmDuplicates: PayloadHandler = async (req) => {
  if (!req.user) return refuse()
  const id = idParam(req)
  const firms = await allFirms(req)
  const self = firms.find((f) => f.id === id)
  if (!self) return Response.json({ error: 'No such firm.' }, { status: 404 })
  return Response.json({ firms: firms.filter((f) => f.id !== id && alike(self, f)).map((f) => ({ id: f.id, name: f.name })) })
}

/** GET /api/firms/duplicates: every pair of records that look like the same firm, A to Z. */
export const allFirmDuplicates: PayloadHandler = async (req) => {
  if (!req.user) return refuse()
  const firms = (await allFirms(req)).map((f) => ({ id: f.id, name: f.name, names: namesOf(f) }))
  const pairs = duplicatePairs(firms)
    .map(([a, b]) => ({ a: { id: a.id, name: a.name }, b: { id: b.id, name: b.name } }))
    .sort((p, q) => p.a.name.localeCompare(q.a.name))
  return Response.json({ pairs })
}

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
