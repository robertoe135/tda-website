import type { PayloadHandler } from 'payload'

import { projectsCsv } from '@/lib/project-export'
import { toCsv } from '@/lib/csv'
import { buildWorksheet, checkTeamCredits, ROLE_LABELS, saveTeamCredits, worksheetCsv } from '@/lib/team-credits'

/**
 * Spreadsheet tools on the admin's Projects list (components/admin/ProjectTools): download every
 * project, download the team worksheet, and check then save a filled-in worksheet. Staff only.
 */

const download = (body: string, filename: string) =>
  new Response(`﻿${body}`, {
    // The byte-order mark makes Excel read accents (Höweler, Fouquet’s) correctly.
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${filename}"`, 'Cache-Control': 'no-store' },
  })
const today = () => new Date().toISOString().slice(0, 10)
const refuse = () => Response.json({ error: 'Log in to the admin first.' }, { status: 401 })

export const exportProjects: PayloadHandler = async (req) => {
  if (!req.user) return refuse()
  return download(await projectsCsv(req.payload), `tda-projects-${today()}.csv`)
}

export const teamWorksheet: PayloadHandler = async (req) => {
  if (!req.user) return refuse()
  const { rows, names } = await buildWorksheet(req.payload)
  if (req.searchParams.get('names')) return download(toCsv(names, ['name', 'title', 'current staff']), `tda-team-names-${today()}.csv`)
  return download(worksheetCsv(rows), `tda-team-worksheet-${today()}.csv`)
}

/** Body: { csv, createPeople?, save? }. Always checks; saves drafts only when asked and the sheet has no problems. */
export const importTeam: PayloadHandler = async (req) => {
  if (!req.user) return refuse()
  const body = (await req.json?.().catch(() => ({}))) as { csv?: string; createPeople?: boolean; save?: boolean }
  if (!body.csv?.trim()) return Response.json({ error: 'Choose a CSV file first.' }, { status: 400 })
  if (body.csv.length > 2_000_000) return Response.json({ error: 'That file is too large for a team sheet.' }, { status: 400 })
  const plan = await checkTeamCredits(req.payload, body.csv, { createPeople: Boolean(body.createPeople) })
  const summary = {
    problems: plan.problems,
    warnings: plan.warnings,
    projects: plan.projects.map((p) => ({ id: p.id, name: p.name, team: p.team.map((c) => `${c.person} (${ROLE_LABELS[c.role]})`) })),
    newPeople: plan.newPeople.map((c) => c.person),
  }
  if (!body.save || plan.problems.length) return Response.json({ ...summary, saved: false })
  await saveTeamCredits(req.payload, plan)
  return Response.json({ ...summary, saved: true })
}
