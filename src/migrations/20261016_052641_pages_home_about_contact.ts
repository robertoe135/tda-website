import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_home_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__home_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_about_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__about_v_version_status" AS ENUM('draft', 'published');
  CREATE TABLE "home_blocks_project" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"project_id" integer,
  	"block_name" varchar
  );
  
  CREATE TABLE "home_blocks_quote" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"text" varchar,
  	"attribution" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "home" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"_status" "enum_home_status" DEFAULT 'draft',
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "_home_v_blocks_project" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"project_id" integer,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_home_v_blocks_quote" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"text" varchar,
  	"attribution" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_home_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"version__status" "enum__home_v_version_status" DEFAULT 'draft',
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "about_sections" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"body" jsonb,
  	"image_id" integer
  );
  
  CREATE TABLE "_about_v_version_sections" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"body" jsonb,
  	"image_id" integer,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_about_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"version__status" "enum__about_v_version_status" DEFAULT 'draft',
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  ALTER TABLE "projects_rels" ADD COLUMN "photographers_id" integer;
  ALTER TABLE "_projects_v_rels" ADD COLUMN "photographers_id" integer;
  ALTER TABLE "site_settings" ADD COLUMN "intro" varchar;
  ALTER TABLE "site_settings" ADD COLUMN "careers_link" varchar;
  ALTER TABLE "about" ADD COLUMN "_status" "enum_about_status" DEFAULT 'draft';
  ALTER TABLE "home_blocks_project" ADD CONSTRAINT "home_blocks_project_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "home_blocks_project" ADD CONSTRAINT "home_blocks_project_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."home"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "home_blocks_quote" ADD CONSTRAINT "home_blocks_quote_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."home"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_home_v_blocks_project" ADD CONSTRAINT "_home_v_blocks_project_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_home_v_blocks_project" ADD CONSTRAINT "_home_v_blocks_project_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_home_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_home_v_blocks_quote" ADD CONSTRAINT "_home_v_blocks_quote_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_home_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "about_sections" ADD CONSTRAINT "about_sections_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "about_sections" ADD CONSTRAINT "about_sections_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."about"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_about_v_version_sections" ADD CONSTRAINT "_about_v_version_sections_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_about_v_version_sections" ADD CONSTRAINT "_about_v_version_sections_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_about_v"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "home_blocks_project_order_idx" ON "home_blocks_project" USING btree ("_order");
  CREATE INDEX "home_blocks_project_parent_id_idx" ON "home_blocks_project" USING btree ("_parent_id");
  CREATE INDEX "home_blocks_project_path_idx" ON "home_blocks_project" USING btree ("_path");
  CREATE INDEX "home_blocks_project_project_idx" ON "home_blocks_project" USING btree ("project_id");
  CREATE INDEX "home_blocks_quote_order_idx" ON "home_blocks_quote" USING btree ("_order");
  CREATE INDEX "home_blocks_quote_parent_id_idx" ON "home_blocks_quote" USING btree ("_parent_id");
  CREATE INDEX "home_blocks_quote_path_idx" ON "home_blocks_quote" USING btree ("_path");
  CREATE INDEX "home__status_idx" ON "home" USING btree ("_status");
  CREATE INDEX "_home_v_blocks_project_order_idx" ON "_home_v_blocks_project" USING btree ("_order");
  CREATE INDEX "_home_v_blocks_project_parent_id_idx" ON "_home_v_blocks_project" USING btree ("_parent_id");
  CREATE INDEX "_home_v_blocks_project_path_idx" ON "_home_v_blocks_project" USING btree ("_path");
  CREATE INDEX "_home_v_blocks_project_project_idx" ON "_home_v_blocks_project" USING btree ("project_id");
  CREATE INDEX "_home_v_blocks_quote_order_idx" ON "_home_v_blocks_quote" USING btree ("_order");
  CREATE INDEX "_home_v_blocks_quote_parent_id_idx" ON "_home_v_blocks_quote" USING btree ("_parent_id");
  CREATE INDEX "_home_v_blocks_quote_path_idx" ON "_home_v_blocks_quote" USING btree ("_path");
  CREATE INDEX "_home_v_version_version__status_idx" ON "_home_v" USING btree ("version__status");
  CREATE INDEX "_home_v_created_at_idx" ON "_home_v" USING btree ("created_at");
  CREATE INDEX "_home_v_updated_at_idx" ON "_home_v" USING btree ("updated_at");
  CREATE INDEX "_home_v_latest_idx" ON "_home_v" USING btree ("latest");
  CREATE INDEX "about_sections_order_idx" ON "about_sections" USING btree ("_order");
  CREATE INDEX "about_sections_parent_id_idx" ON "about_sections" USING btree ("_parent_id");
  CREATE INDEX "about_sections_image_idx" ON "about_sections" USING btree ("image_id");
  CREATE INDEX "_about_v_version_sections_order_idx" ON "_about_v_version_sections" USING btree ("_order");
  CREATE INDEX "_about_v_version_sections_parent_id_idx" ON "_about_v_version_sections" USING btree ("_parent_id");
  CREATE INDEX "_about_v_version_sections_image_idx" ON "_about_v_version_sections" USING btree ("image_id");
  CREATE INDEX "_about_v_version_version__status_idx" ON "_about_v" USING btree ("version__status");
  CREATE INDEX "_about_v_created_at_idx" ON "_about_v" USING btree ("created_at");
  CREATE INDEX "_about_v_updated_at_idx" ON "_about_v" USING btree ("updated_at");
  CREATE INDEX "_about_v_latest_idx" ON "_about_v" USING btree ("latest");
  ALTER TABLE "projects_rels" ADD CONSTRAINT "projects_rels_photographers_fk" FOREIGN KEY ("photographers_id") REFERENCES "public"."photographers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_projects_v_rels" ADD CONSTRAINT "_projects_v_rels_photographers_fk" FOREIGN KEY ("photographers_id") REFERENCES "public"."photographers"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "projects_rels_photographers_id_idx" ON "projects_rels" USING btree ("photographers_id");
  CREATE INDEX "_projects_v_rels_photographers_id_idx" ON "_projects_v_rels" USING btree ("photographers_id");
  CREATE INDEX "about__status_idx" ON "about" USING btree ("_status");
  ALTER TABLE "about" DROP COLUMN "philosophy";
  ALTER TABLE "about" DROP COLUMN "background";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "home_blocks_project" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "home_blocks_quote" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "home" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_home_v_blocks_project" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_home_v_blocks_quote" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_home_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "about_sections" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_about_v_version_sections" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_about_v" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "home_blocks_project" CASCADE;
  DROP TABLE "home_blocks_quote" CASCADE;
  DROP TABLE "home" CASCADE;
  DROP TABLE "_home_v_blocks_project" CASCADE;
  DROP TABLE "_home_v_blocks_quote" CASCADE;
  DROP TABLE "_home_v" CASCADE;
  DROP TABLE "about_sections" CASCADE;
  DROP TABLE "_about_v_version_sections" CASCADE;
  DROP TABLE "_about_v" CASCADE;
  ALTER TABLE "projects_rels" DROP CONSTRAINT IF EXISTS "projects_rels_photographers_fk";
  
  ALTER TABLE "_projects_v_rels" DROP CONSTRAINT IF EXISTS "_projects_v_rels_photographers_fk";
  
  DROP INDEX IF EXISTS "projects_rels_photographers_id_idx";
  DROP INDEX IF EXISTS "_projects_v_rels_photographers_id_idx";
  DROP INDEX IF EXISTS "about__status_idx";
  ALTER TABLE "about" ADD COLUMN "philosophy" jsonb;
  ALTER TABLE "about" ADD COLUMN "background" jsonb;
  ALTER TABLE "projects_rels" DROP COLUMN "photographers_id";
  ALTER TABLE "_projects_v_rels" DROP COLUMN "photographers_id";
  ALTER TABLE "about" DROP COLUMN "_status";
  ALTER TABLE "site_settings" DROP COLUMN "intro";
  ALTER TABLE "site_settings" DROP COLUMN "careers_link";
  DROP TYPE "public"."enum_home_status";
  DROP TYPE "public"."enum__home_v_version_status";
  DROP TYPE "public"."enum_about_status";
  DROP TYPE "public"."enum__about_v_version_status";`)
}
