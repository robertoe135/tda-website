import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "photographers" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"website" varchar,
  	"normalized_name" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "photographers_id" integer;
  CREATE UNIQUE INDEX "photographers_name_idx" ON "photographers" USING btree ("name");
  CREATE UNIQUE INDEX "photographers_normalized_name_idx" ON "photographers" USING btree ("normalized_name");
  CREATE INDEX "photographers_updated_at_idx" ON "photographers" USING btree ("updated_at");
  CREATE INDEX "photographers_created_at_idx" ON "photographers" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_photographers_fk" FOREIGN KEY ("photographers_id") REFERENCES "public"."photographers"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_photographers_id_idx" ON "payload_locked_documents_rels" USING btree ("photographers_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "photographers" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "photographers" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_photographers_fk";
  
  DROP INDEX IF EXISTS "payload_locked_documents_rels_photographers_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "photographers_id";`)
}
