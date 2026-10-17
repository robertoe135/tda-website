import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_home_rows_height" AS ENUM('low', 'medium', 'tall', 'taller', 'tallest');
  CREATE TYPE "public"."enum__home_v_version_rows_height" AS ENUM('low', 'medium', 'tall', 'taller', 'tallest');
  ALTER TABLE "home_rows" ADD COLUMN "height" "enum_home_rows_height";
  ALTER TABLE "_home_v_version_rows" ADD COLUMN "height" "enum__home_v_version_rows_height";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "home_rows" DROP COLUMN "height";
  ALTER TABLE "_home_v_version_rows" DROP COLUMN "height";
  DROP TYPE "public"."enum_home_rows_height";
  DROP TYPE "public"."enum__home_v_version_rows_height";`)
}
