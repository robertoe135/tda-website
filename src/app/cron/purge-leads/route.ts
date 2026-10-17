import { getPayload } from 'payload'

import config from '@payload-config'
import { purgeOldLeads } from '@/lib/retention'

export const dynamic = 'force-dynamic'

/**
 * Called once a day by Vercel Cron (vercel.json). Deletes applications and inquiries older than
 * the retention period. Vercel sends the CRON_SECRET it was given; without it set, nothing runs.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return Response.json({ ok: false, error: 'CRON_SECRET is not set' }, { status: 503 })
  if (request.headers.get('authorization') !== `Bearer ${secret}`) return Response.json({ ok: false }, { status: 401 })
  const payload = await getPayload({ config })
  const deleted = await purgeOldLeads(payload)
  payload.logger.info({ deleted }, 'Old leads deleted')
  return Response.json({ ok: true, deleted })
}
