import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "firms" ADD COLUMN "list_as_collaborator" boolean DEFAULT false;
  CREATE INDEX "firms_list_as_collaborator_idx" ON "firms" USING btree ("list_as_collaborator");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "firms_list_as_collaborator_idx";
  ALTER TABLE "firms" DROP COLUMN "list_as_collaborator";`)
}
