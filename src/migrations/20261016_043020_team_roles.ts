import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_projects_team_role" AS ENUM('principal', 'project-manager', 'designer');
  CREATE TYPE "public"."enum__projects_v_version_team_role" AS ENUM('principal', 'project-manager', 'designer');
  CREATE TABLE "projects_team" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"person_id" integer,
  	"role" "enum_projects_team_role"
  );
  
  CREATE TABLE "_projects_v_version_team" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"person_id" integer,
  	"role" "enum__projects_v_version_team_role",
  	"_uuid" varchar
  );
  
  ALTER TABLE "projects_rels" DROP CONSTRAINT IF EXISTS "projects_rels_people_fk";
  
  ALTER TABLE "_projects_v_rels" DROP CONSTRAINT IF EXISTS "_projects_v_rels_people_fk";
  
  DROP INDEX IF EXISTS "projects_rels_people_id_idx";
  DROP INDEX IF EXISTS "_projects_v_rels_people_id_idx";
  ALTER TABLE "projects_team" ADD CONSTRAINT "projects_team_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "projects_team" ADD CONSTRAINT "projects_team_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_projects_v_version_team" ADD CONSTRAINT "_projects_v_version_team_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_projects_v_version_team" ADD CONSTRAINT "_projects_v_version_team_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_projects_v"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "projects_team_order_idx" ON "projects_team" USING btree ("_order");
  CREATE INDEX "projects_team_parent_id_idx" ON "projects_team" USING btree ("_parent_id");
  CREATE INDEX "projects_team_person_idx" ON "projects_team" USING btree ("person_id");
  CREATE INDEX "_projects_v_version_team_order_idx" ON "_projects_v_version_team" USING btree ("_order");
  CREATE INDEX "_projects_v_version_team_parent_id_idx" ON "_projects_v_version_team" USING btree ("_parent_id");
  CREATE INDEX "_projects_v_version_team_person_idx" ON "_projects_v_version_team" USING btree ("person_id");
  ALTER TABLE "projects_rels" DROP COLUMN "people_id";
  ALTER TABLE "_projects_v_rels" DROP COLUMN "people_id";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "projects_team" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_projects_v_version_team" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "projects_team" CASCADE;
  DROP TABLE "_projects_v_version_team" CASCADE;
  ALTER TABLE "projects_rels" ADD COLUMN "people_id" integer;
  ALTER TABLE "_projects_v_rels" ADD COLUMN "people_id" integer;
  ALTER TABLE "projects_rels" ADD CONSTRAINT "projects_rels_people_fk" FOREIGN KEY ("people_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_projects_v_rels" ADD CONSTRAINT "_projects_v_rels_people_fk" FOREIGN KEY ("people_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "projects_rels_people_id_idx" ON "projects_rels" USING btree ("people_id");
  CREATE INDEX "_projects_v_rels_people_id_idx" ON "_projects_v_rels" USING btree ("people_id");
  DROP TYPE "public"."enum_projects_team_role";
  DROP TYPE "public"."enum__projects_v_version_team_role";`)
}
