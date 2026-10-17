import type { Payload } from 'payload'

/**
 * How long the site keeps people's applications and inquiries. The Leads screen tells staff
 * the same: delete once a position is filled, or after six months, whichever comes first.
 */
export const LEAD_RETENTION_MONTHS = 6

export function retentionCutoff(now: Date, months = LEAD_RETENTION_MONTHS): Date {
  const cutoff = new Date(now)
  cutoff.setUTCMonth(cutoff.getUTCMonth() - months)
  return cutoff
}

/** Deletes leads older than the retention period. Returns how many went; never who. */
export async function purgeOldLeads(payload: Payload, now = new Date()): Promise<number> {
  const cutoff = retentionCutoff(now)
  const old = await payload.delete({
    collection: 'leads',
    where: { createdAt: { less_than: cutoff.toISOString() } },
    overrideAccess: true,
  })
  return old.docs.length
}
