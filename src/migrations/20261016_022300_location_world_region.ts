import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_locations_world_region" AS ENUM('north-america', 'south-america', 'europe', 'middle-east', 'africa', 'asia-pacific');
  ALTER TABLE "locations" ADD COLUMN "world_region" "enum_locations_world_region";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "locations" DROP COLUMN "world_region";
  DROP TYPE "public"."enum_locations_world_region";`)
}
