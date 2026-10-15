# tda-website

Public website for Tillotson Design Associates (tillotsondesign.com). Payload CMS 3 inside
Next.js (App Router), TypeScript, Postgres, pnpm.

Start with `CLAUDE.md` and `.claude/skills/tda-website/SKILL.md`. Stack decisions and the
questions TDA still has to answer are in `docs/decisions.md`.

## Local setup

Requires Node 20.18+ (22 recommended), pnpm 10, and Postgres 16.

1. `cp .env.example .env` and set `PAYLOAD_SECRET` (`openssl rand -hex 32`).
2. Start Postgres. Either `docker compose up -d postgres`, or use a local install with a
   `tda` user and `tda_website` database matching `DATABASE_URL`.
3. `pnpm install`
4. `pnpm payload migrate` to create the tables.
5. `pnpm dev`, then open http://localhost:3000/admin and create the first admin user.

## Schema changes

Push mode is off, in development too, so the database only changes through committed
migrations. After editing a collection or global:

1. `pnpm payload generate:types`
2. `pnpm payload migrate:create <short-name>`
3. Check the new migration's `down` function. Payload 3.91 generates `DROP TABLE ... CASCADE`
   followed by `DROP CONSTRAINT` / `DROP INDEX` on objects the cascade already removed, so the
   rollback fails. Add `IF EXISTS` to those statements.
4. `pnpm payload migrate`, then `pnpm payload migrate:down` and `pnpm payload migrate` again to
   prove the rollback works.
5. Commit the collection change, `src/payload-types.ts` and the new files in `src/migrations/`
   together.

Production runs pending migrations on startup (`prodMigrations` in `src/payload.config.ts`).

## Checks

- `pnpm exec tsc --noEmit`
- `pnpm lint`
- `pnpm build`
- `pnpm test:int` (needs the database running)
- `pnpm test:e2e` (starts `pnpm dev` itself if nothing is on port 3000)
