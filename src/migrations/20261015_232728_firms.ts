import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "firms" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"website" varchar,
  	"normalized_name" varchar,
  	"generate_slug" boolean DEFAULT true,
  	"slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "firms_id" integer;
  CREATE UNIQUE INDEX "firms_name_idx" ON "firms" USING btree ("name");
  CREATE UNIQUE INDEX "firms_normalized_name_idx" ON "firms" USING btree ("normalized_name");
  CREATE UNIQUE INDEX "firms_slug_idx" ON "firms" USING btree ("slug");
  CREATE INDEX "firms_updated_at_idx" ON "firms" USING btree ("updated_at");
  CREATE INDEX "firms_created_at_idx" ON "firms" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_firms_fk" FOREIGN KEY ("firms_id") REFERENCES "public"."firms"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_firms_id_idx" ON "payload_locked_documents_rels" USING btree ("firms_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "firms" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "firms" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_firms_fk";
  
  DROP INDEX IF EXISTS "payload_locked_documents_rels_firms_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "firms_id";`)
}
