import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "projects" ADD COLUMN "hide_from_timeline" boolean DEFAULT false;
  ALTER TABLE "_projects_v" ADD COLUMN "version_hide_from_timeline" boolean DEFAULT false;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "projects" DROP COLUMN "hide_from_timeline";
  ALTER TABLE "_projects_v" DROP COLUMN "version_hide_from_timeline";`)
}
