import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_years_of_light_hidden_cards" AS ENUM('completed', 'where', 'awards', 'collaborators', 'studio', 'light');
  CREATE TYPE "public"."enum_years_of_light_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__years_of_light_v_version_hidden_cards" AS ENUM('completed', 'where', 'awards', 'collaborators', 'studio', 'light');
  CREATE TYPE "public"."enum__years_of_light_v_version_status" AS ENUM('draft', 'published');
  CREATE TABLE "years_of_light_hidden_cards" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_years_of_light_hidden_cards",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "years_of_light_studio" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"value" varchar,
  	"label" varchar
  );
  
  CREATE TABLE "years_of_light" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"year" numeric,
  	"title" varchar,
  	"intro" varchar,
  	"where_note" varchar,
  	"light_project_id" integer,
  	"light_image_id" integer,
  	"light_quote" varchar,
  	"light_quote_by_id" integer,
  	"thanks" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_years_of_light_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "years_of_light_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"firms_id" integer
  );
  
  CREATE TABLE "_years_of_light_v_version_hidden_cards" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum__years_of_light_v_version_hidden_cards",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "_years_of_light_v_version_studio" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"value" varchar,
  	"label" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_years_of_light_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_year" numeric,
  	"version_title" varchar,
  	"version_intro" varchar,
  	"version_where_note" varchar,
  	"version_light_project_id" integer,
  	"version_light_image_id" integer,
  	"version_light_quote" varchar,
  	"version_light_quote_by_id" integer,
  	"version_thanks" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__years_of_light_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean,
  	"autosave" boolean
  );
  
  CREATE TABLE "_years_of_light_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"firms_id" integer
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "years_of_light_id" integer;
  ALTER TABLE "years_of_light_hidden_cards" ADD CONSTRAINT "years_of_light_hidden_cards_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."years_of_light"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "years_of_light_studio" ADD CONSTRAINT "years_of_light_studio_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."years_of_light"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "years_of_light" ADD CONSTRAINT "years_of_light_light_project_id_projects_id_fk" FOREIGN KEY ("light_project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "years_of_light" ADD CONSTRAINT "years_of_light_light_image_id_media_id_fk" FOREIGN KEY ("light_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "years_of_light" ADD CONSTRAINT "years_of_light_light_quote_by_id_people_id_fk" FOREIGN KEY ("light_quote_by_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "years_of_light_rels" ADD CONSTRAINT "years_of_light_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."years_of_light"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "years_of_light_rels" ADD CONSTRAINT "years_of_light_rels_firms_fk" FOREIGN KEY ("firms_id") REFERENCES "public"."firms"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_years_of_light_v_version_hidden_cards" ADD CONSTRAINT "_years_of_light_v_version_hidden_cards_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_years_of_light_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_years_of_light_v_version_studio" ADD CONSTRAINT "_years_of_light_v_version_studio_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_years_of_light_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_years_of_light_v" ADD CONSTRAINT "_years_of_light_v_parent_id_years_of_light_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."years_of_light"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_years_of_light_v" ADD CONSTRAINT "_years_of_light_v_version_light_project_id_projects_id_fk" FOREIGN KEY ("version_light_project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_years_of_light_v" ADD CONSTRAINT "_years_of_light_v_version_light_image_id_media_id_fk" FOREIGN KEY ("version_light_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_years_of_light_v" ADD CONSTRAINT "_years_of_light_v_version_light_quote_by_id_people_id_fk" FOREIGN KEY ("version_light_quote_by_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_years_of_light_v_rels" ADD CONSTRAINT "_years_of_light_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_years_of_light_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_years_of_light_v_rels" ADD CONSTRAINT "_years_of_light_v_rels_firms_fk" FOREIGN KEY ("firms_id") REFERENCES "public"."firms"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "years_of_light_hidden_cards_order_idx" ON "years_of_light_hidden_cards" USING btree ("order");
  CREATE INDEX "years_of_light_hidden_cards_parent_idx" ON "years_of_light_hidden_cards" USING btree ("parent_id");
  CREATE INDEX "years_of_light_studio_order_idx" ON "years_of_light_studio" USING btree ("_order");
  CREATE INDEX "years_of_light_studio_parent_id_idx" ON "years_of_light_studio" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "years_of_light_year_idx" ON "years_of_light" USING btree ("year");
  CREATE INDEX "years_of_light_light_light_project_idx" ON "years_of_light" USING btree ("light_project_id");
  CREATE INDEX "years_of_light_light_light_image_idx" ON "years_of_light" USING btree ("light_image_id");
  CREATE INDEX "years_of_light_light_light_quote_by_idx" ON "years_of_light" USING btree ("light_quote_by_id");
  CREATE INDEX "years_of_light_updated_at_idx" ON "years_of_light" USING btree ("updated_at");
  CREATE INDEX "years_of_light_created_at_idx" ON "years_of_light" USING btree ("created_at");
  CREATE INDEX "years_of_light__status_idx" ON "years_of_light" USING btree ("_status");
  CREATE INDEX "years_of_light_rels_order_idx" ON "years_of_light_rels" USING btree ("order");
  CREATE INDEX "years_of_light_rels_parent_idx" ON "years_of_light_rels" USING btree ("parent_id");
  CREATE INDEX "years_of_light_rels_path_idx" ON "years_of_light_rels" USING btree ("path");
  CREATE INDEX "years_of_light_rels_firms_id_idx" ON "years_of_light_rels" USING btree ("firms_id");
  CREATE INDEX "_years_of_light_v_version_hidden_cards_order_idx" ON "_years_of_light_v_version_hidden_cards" USING btree ("order");
  CREATE INDEX "_years_of_light_v_version_hidden_cards_parent_idx" ON "_years_of_light_v_version_hidden_cards" USING btree ("parent_id");
  CREATE INDEX "_years_of_light_v_version_studio_order_idx" ON "_years_of_light_v_version_studio" USING btree ("_order");
  CREATE INDEX "_years_of_light_v_version_studio_parent_id_idx" ON "_years_of_light_v_version_studio" USING btree ("_parent_id");
  CREATE INDEX "_years_of_light_v_parent_idx" ON "_years_of_light_v" USING btree ("parent_id");
  CREATE INDEX "_years_of_light_v_version_version_year_idx" ON "_years_of_light_v" USING btree ("version_year");
  CREATE INDEX "_years_of_light_v_version_light_version_light_project_idx" ON "_years_of_light_v" USING btree ("version_light_project_id");
  CREATE INDEX "_years_of_light_v_version_light_version_light_image_idx" ON "_years_of_light_v" USING btree ("version_light_image_id");
  CREATE INDEX "_years_of_light_v_version_light_version_light_quote_by_idx" ON "_years_of_light_v" USING btree ("version_light_quote_by_id");
  CREATE INDEX "_years_of_light_v_version_version_updated_at_idx" ON "_years_of_light_v" USING btree ("version_updated_at");
  CREATE INDEX "_years_of_light_v_version_version_created_at_idx" ON "_years_of_light_v" USING btree ("version_created_at");
  CREATE INDEX "_years_of_light_v_version_version__status_idx" ON "_years_of_light_v" USING btree ("version__status");
  CREATE INDEX "_years_of_light_v_created_at_idx" ON "_years_of_light_v" USING btree ("created_at");
  CREATE INDEX "_years_of_light_v_updated_at_idx" ON "_years_of_light_v" USING btree ("updated_at");
  CREATE INDEX "_years_of_light_v_latest_idx" ON "_years_of_light_v" USING btree ("latest");
  CREATE INDEX "_years_of_light_v_autosave_idx" ON "_years_of_light_v" USING btree ("autosave");
  CREATE INDEX "_years_of_light_v_rels_order_idx" ON "_years_of_light_v_rels" USING btree ("order");
  CREATE INDEX "_years_of_light_v_rels_parent_idx" ON "_years_of_light_v_rels" USING btree ("parent_id");
  CREATE INDEX "_years_of_light_v_rels_path_idx" ON "_years_of_light_v_rels" USING btree ("path");
  CREATE INDEX "_years_of_light_v_rels_firms_id_idx" ON "_years_of_light_v_rels" USING btree ("firms_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_years_of_light_fk" FOREIGN KEY ("years_of_light_id") REFERENCES "public"."years_of_light"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_years_of_light_id_idx" ON "payload_locked_documents_rels" USING btree ("years_of_light_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "years_of_light_hidden_cards" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "years_of_light_studio" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "years_of_light" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "years_of_light_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_years_of_light_v_version_hidden_cards" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_years_of_light_v_version_studio" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_years_of_light_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_years_of_light_v_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "years_of_light_hidden_cards" CASCADE;
  DROP TABLE "years_of_light_studio" CASCADE;
  DROP TABLE "years_of_light" CASCADE;
  DROP TABLE "years_of_light_rels" CASCADE;
  DROP TABLE "_years_of_light_v_version_hidden_cards" CASCADE;
  DROP TABLE "_years_of_light_v_version_studio" CASCADE;
  DROP TABLE "_years_of_light_v" CASCADE;
  DROP TABLE "_years_of_light_v_rels" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_years_of_light_fk";
  
  DROP INDEX "payload_locked_documents_rels_years_of_light_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "years_of_light_id";
  DROP TYPE "public"."enum_years_of_light_hidden_cards";
  DROP TYPE "public"."enum_years_of_light_status";
  DROP TYPE "public"."enum__years_of_light_v_version_hidden_cards";
  DROP TYPE "public"."enum__years_of_light_v_version_status";`)
}
