import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "typologies" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"order" numeric,
  	"normalized_name" varchar,
  	"generate_slug" boolean DEFAULT true,
  	"slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "typologies_id" integer;
  CREATE UNIQUE INDEX "typologies_name_idx" ON "typologies" USING btree ("name");
  CREATE UNIQUE INDEX "typologies_normalized_name_idx" ON "typologies" USING btree ("normalized_name");
  CREATE UNIQUE INDEX "typologies_slug_idx" ON "typologies" USING btree ("slug");
  CREATE INDEX "typologies_updated_at_idx" ON "typologies" USING btree ("updated_at");
  CREATE INDEX "typologies_created_at_idx" ON "typologies" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_typologies_fk" FOREIGN KEY ("typologies_id") REFERENCES "public"."typologies"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_typologies_id_idx" ON "payload_locked_documents_rels" USING btree ("typologies_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "typologies" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "typologies" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_typologies_fk";
  
  DROP INDEX IF EXISTS "payload_locked_documents_rels_typologies_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "typologies_id";`)
}
