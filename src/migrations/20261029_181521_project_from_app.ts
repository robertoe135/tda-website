import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "projects" ADD COLUMN "from_app" jsonb;
  ALTER TABLE "_projects_v" ADD COLUMN "version_from_app" jsonb;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "projects" DROP COLUMN "from_app";
  ALTER TABLE "_projects_v" DROP COLUMN "version_from_app";`)
}
