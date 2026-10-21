import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

import { toSlug } from '../fields/slug'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "photographers" ADD COLUMN "generate_slug" boolean DEFAULT true;
  ALTER TABLE "photographers" ADD COLUMN "slug" varchar;
  CREATE UNIQUE INDEX "photographers_slug_idx" ON "photographers" USING btree ("slug");`)

  // Every existing photographer gets an address from their name (Iwan Baan → iwan-baan), so
  // credits can link to their projects. Straight in the database: no hooks run on old records.
  const { rows } = await db.execute(sql`SELECT id, name FROM photographers ORDER BY id`)
  const used = new Set<string>()
  for (const row of rows as { id: number; name: string }[]) {
    const base = toSlug(row.name) ?? `photographer-${row.id}`
    let candidate = base
    for (let n = 2; used.has(candidate); n++) candidate = `${base}-${n}`
    used.add(candidate)
    await db.execute(sql`UPDATE photographers SET slug = ${candidate} WHERE id = ${row.id}`)
  }
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "photographers_slug_idx";
  ALTER TABLE "photographers" DROP COLUMN "generate_slug";
  ALTER TABLE "photographers" DROP COLUMN "slug";`)
}
