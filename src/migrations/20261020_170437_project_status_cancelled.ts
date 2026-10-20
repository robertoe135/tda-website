import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_projects_project_status" ADD VALUE 'cancelled';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "projects" ALTER COLUMN "status" SET DATA TYPE text;
  ALTER TABLE "_projects_v" ALTER COLUMN "version_status" SET DATA TYPE text;
  DROP TYPE "public"."enum_projects_project_status";
  CREATE TYPE "public"."enum_projects_project_status" AS ENUM('completed', 'in-progress', 'unbuilt');
  ALTER TABLE "projects" ALTER COLUMN "status" SET DATA TYPE "public"."enum_projects_project_status" USING "status"::"public"."enum_projects_project_status";
  ALTER TABLE "_projects_v" ALTER COLUMN "version_status" SET DATA TYPE "public"."enum_projects_project_status" USING "version_status"::"public"."enum_projects_project_status";`)
}
