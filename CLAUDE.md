# TDA Website

Public website for Tillotson Design Associates (tillotsondesign.com), replacing the current
Squarespace site. Payload CMS 3 inside Next.js (App Router), TypeScript, Postgres, pnpm.

For any work in this repo, read `.claude/skills/tda-website/SKILL.md` first. Its `references/`
folder holds the audit of the current site, the competitor analysis, and the pitfall list.
`docs/decisions.md` records why this stack was chosen and the questions TDA still has to answer.

## Non-negotiables

- Project information is structured data. Never store architect, location, year or team as
  free text inside a name or description.
- Every tag, chip or metadata label links to a filtered view or a detail page. No dead ends.
  The one exception, by TDA's choice: a project's client is plain text (see the skill).
- Never write, invent or "improve" biographies, project descriptions, client names or credits.
  Leave fields empty and flag them for marketing.
- Never connect to the internal TDA app (app.tillotsondesign.com) at runtime or reuse its
  credentials. Data comes from it only one way, by a person's action, as an allowlist of public
  fields written as drafts: a script, or the app's "Send to website" button calling
  `POST /api/projects/from-app` with this site's own `APP_SYNC_TOKEN` (docs/app-sync.md).
- Never correct real place, firm or project names on your own. Write anomalies to a review file.
  The app-sync endpoint may link a sent name to the closest existing record, never renaming
  either, only in a draft and only marked "Suggested: check" on the project's From the TDA app
  tab (docs/app-sync.md).
- Editors are marketing staff, not developers. A change that only a developer can maintain needs
  a reason, and should usually be a field in the admin instead.
- Publishing in the admin must update the live site without a redeploy (revalidation hooks).
- Schema changes ship with a committed migration. Production never relies on push mode.

## Commands

- `pnpm dev`: local dev, admin at http://localhost:3000/admin
- `pnpm payload generate:types`: regenerate `payload-types.ts` after any schema change
- `pnpm payload migrate:create <name>` / `pnpm payload migrate`
- `pnpm build` and `pnpm tsc --noEmit` must pass before a task is done

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
