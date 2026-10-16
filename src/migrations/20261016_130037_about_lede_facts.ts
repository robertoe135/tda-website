import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "about_facts" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"value" varchar,
  	"label" varchar
  );
  
  CREATE TABLE "_about_v_version_facts" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"value" varchar,
  	"label" varchar,
  	"_uuid" varchar
  );
  
  ALTER TABLE "about" ADD COLUMN "lede" varchar;
  ALTER TABLE "_about_v" ADD COLUMN "version_lede" varchar;
  ALTER TABLE "about_facts" ADD CONSTRAINT "about_facts_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."about"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_about_v_version_facts" ADD CONSTRAINT "_about_v_version_facts_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_about_v"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "about_facts_order_idx" ON "about_facts" USING btree ("_order");
  CREATE INDEX "about_facts_parent_id_idx" ON "about_facts" USING btree ("_parent_id");
  CREATE INDEX "_about_v_version_facts_order_idx" ON "_about_v_version_facts" USING btree ("_order");
  CREATE INDEX "_about_v_version_facts_parent_id_idx" ON "_about_v_version_facts" USING btree ("_parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "about_facts" CASCADE;
  DROP TABLE "_about_v_version_facts" CASCADE;
  ALTER TABLE "about" DROP COLUMN "lede";
  ALTER TABLE "_about_v" DROP COLUMN "version_lede";`)
}
