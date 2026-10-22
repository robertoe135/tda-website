import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "home_blocks_project" ADD COLUMN "name" varchar;
  ALTER TABLE "_home_v_blocks_project" ADD COLUMN "name" varchar;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "home_blocks_project" DROP COLUMN "name";
  ALTER TABLE "_home_v_blocks_project" DROP COLUMN "name";`)
}
