import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_projects_certifications_system" AS ENUM('leed', 'well', 'other');
  CREATE TYPE "public"."enum_projects_certifications_level" AS ENUM('certified', 'silver', 'gold', 'platinum');
  CREATE TYPE "public"."enum__projects_v_version_certifications_system" AS ENUM('leed', 'well', 'other');
  CREATE TYPE "public"."enum__projects_v_version_certifications_level" AS ENUM('certified', 'silver', 'gold', 'platinum');
  CREATE TABLE "projects_certifications" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"system" "enum_projects_certifications_system",
  	"level" "enum_projects_certifications_level",
  	"note" varchar
  );
  
  CREATE TABLE "projects_credits" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"role_id" integer
  );
  
  CREATE TABLE "_projects_v_version_certifications" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"system" "enum__projects_v_version_certifications_system",
  	"level" "enum__projects_v_version_certifications_level",
  	"note" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_projects_v_version_credits" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"role_id" integer,
  	"_uuid" varchar
  );
  
  CREATE TABLE "credit_roles" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"order" numeric,
  	"normalized_name" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "projects_other_collaborators" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_projects_v_version_other_collaborators" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "projects_other_collaborators" CASCADE;
  DROP TABLE "_projects_v_version_other_collaborators" CASCADE;
  ALTER TABLE "projects" ADD COLUMN "area_sq_ft" numeric;
  ALTER TABLE "projects" ADD COLUMN "area_note" varchar;
  ALTER TABLE "_projects_v" ADD COLUMN "version_area_sq_ft" numeric;
  ALTER TABLE "_projects_v" ADD COLUMN "version_area_note" varchar;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "credit_roles_id" integer;
  ALTER TABLE "projects_certifications" ADD CONSTRAINT "projects_certifications_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "projects_credits" ADD CONSTRAINT "projects_credits_role_id_credit_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."credit_roles"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "projects_credits" ADD CONSTRAINT "projects_credits_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_projects_v_version_certifications" ADD CONSTRAINT "_projects_v_version_certifications_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_projects_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_projects_v_version_credits" ADD CONSTRAINT "_projects_v_version_credits_role_id_credit_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."credit_roles"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_projects_v_version_credits" ADD CONSTRAINT "_projects_v_version_credits_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_projects_v"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "projects_certifications_order_idx" ON "projects_certifications" USING btree ("_order");
  CREATE INDEX "projects_certifications_parent_id_idx" ON "projects_certifications" USING btree ("_parent_id");
  CREATE INDEX "projects_credits_order_idx" ON "projects_credits" USING btree ("_order");
  CREATE INDEX "projects_credits_parent_id_idx" ON "projects_credits" USING btree ("_parent_id");
  CREATE INDEX "projects_credits_role_idx" ON "projects_credits" USING btree ("role_id");
  CREATE INDEX "_projects_v_version_certifications_order_idx" ON "_projects_v_version_certifications" USING btree ("_order");
  CREATE INDEX "_projects_v_version_certifications_parent_id_idx" ON "_projects_v_version_certifications" USING btree ("_parent_id");
  CREATE INDEX "_projects_v_version_credits_order_idx" ON "_projects_v_version_credits" USING btree ("_order");
  CREATE INDEX "_projects_v_version_credits_parent_id_idx" ON "_projects_v_version_credits" USING btree ("_parent_id");
  CREATE INDEX "_projects_v_version_credits_role_idx" ON "_projects_v_version_credits" USING btree ("role_id");
  CREATE UNIQUE INDEX "credit_roles_name_idx" ON "credit_roles" USING btree ("name");
  CREATE UNIQUE INDEX "credit_roles_normalized_name_idx" ON "credit_roles" USING btree ("normalized_name");
  CREATE INDEX "credit_roles_updated_at_idx" ON "credit_roles" USING btree ("updated_at");
  CREATE INDEX "credit_roles_created_at_idx" ON "credit_roles" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_credit_roles_fk" FOREIGN KEY ("credit_roles_id") REFERENCES "public"."credit_roles"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_credit_roles_id_idx" ON "payload_locked_documents_rels" USING btree ("credit_roles_id");
  ALTER TABLE "projects" DROP COLUMN "client";
  ALTER TABLE "_projects_v" DROP COLUMN "version_client";
  DROP TYPE "public"."enum_projects_other_collaborators_role";
  DROP TYPE "public"."enum__projects_v_version_other_collaborators_role";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_projects_other_collaborators_role" AS ENUM('interior-designer', 'landscape-architect', 'exhibit-designer', 'artist', 'other');
  CREATE TYPE "public"."enum__projects_v_version_other_collaborators_role" AS ENUM('interior-designer', 'landscape-architect', 'exhibit-designer', 'artist', 'other');
  CREATE TABLE "projects_other_collaborators" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"firm_id" integer,
  	"role" "enum_projects_other_collaborators_role"
  );
  
  CREATE TABLE "_projects_v_version_other_collaborators" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"firm_id" integer,
  	"role" "enum__projects_v_version_other_collaborators_role",
  	"_uuid" varchar
  );
  
  ALTER TABLE "projects_certifications" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "projects_credits" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_projects_v_version_certifications" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_projects_v_version_credits" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "credit_roles" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "projects_certifications" CASCADE;
  DROP TABLE "projects_credits" CASCADE;
  DROP TABLE "_projects_v_version_certifications" CASCADE;
  DROP TABLE "_projects_v_version_credits" CASCADE;
  DROP TABLE "credit_roles" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_credit_roles_fk";
  
  DROP INDEX IF EXISTS "payload_locked_documents_rels_credit_roles_id_idx";
  ALTER TABLE "projects" ADD COLUMN "client" varchar;
  ALTER TABLE "_projects_v" ADD COLUMN "version_client" varchar;
  ALTER TABLE "projects_other_collaborators" ADD CONSTRAINT "projects_other_collaborators_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "projects_other_collaborators" ADD CONSTRAINT "projects_other_collaborators_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_projects_v_version_other_collaborators" ADD CONSTRAINT "_projects_v_version_other_collaborators_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_projects_v_version_other_collaborators" ADD CONSTRAINT "_projects_v_version_other_collaborators_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_projects_v"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "projects_other_collaborators_order_idx" ON "projects_other_collaborators" USING btree ("_order");
  CREATE INDEX "projects_other_collaborators_parent_id_idx" ON "projects_other_collaborators" USING btree ("_parent_id");
  CREATE INDEX "projects_other_collaborators_firm_idx" ON "projects_other_collaborators" USING btree ("firm_id");
  CREATE INDEX "_projects_v_version_other_collaborators_order_idx" ON "_projects_v_version_other_collaborators" USING btree ("_order");
  CREATE INDEX "_projects_v_version_other_collaborators_parent_id_idx" ON "_projects_v_version_other_collaborators" USING btree ("_parent_id");
  CREATE INDEX "_projects_v_version_other_collaborators_firm_idx" ON "_projects_v_version_other_collaborators" USING btree ("firm_id");
  ALTER TABLE "projects" DROP COLUMN "area_sq_ft";
  ALTER TABLE "projects" DROP COLUMN "area_note";
  ALTER TABLE "_projects_v" DROP COLUMN "version_area_sq_ft";
  ALTER TABLE "_projects_v" DROP COLUMN "version_area_note";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "credit_roles_id";
  DROP TYPE "public"."enum_projects_certifications_system";
  DROP TYPE "public"."enum_projects_certifications_level";
  DROP TYPE "public"."enum__projects_v_version_certifications_system";
  DROP TYPE "public"."enum__projects_v_version_certifications_level";`)
}
