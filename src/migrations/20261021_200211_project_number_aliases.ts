import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "projects_aliases" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar
  );
  
  CREATE TABLE "_projects_v_version_aliases" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"_uuid" varchar
  );
  
  ALTER TABLE "projects" ADD COLUMN "project_number" varchar;
  ALTER TABLE "_projects_v" ADD COLUMN "version_project_number" varchar;
  ALTER TABLE "projects_aliases" ADD CONSTRAINT "projects_aliases_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_projects_v_version_aliases" ADD CONSTRAINT "_projects_v_version_aliases_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_projects_v"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "projects_aliases_order_idx" ON "projects_aliases" USING btree ("_order");
  CREATE INDEX "projects_aliases_parent_id_idx" ON "projects_aliases" USING btree ("_parent_id");
  CREATE INDEX "_projects_v_version_aliases_order_idx" ON "_projects_v_version_aliases" USING btree ("_order");
  CREATE INDEX "_projects_v_version_aliases_parent_id_idx" ON "_projects_v_version_aliases" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "projects_project_number_idx" ON "projects" USING btree ("project_number");
  CREATE INDEX "_projects_v_version_version_project_number_idx" ON "_projects_v" USING btree ("version_project_number");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "projects_aliases" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_projects_v_version_aliases" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "projects_aliases" CASCADE;
  DROP TABLE "_projects_v_version_aliases" CASCADE;
  DROP INDEX "projects_project_number_idx";
  DROP INDEX "_projects_v_version_version_project_number_idx";
  ALTER TABLE "projects" DROP COLUMN "project_number";
  ALTER TABLE "_projects_v" DROP COLUMN "version_project_number";`)
}
