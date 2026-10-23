import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "projects" ADD COLUMN "announce_approved" boolean DEFAULT false;
  ALTER TABLE "projects" ADD COLUMN "announce_approved_by" varchar;
  ALTER TABLE "projects" ADD COLUMN "announce_approved_on" timestamp(3) with time zone;
  ALTER TABLE "_projects_v" ADD COLUMN "version_announce_approved" boolean DEFAULT false;
  ALTER TABLE "_projects_v" ADD COLUMN "version_announce_approved_by" varchar;
  ALTER TABLE "_projects_v" ADD COLUMN "version_announce_approved_on" timestamp(3) with time zone;`)

  // Work in progress already live was announced on the old site: it stays live, marked so
  // marketing can tell these from approvals recorded from now on. Its drafts carry the same
  // marks, so the next publish keeps it approved. Drafts never published stay unapproved.
  await db.execute(sql`
   UPDATE "projects" SET "announce_approved" = true,
     "announce_approved_by" = 'Already on the site when approvals began (October 2026)',
     "announce_approved_on" = now()
   WHERE "status" = 'in-progress' AND "_status" = 'published';
  UPDATE "_projects_v" v SET "version_announce_approved" = true,
     "version_announce_approved_by" = p."announce_approved_by",
     "version_announce_approved_on" = p."announce_approved_on"
   FROM "projects" p
   WHERE v."parent_id" = p."id" AND p."announce_approved" = true AND v."version_status" = 'in-progress';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "projects" DROP COLUMN "announce_approved";
  ALTER TABLE "projects" DROP COLUMN "announce_approved_by";
  ALTER TABLE "projects" DROP COLUMN "announce_approved_on";
  ALTER TABLE "_projects_v" DROP COLUMN "version_announce_approved";
  ALTER TABLE "_projects_v" DROP COLUMN "version_announce_approved_by";
  ALTER TABLE "_projects_v" DROP COLUMN "version_announce_approved_on";`)
}
