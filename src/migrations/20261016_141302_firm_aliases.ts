import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "firms_aliases" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"normalized_name" varchar
  );
  
  ALTER TABLE "firms_aliases" ADD CONSTRAINT "firms_aliases_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."firms"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "firms_aliases_order_idx" ON "firms_aliases" USING btree ("_order");
  CREATE INDEX "firms_aliases_parent_id_idx" ON "firms_aliases" USING btree ("_parent_id");
  CREATE INDEX "firms_aliases_normalized_name_idx" ON "firms_aliases" USING btree ("normalized_name");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "firms_aliases" CASCADE;`)
}
