import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// The homepage moves from a flat list of items to rows (Home.ts). Rows of the old list stay in
// home_blocks_* with _path "items" and are simply no longer read, so migrating down restores
// them. Rebuild the rows with `pnpm migrate:pages --update`.
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_home_rows_layout" AS ENUM('one', 'two', 'wide-narrow', 'narrow-wide', 'three');
  CREATE TYPE "public"."enum__home_v_version_rows_layout" AS ENUM('one', 'two', 'wide-narrow', 'narrow-wide', 'three');
  CREATE TABLE "videos" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"alt" varchar NOT NULL,
  	"poster_id" integer NOT NULL,
  	"credit" varchar,
  	"prefix" varchar DEFAULT 'videos',
  	"_objectkey" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric
  );
  
  CREATE TABLE "home_rows" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"layout" "enum_home_rows_layout" DEFAULT 'three'
  );
  
  CREATE TABLE "_home_v_version_rows" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"layout" "enum__home_v_version_rows_layout" DEFAULT 'three',
  	"_uuid" varchar
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "videos_id" integer;
  ALTER TABLE "home_blocks_project" ADD COLUMN "image_id" integer;
  ALTER TABLE "home_blocks_project" ADD COLUMN "video_id" integer;
  ALTER TABLE "_home_v_blocks_project" ADD COLUMN "image_id" integer;
  ALTER TABLE "_home_v_blocks_project" ADD COLUMN "video_id" integer;
  ALTER TABLE "videos" ADD CONSTRAINT "videos_poster_id_media_id_fk" FOREIGN KEY ("poster_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "home_rows" ADD CONSTRAINT "home_rows_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."home"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_home_v_version_rows" ADD CONSTRAINT "_home_v_version_rows_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_home_v"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "videos_poster_idx" ON "videos" USING btree ("poster_id");
  CREATE INDEX "videos_updated_at_idx" ON "videos" USING btree ("updated_at");
  CREATE INDEX "videos_created_at_idx" ON "videos" USING btree ("created_at");
  CREATE UNIQUE INDEX "videos_filename_idx" ON "videos" USING btree ("filename");
  CREATE INDEX "home_rows_order_idx" ON "home_rows" USING btree ("_order");
  CREATE INDEX "home_rows_parent_id_idx" ON "home_rows" USING btree ("_parent_id");
  CREATE INDEX "_home_v_version_rows_order_idx" ON "_home_v_version_rows" USING btree ("_order");
  CREATE INDEX "_home_v_version_rows_parent_id_idx" ON "_home_v_version_rows" USING btree ("_parent_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_videos_fk" FOREIGN KEY ("videos_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "home_blocks_project" ADD CONSTRAINT "home_blocks_project_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "home_blocks_project" ADD CONSTRAINT "home_blocks_project_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_home_v_blocks_project" ADD CONSTRAINT "_home_v_blocks_project_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_home_v_blocks_project" ADD CONSTRAINT "_home_v_blocks_project_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_videos_id_idx" ON "payload_locked_documents_rels" USING btree ("videos_id");
  CREATE INDEX "home_blocks_project_image_idx" ON "home_blocks_project" USING btree ("image_id");
  CREATE INDEX "home_blocks_project_video_idx" ON "home_blocks_project" USING btree ("video_id");
  CREATE INDEX "_home_v_blocks_project_image_idx" ON "_home_v_blocks_project" USING btree ("image_id");
  CREATE INDEX "_home_v_blocks_project_video_idx" ON "_home_v_blocks_project" USING btree ("video_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "videos" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "home_rows" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_home_v_version_rows" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "videos" CASCADE;
  DROP TABLE "home_rows" CASCADE;
  DROP TABLE "_home_v_version_rows" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_videos_fk";
  
  ALTER TABLE "home_blocks_project" DROP CONSTRAINT IF EXISTS "home_blocks_project_image_id_media_id_fk";
  
  ALTER TABLE "home_blocks_project" DROP CONSTRAINT IF EXISTS "home_blocks_project_video_id_videos_id_fk";
  
  ALTER TABLE "_home_v_blocks_project" DROP CONSTRAINT IF EXISTS "_home_v_blocks_project_image_id_media_id_fk";
  
  ALTER TABLE "_home_v_blocks_project" DROP CONSTRAINT IF EXISTS "_home_v_blocks_project_video_id_videos_id_fk";
  
  DROP INDEX IF EXISTS "payload_locked_documents_rels_videos_id_idx";
  DROP INDEX IF EXISTS "home_blocks_project_image_idx";
  DROP INDEX IF EXISTS "home_blocks_project_video_idx";
  DROP INDEX IF EXISTS "_home_v_blocks_project_image_idx";
  DROP INDEX IF EXISTS "_home_v_blocks_project_video_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "videos_id";
  ALTER TABLE "home_blocks_project" DROP COLUMN "image_id";
  ALTER TABLE "home_blocks_project" DROP COLUMN "video_id";
  ALTER TABLE "_home_v_blocks_project" DROP COLUMN "image_id";
  ALTER TABLE "_home_v_blocks_project" DROP COLUMN "video_id";
  DROP TYPE "public"."enum_home_rows_layout";
  DROP TYPE "public"."enum__home_v_version_rows_layout";`)
}
