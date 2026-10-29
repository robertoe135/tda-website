import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Clients move out of Firms into their own staff-only collection (collections/Clients). Every
 * firm named as a project's client, in any version, gets a client record of the same name, and
 * the projects name that record instead. A firm that was only ever a client (on no project as
 * architect or in credits, in no Year of Light, not on the Collaborators page, no website) is
 * then removed from Firms. Firms that are also architects or consultants stay.
 */

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "clients" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"normalized_name" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "projects_rels" ADD COLUMN "clients_id" integer;
  ALTER TABLE "_projects_v_rels" ADD COLUMN "clients_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "clients_id" integer;
  CREATE UNIQUE INDEX "clients_name_idx" ON "clients" USING btree ("name");
  CREATE UNIQUE INDEX "clients_normalized_name_idx" ON "clients" USING btree ("normalized_name");
  CREATE INDEX "clients_updated_at_idx" ON "clients" USING btree ("updated_at");
  CREATE INDEX "clients_created_at_idx" ON "clients" USING btree ("created_at");
  ALTER TABLE "projects_rels" ADD CONSTRAINT "projects_rels_clients_fk" FOREIGN KEY ("clients_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_projects_v_rels" ADD CONSTRAINT "_projects_v_rels_clients_fk" FOREIGN KEY ("clients_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_clients_fk" FOREIGN KEY ("clients_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "projects_rels_clients_id_idx" ON "projects_rels" USING btree ("clients_id");
  CREATE INDEX "_projects_v_rels_clients_id_idx" ON "_projects_v_rels" USING btree ("clients_id");
  CREATE INDEX "payload_locked_documents_rels_clients_id_idx" ON "payload_locked_documents_rels" USING btree ("clients_id");`)

  await db.execute(sql`
  CREATE TEMP TABLE "client_firms" ON COMMIT DROP AS
    SELECT f."id" AS "firm_id", f."name", f."normalized_name", NULL::integer AS "client_id"
    FROM "firms" f
    WHERE f."id" IN (
      SELECT "firms_id" FROM "projects_rels" WHERE "path" = 'clients' AND "firms_id" IS NOT NULL
      UNION SELECT "firms_id" FROM "_projects_v_rels" WHERE "path" = 'version.clients' AND "firms_id" IS NOT NULL
    );
  INSERT INTO "clients" ("name", "normalized_name") SELECT "name", "normalized_name" FROM "client_firms" ORDER BY "name";
  UPDATE "client_firms" m SET "client_id" = c."id" FROM "clients" c WHERE c."name" = m."name";
  UPDATE "projects_rels" r SET "clients_id" = m."client_id", "firms_id" = NULL
    FROM "client_firms" m WHERE r."path" = 'clients' AND r."firms_id" = m."firm_id";
  UPDATE "_projects_v_rels" r SET "clients_id" = m."client_id", "firms_id" = NULL
    FROM "client_firms" m WHERE r."path" = 'version.clients' AND r."firms_id" = m."firm_id";
  DELETE FROM "firms" f USING "client_firms" m
    WHERE f."id" = m."firm_id"
      AND NOT EXISTS (SELECT 1 FROM "projects_rels" r WHERE r."firms_id" = f."id")
      AND NOT EXISTS (SELECT 1 FROM "_projects_v_rels" r WHERE r."firms_id" = f."id")
      AND NOT EXISTS (SELECT 1 FROM "years_of_light_rels" r WHERE r."firms_id" = f."id")
      AND NOT EXISTS (SELECT 1 FROM "_years_of_light_v_rels" r WHERE r."firms_id" = f."id")
      AND NOT coalesce(f."list_as_collaborator", false)
      AND coalesce(f."website", '') = '';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  // Clients back to firms: matched by name, a firm created where none is left.
  await db.execute(sql`
  INSERT INTO "firms" ("name", "normalized_name", "slug")
    SELECT c."name", c."normalized_name",
      trim(both '-' from lower(regexp_replace(c."name", '[^a-zA-Z0-9]+', '-', 'g'))) || '-client-' || c."id"
    FROM "clients" c
    WHERE NOT EXISTS (SELECT 1 FROM "firms" f WHERE f."normalized_name" = c."normalized_name" OR f."name" = c."name");
  UPDATE "projects_rels" r SET "firms_id" = f."id", "clients_id" = NULL
    FROM "clients" c JOIN "firms" f ON f."name" = c."name" OR f."normalized_name" = c."normalized_name"
    WHERE r."clients_id" = c."id";
  UPDATE "_projects_v_rels" r SET "firms_id" = f."id", "clients_id" = NULL
    FROM "clients" c JOIN "firms" f ON f."name" = c."name" OR f."normalized_name" = c."normalized_name"
    WHERE r."clients_id" = c."id";`)
  await db.execute(sql`
   ALTER TABLE "projects_rels" DROP CONSTRAINT "projects_rels_clients_fk";
  ALTER TABLE "_projects_v_rels" DROP CONSTRAINT "_projects_v_rels_clients_fk";
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_clients_fk";
  DROP INDEX "projects_rels_clients_id_idx";
  DROP INDEX "_projects_v_rels_clients_id_idx";
  DROP INDEX "payload_locked_documents_rels_clients_id_idx";
  ALTER TABLE "projects_rels" DROP COLUMN "clients_id";
  ALTER TABLE "_projects_v_rels" DROP COLUMN "clients_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "clients_id";
  DROP TABLE "clients";`)
}
