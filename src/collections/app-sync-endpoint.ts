import { timingSafeEqual } from 'crypto'
import type { PayloadHandler } from 'payload'

import { planAppProject, readAppProject, saveAppProject } from '@/lib/app-sync'

/**
 * POST /api/projects/from-app: the internal TDA app's "Send to website" button (docs/app-sync.md).
 *
 * The app calls the website; the website never calls the app. The request carries this site's
 * own APP_SYNC_TOKEN (never one of the app's credentials); without it set, nothing is accepted.
 * Body: the allowlisted project (lib/app-sync) plus `save`. Without `save` it only checks and
 * reports; with it, it saves a draft. Nothing is published.
 */

const MAX_BODY = 200_000

function tokenMatches(header: string | null): boolean {
  const expected = process.env.APP_SYNC_TOKEN
  if (!expected || !header?.startsWith('Bearer ')) return false
  const a = Buffer.from(header.slice(7))
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

export const fromApp: PayloadHandler = async (req) => {
  if (!process.env.APP_SYNC_TOKEN) return Response.json({ error: 'Sending from the app is not set up on the website (APP_SYNC_TOKEN).' }, { status: 503 })
  if (!tokenMatches(req.headers.get('authorization'))) return Response.json({ error: 'Not authorized.' }, { status: 401 })

  const raw = (await req.text?.().catch(() => '')) ?? ''
  if (raw.length > MAX_BODY) return Response.json({ error: 'That request is too large.' }, { status: 413 })
  let body: Record<string, unknown>
  try {
    body = JSON.parse(raw || '{}')
  } catch {
    return Response.json({ error: 'The request is not valid JSON.' }, { status: 400 })
  }

  const { project, problems } = readAppProject(body)
  if (!project) return Response.json({ error: problems.join(' '), problems }, { status: 422 })

  const plan = await planAppProject(req.payload, project)
  const summary = {
    project: plan.existing
      ? { id: plan.existing.id, name: plan.existing.name, isNew: false }
      : { id: null, name: plan.name, isNew: true },
    filled: plan.filled,
    kept: plan.kept,
    matches: plan.matches,
    warnings: plan.warnings,
  }
  if (body.save !== true) return Response.json({ ...summary, saved: false })

  const saved = await saveAppProject(req.payload, plan)
  req.payload.logger.info({ projectNumber: project.projectNumber, id: saved.id, created: saved.created, sentBy: project.sentBy }, 'Project draft sent from the TDA app')
  const site = (process.env.NEXT_PUBLIC_SERVER_URL ?? '').replace(/\/+$/, '')
  return Response.json({
    ...summary,
    saved: true,
    project: { ...summary.project, id: saved.id },
    adminUrl: `${site}/admin/collections/projects/${saved.id}`,
  })
}
