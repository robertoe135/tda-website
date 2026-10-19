import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_newsletters_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__newsletters_v_version_status" AS ENUM('draft', 'published');
  CREATE TABLE "newsletters_blocks_letter" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"body" varchar,
  	"signature_name" varchar,
  	"signature_title" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "newsletters_blocks_section" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "newsletters_blocks_project" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"project_id" integer,
  	"note" varchar,
  	"image_id" integer,
  	"show_credits" boolean DEFAULT true,
  	"block_name" varchar
  );
  
  CREATE TABLE "newsletters_blocks_project_grid" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"block_name" varchar
  );
  
  CREATE TABLE "newsletters_blocks_conversation" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"role" varchar,
  	"portrait_id" integer,
  	"question" varchar,
  	"answer" varchar,
  	"url" varchar,
  	"link_label" varchar DEFAULT 'Read the conversation',
  	"block_name" varchar
  );
  
  CREATE TABLE "newsletters_blocks_awards" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"block_name" varchar
  );
  
  CREATE TABLE "newsletters_blocks_press" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"block_name" varchar
  );
  
  CREATE TABLE "newsletters_blocks_events_events" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"date" varchar,
  	"title" varchar,
  	"place" varchar,
  	"url" varchar
  );
  
  CREATE TABLE "newsletters_blocks_events" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"block_name" varchar
  );
  
  CREATE TABLE "newsletters_blocks_text" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"body" varchar,
  	"url" varchar,
  	"link_label" varchar DEFAULT 'Read more',
  	"block_name" varchar
  );
  
  CREATE TABLE "newsletters_blocks_image" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer,
  	"caption" varchar,
  	"url" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "newsletters" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"subject" varchar,
  	"preheader" varchar,
  	"masthead" varchar,
  	"issue_number" numeric,
  	"theme" varchar,
  	"season" varchar,
  	"sent_at" timestamp(3) with time zone,
  	"sent_by" varchar,
  	"broadcast_id" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_newsletters_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "newsletters_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"projects_id" integer,
  	"awards_id" integer,
  	"press_id" integer
  );
  
  CREATE TABLE "_newsletters_v_blocks_letter" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"body" varchar,
  	"signature_name" varchar,
  	"signature_title" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_newsletters_v_blocks_section" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_newsletters_v_blocks_project" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"project_id" integer,
  	"note" varchar,
  	"image_id" integer,
  	"show_credits" boolean DEFAULT true,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_newsletters_v_blocks_project_grid" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_newsletters_v_blocks_conversation" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"role" varchar,
  	"portrait_id" integer,
  	"question" varchar,
  	"answer" varchar,
  	"url" varchar,
  	"link_label" varchar DEFAULT 'Read the conversation',
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_newsletters_v_blocks_awards" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_newsletters_v_blocks_press" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_newsletters_v_blocks_events_events" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"date" varchar,
  	"title" varchar,
  	"place" varchar,
  	"url" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_newsletters_v_blocks_events" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_newsletters_v_blocks_text" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"body" varchar,
  	"url" varchar,
  	"link_label" varchar DEFAULT 'Read more',
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_newsletters_v_blocks_image" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"image_id" integer,
  	"caption" varchar,
  	"url" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_newsletters_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_subject" varchar,
  	"version_preheader" varchar,
  	"version_masthead" varchar,
  	"version_issue_number" numeric,
  	"version_theme" varchar,
  	"version_season" varchar,
  	"version_sent_at" timestamp(3) with time zone,
  	"version_sent_by" varchar,
  	"version_broadcast_id" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__newsletters_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean,
  	"autosave" boolean
  );
  
  CREATE TABLE "_newsletters_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"projects_id" integer,
  	"awards_id" integer,
  	"press_id" integer
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "newsletters_id" integer;
  ALTER TABLE "newsletters_blocks_letter" ADD CONSTRAINT "newsletters_blocks_letter_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."newsletters"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "newsletters_blocks_section" ADD CONSTRAINT "newsletters_blocks_section_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."newsletters"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "newsletters_blocks_project" ADD CONSTRAINT "newsletters_blocks_project_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "newsletters_blocks_project" ADD CONSTRAINT "newsletters_blocks_project_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "newsletters_blocks_project" ADD CONSTRAINT "newsletters_blocks_project_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."newsletters"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "newsletters_blocks_project_grid" ADD CONSTRAINT "newsletters_blocks_project_grid_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."newsletters"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "newsletters_blocks_conversation" ADD CONSTRAINT "newsletters_blocks_conversation_portrait_id_media_id_fk" FOREIGN KEY ("portrait_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "newsletters_blocks_conversation" ADD CONSTRAINT "newsletters_blocks_conversation_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."newsletters"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "newsletters_blocks_awards" ADD CONSTRAINT "newsletters_blocks_awards_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."newsletters"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "newsletters_blocks_press" ADD CONSTRAINT "newsletters_blocks_press_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."newsletters"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "newsletters_blocks_events_events" ADD CONSTRAINT "newsletters_blocks_events_events_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."newsletters_blocks_events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "newsletters_blocks_events" ADD CONSTRAINT "newsletters_blocks_events_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."newsletters"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "newsletters_blocks_text" ADD CONSTRAINT "newsletters_blocks_text_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."newsletters"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "newsletters_blocks_image" ADD CONSTRAINT "newsletters_blocks_image_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "newsletters_blocks_image" ADD CONSTRAINT "newsletters_blocks_image_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."newsletters"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "newsletters_rels" ADD CONSTRAINT "newsletters_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."newsletters"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "newsletters_rels" ADD CONSTRAINT "newsletters_rels_projects_fk" FOREIGN KEY ("projects_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "newsletters_rels" ADD CONSTRAINT "newsletters_rels_awards_fk" FOREIGN KEY ("awards_id") REFERENCES "public"."awards"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "newsletters_rels" ADD CONSTRAINT "newsletters_rels_press_fk" FOREIGN KEY ("press_id") REFERENCES "public"."press"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_newsletters_v_blocks_letter" ADD CONSTRAINT "_newsletters_v_blocks_letter_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_newsletters_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_newsletters_v_blocks_section" ADD CONSTRAINT "_newsletters_v_blocks_section_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_newsletters_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_newsletters_v_blocks_project" ADD CONSTRAINT "_newsletters_v_blocks_project_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_newsletters_v_blocks_project" ADD CONSTRAINT "_newsletters_v_blocks_project_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_newsletters_v_blocks_project" ADD CONSTRAINT "_newsletters_v_blocks_project_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_newsletters_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_newsletters_v_blocks_project_grid" ADD CONSTRAINT "_newsletters_v_blocks_project_grid_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_newsletters_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_newsletters_v_blocks_conversation" ADD CONSTRAINT "_newsletters_v_blocks_conversation_portrait_id_media_id_fk" FOREIGN KEY ("portrait_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_newsletters_v_blocks_conversation" ADD CONSTRAINT "_newsletters_v_blocks_conversation_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_newsletters_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_newsletters_v_blocks_awards" ADD CONSTRAINT "_newsletters_v_blocks_awards_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_newsletters_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_newsletters_v_blocks_press" ADD CONSTRAINT "_newsletters_v_blocks_press_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_newsletters_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_newsletters_v_blocks_events_events" ADD CONSTRAINT "_newsletters_v_blocks_events_events_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_newsletters_v_blocks_events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_newsletters_v_blocks_events" ADD CONSTRAINT "_newsletters_v_blocks_events_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_newsletters_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_newsletters_v_blocks_text" ADD CONSTRAINT "_newsletters_v_blocks_text_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_newsletters_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_newsletters_v_blocks_image" ADD CONSTRAINT "_newsletters_v_blocks_image_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_newsletters_v_blocks_image" ADD CONSTRAINT "_newsletters_v_blocks_image_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_newsletters_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_newsletters_v" ADD CONSTRAINT "_newsletters_v_parent_id_newsletters_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."newsletters"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_newsletters_v_rels" ADD CONSTRAINT "_newsletters_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_newsletters_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_newsletters_v_rels" ADD CONSTRAINT "_newsletters_v_rels_projects_fk" FOREIGN KEY ("projects_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_newsletters_v_rels" ADD CONSTRAINT "_newsletters_v_rels_awards_fk" FOREIGN KEY ("awards_id") REFERENCES "public"."awards"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_newsletters_v_rels" ADD CONSTRAINT "_newsletters_v_rels_press_fk" FOREIGN KEY ("press_id") REFERENCES "public"."press"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "newsletters_blocks_letter_order_idx" ON "newsletters_blocks_letter" USING btree ("_order");
  CREATE INDEX "newsletters_blocks_letter_parent_id_idx" ON "newsletters_blocks_letter" USING btree ("_parent_id");
  CREATE INDEX "newsletters_blocks_letter_path_idx" ON "newsletters_blocks_letter" USING btree ("_path");
  CREATE INDEX "newsletters_blocks_section_order_idx" ON "newsletters_blocks_section" USING btree ("_order");
  CREATE INDEX "newsletters_blocks_section_parent_id_idx" ON "newsletters_blocks_section" USING btree ("_parent_id");
  CREATE INDEX "newsletters_blocks_section_path_idx" ON "newsletters_blocks_section" USING btree ("_path");
  CREATE INDEX "newsletters_blocks_project_order_idx" ON "newsletters_blocks_project" USING btree ("_order");
  CREATE INDEX "newsletters_blocks_project_parent_id_idx" ON "newsletters_blocks_project" USING btree ("_parent_id");
  CREATE INDEX "newsletters_blocks_project_path_idx" ON "newsletters_blocks_project" USING btree ("_path");
  CREATE INDEX "newsletters_blocks_project_project_idx" ON "newsletters_blocks_project" USING btree ("project_id");
  CREATE INDEX "newsletters_blocks_project_image_idx" ON "newsletters_blocks_project" USING btree ("image_id");
  CREATE INDEX "newsletters_blocks_project_grid_order_idx" ON "newsletters_blocks_project_grid" USING btree ("_order");
  CREATE INDEX "newsletters_blocks_project_grid_parent_id_idx" ON "newsletters_blocks_project_grid" USING btree ("_parent_id");
  CREATE INDEX "newsletters_blocks_project_grid_path_idx" ON "newsletters_blocks_project_grid" USING btree ("_path");
  CREATE INDEX "newsletters_blocks_conversation_order_idx" ON "newsletters_blocks_conversation" USING btree ("_order");
  CREATE INDEX "newsletters_blocks_conversation_parent_id_idx" ON "newsletters_blocks_conversation" USING btree ("_parent_id");
  CREATE INDEX "newsletters_blocks_conversation_path_idx" ON "newsletters_blocks_conversation" USING btree ("_path");
  CREATE INDEX "newsletters_blocks_conversation_portrait_idx" ON "newsletters_blocks_conversation" USING btree ("portrait_id");
  CREATE INDEX "newsletters_blocks_awards_order_idx" ON "newsletters_blocks_awards" USING btree ("_order");
  CREATE INDEX "newsletters_blocks_awards_parent_id_idx" ON "newsletters_blocks_awards" USING btree ("_parent_id");
  CREATE INDEX "newsletters_blocks_awards_path_idx" ON "newsletters_blocks_awards" USING btree ("_path");
  CREATE INDEX "newsletters_blocks_press_order_idx" ON "newsletters_blocks_press" USING btree ("_order");
  CREATE INDEX "newsletters_blocks_press_parent_id_idx" ON "newsletters_blocks_press" USING btree ("_parent_id");
  CREATE INDEX "newsletters_blocks_press_path_idx" ON "newsletters_blocks_press" USING btree ("_path");
  CREATE INDEX "newsletters_blocks_events_events_order_idx" ON "newsletters_blocks_events_events" USING btree ("_order");
  CREATE INDEX "newsletters_blocks_events_events_parent_id_idx" ON "newsletters_blocks_events_events" USING btree ("_parent_id");
  CREATE INDEX "newsletters_blocks_events_order_idx" ON "newsletters_blocks_events" USING btree ("_order");
  CREATE INDEX "newsletters_blocks_events_parent_id_idx" ON "newsletters_blocks_events" USING btree ("_parent_id");
  CREATE INDEX "newsletters_blocks_events_path_idx" ON "newsletters_blocks_events" USING btree ("_path");
  CREATE INDEX "newsletters_blocks_text_order_idx" ON "newsletters_blocks_text" USING btree ("_order");
  CREATE INDEX "newsletters_blocks_text_parent_id_idx" ON "newsletters_blocks_text" USING btree ("_parent_id");
  CREATE INDEX "newsletters_blocks_text_path_idx" ON "newsletters_blocks_text" USING btree ("_path");
  CREATE INDEX "newsletters_blocks_image_order_idx" ON "newsletters_blocks_image" USING btree ("_order");
  CREATE INDEX "newsletters_blocks_image_parent_id_idx" ON "newsletters_blocks_image" USING btree ("_parent_id");
  CREATE INDEX "newsletters_blocks_image_path_idx" ON "newsletters_blocks_image" USING btree ("_path");
  CREATE INDEX "newsletters_blocks_image_image_idx" ON "newsletters_blocks_image" USING btree ("image_id");
  CREATE INDEX "newsletters_updated_at_idx" ON "newsletters" USING btree ("updated_at");
  CREATE INDEX "newsletters_created_at_idx" ON "newsletters" USING btree ("created_at");
  CREATE INDEX "newsletters__status_idx" ON "newsletters" USING btree ("_status");
  CREATE INDEX "newsletters_rels_order_idx" ON "newsletters_rels" USING btree ("order");
  CREATE INDEX "newsletters_rels_parent_idx" ON "newsletters_rels" USING btree ("parent_id");
  CREATE INDEX "newsletters_rels_path_idx" ON "newsletters_rels" USING btree ("path");
  CREATE INDEX "newsletters_rels_projects_id_idx" ON "newsletters_rels" USING btree ("projects_id");
  CREATE INDEX "newsletters_rels_awards_id_idx" ON "newsletters_rels" USING btree ("awards_id");
  CREATE INDEX "newsletters_rels_press_id_idx" ON "newsletters_rels" USING btree ("press_id");
  CREATE INDEX "_newsletters_v_blocks_letter_order_idx" ON "_newsletters_v_blocks_letter" USING btree ("_order");
  CREATE INDEX "_newsletters_v_blocks_letter_parent_id_idx" ON "_newsletters_v_blocks_letter" USING btree ("_parent_id");
  CREATE INDEX "_newsletters_v_blocks_letter_path_idx" ON "_newsletters_v_blocks_letter" USING btree ("_path");
  CREATE INDEX "_newsletters_v_blocks_section_order_idx" ON "_newsletters_v_blocks_section" USING btree ("_order");
  CREATE INDEX "_newsletters_v_blocks_section_parent_id_idx" ON "_newsletters_v_blocks_section" USING btree ("_parent_id");
  CREATE INDEX "_newsletters_v_blocks_section_path_idx" ON "_newsletters_v_blocks_section" USING btree ("_path");
  CREATE INDEX "_newsletters_v_blocks_project_order_idx" ON "_newsletters_v_blocks_project" USING btree ("_order");
  CREATE INDEX "_newsletters_v_blocks_project_parent_id_idx" ON "_newsletters_v_blocks_project" USING btree ("_parent_id");
  CREATE INDEX "_newsletters_v_blocks_project_path_idx" ON "_newsletters_v_blocks_project" USING btree ("_path");
  CREATE INDEX "_newsletters_v_blocks_project_project_idx" ON "_newsletters_v_blocks_project" USING btree ("project_id");
  CREATE INDEX "_newsletters_v_blocks_project_image_idx" ON "_newsletters_v_blocks_project" USING btree ("image_id");
  CREATE INDEX "_newsletters_v_blocks_project_grid_order_idx" ON "_newsletters_v_blocks_project_grid" USING btree ("_order");
  CREATE INDEX "_newsletters_v_blocks_project_grid_parent_id_idx" ON "_newsletters_v_blocks_project_grid" USING btree ("_parent_id");
  CREATE INDEX "_newsletters_v_blocks_project_grid_path_idx" ON "_newsletters_v_blocks_project_grid" USING btree ("_path");
  CREATE INDEX "_newsletters_v_blocks_conversation_order_idx" ON "_newsletters_v_blocks_conversation" USING btree ("_order");
  CREATE INDEX "_newsletters_v_blocks_conversation_parent_id_idx" ON "_newsletters_v_blocks_conversation" USING btree ("_parent_id");
  CREATE INDEX "_newsletters_v_blocks_conversation_path_idx" ON "_newsletters_v_blocks_conversation" USING btree ("_path");
  CREATE INDEX "_newsletters_v_blocks_conversation_portrait_idx" ON "_newsletters_v_blocks_conversation" USING btree ("portrait_id");
  CREATE INDEX "_newsletters_v_blocks_awards_order_idx" ON "_newsletters_v_blocks_awards" USING btree ("_order");
  CREATE INDEX "_newsletters_v_blocks_awards_parent_id_idx" ON "_newsletters_v_blocks_awards" USING btree ("_parent_id");
  CREATE INDEX "_newsletters_v_blocks_awards_path_idx" ON "_newsletters_v_blocks_awards" USING btree ("_path");
  CREATE INDEX "_newsletters_v_blocks_press_order_idx" ON "_newsletters_v_blocks_press" USING btree ("_order");
  CREATE INDEX "_newsletters_v_blocks_press_parent_id_idx" ON "_newsletters_v_blocks_press" USING btree ("_parent_id");
  CREATE INDEX "_newsletters_v_blocks_press_path_idx" ON "_newsletters_v_blocks_press" USING btree ("_path");
  CREATE INDEX "_newsletters_v_blocks_events_events_order_idx" ON "_newsletters_v_blocks_events_events" USING btree ("_order");
  CREATE INDEX "_newsletters_v_blocks_events_events_parent_id_idx" ON "_newsletters_v_blocks_events_events" USING btree ("_parent_id");
  CREATE INDEX "_newsletters_v_blocks_events_order_idx" ON "_newsletters_v_blocks_events" USING btree ("_order");
  CREATE INDEX "_newsletters_v_blocks_events_parent_id_idx" ON "_newsletters_v_blocks_events" USING btree ("_parent_id");
  CREATE INDEX "_newsletters_v_blocks_events_path_idx" ON "_newsletters_v_blocks_events" USING btree ("_path");
  CREATE INDEX "_newsletters_v_blocks_text_order_idx" ON "_newsletters_v_blocks_text" USING btree ("_order");
  CREATE INDEX "_newsletters_v_blocks_text_parent_id_idx" ON "_newsletters_v_blocks_text" USING btree ("_parent_id");
  CREATE INDEX "_newsletters_v_blocks_text_path_idx" ON "_newsletters_v_blocks_text" USING btree ("_path");
  CREATE INDEX "_newsletters_v_blocks_image_order_idx" ON "_newsletters_v_blocks_image" USING btree ("_order");
  CREATE INDEX "_newsletters_v_blocks_image_parent_id_idx" ON "_newsletters_v_blocks_image" USING btree ("_parent_id");
  CREATE INDEX "_newsletters_v_blocks_image_path_idx" ON "_newsletters_v_blocks_image" USING btree ("_path");
  CREATE INDEX "_newsletters_v_blocks_image_image_idx" ON "_newsletters_v_blocks_image" USING btree ("image_id");
  CREATE INDEX "_newsletters_v_parent_idx" ON "_newsletters_v" USING btree ("parent_id");
  CREATE INDEX "_newsletters_v_version_version_updated_at_idx" ON "_newsletters_v" USING btree ("version_updated_at");
  CREATE INDEX "_newsletters_v_version_version_created_at_idx" ON "_newsletters_v" USING btree ("version_created_at");
  CREATE INDEX "_newsletters_v_version_version__status_idx" ON "_newsletters_v" USING btree ("version__status");
  CREATE INDEX "_newsletters_v_created_at_idx" ON "_newsletters_v" USING btree ("created_at");
  CREATE INDEX "_newsletters_v_updated_at_idx" ON "_newsletters_v" USING btree ("updated_at");
  CREATE INDEX "_newsletters_v_latest_idx" ON "_newsletters_v" USING btree ("latest");
  CREATE INDEX "_newsletters_v_autosave_idx" ON "_newsletters_v" USING btree ("autosave");
  CREATE INDEX "_newsletters_v_rels_order_idx" ON "_newsletters_v_rels" USING btree ("order");
  CREATE INDEX "_newsletters_v_rels_parent_idx" ON "_newsletters_v_rels" USING btree ("parent_id");
  CREATE INDEX "_newsletters_v_rels_path_idx" ON "_newsletters_v_rels" USING btree ("path");
  CREATE INDEX "_newsletters_v_rels_projects_id_idx" ON "_newsletters_v_rels" USING btree ("projects_id");
  CREATE INDEX "_newsletters_v_rels_awards_id_idx" ON "_newsletters_v_rels" USING btree ("awards_id");
  CREATE INDEX "_newsletters_v_rels_press_id_idx" ON "_newsletters_v_rels" USING btree ("press_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_newsletters_fk" FOREIGN KEY ("newsletters_id") REFERENCES "public"."newsletters"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_newsletters_id_idx" ON "payload_locked_documents_rels" USING btree ("newsletters_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "newsletters_blocks_letter" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "newsletters_blocks_section" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "newsletters_blocks_project" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "newsletters_blocks_project_grid" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "newsletters_blocks_conversation" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "newsletters_blocks_awards" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "newsletters_blocks_press" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "newsletters_blocks_events_events" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "newsletters_blocks_events" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "newsletters_blocks_text" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "newsletters_blocks_image" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "newsletters" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "newsletters_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_newsletters_v_blocks_letter" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_newsletters_v_blocks_section" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_newsletters_v_blocks_project" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_newsletters_v_blocks_project_grid" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_newsletters_v_blocks_conversation" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_newsletters_v_blocks_awards" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_newsletters_v_blocks_press" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_newsletters_v_blocks_events_events" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_newsletters_v_blocks_events" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_newsletters_v_blocks_text" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_newsletters_v_blocks_image" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_newsletters_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_newsletters_v_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "newsletters_blocks_letter" CASCADE;
  DROP TABLE "newsletters_blocks_section" CASCADE;
  DROP TABLE "newsletters_blocks_project" CASCADE;
  DROP TABLE "newsletters_blocks_project_grid" CASCADE;
  DROP TABLE "newsletters_blocks_conversation" CASCADE;
  DROP TABLE "newsletters_blocks_awards" CASCADE;
  DROP TABLE "newsletters_blocks_press" CASCADE;
  DROP TABLE "newsletters_blocks_events_events" CASCADE;
  DROP TABLE "newsletters_blocks_events" CASCADE;
  DROP TABLE "newsletters_blocks_text" CASCADE;
  DROP TABLE "newsletters_blocks_image" CASCADE;
  DROP TABLE "newsletters" CASCADE;
  DROP TABLE "newsletters_rels" CASCADE;
  DROP TABLE "_newsletters_v_blocks_letter" CASCADE;
  DROP TABLE "_newsletters_v_blocks_section" CASCADE;
  DROP TABLE "_newsletters_v_blocks_project" CASCADE;
  DROP TABLE "_newsletters_v_blocks_project_grid" CASCADE;
  DROP TABLE "_newsletters_v_blocks_conversation" CASCADE;
  DROP TABLE "_newsletters_v_blocks_awards" CASCADE;
  DROP TABLE "_newsletters_v_blocks_press" CASCADE;
  DROP TABLE "_newsletters_v_blocks_events_events" CASCADE;
  DROP TABLE "_newsletters_v_blocks_events" CASCADE;
  DROP TABLE "_newsletters_v_blocks_text" CASCADE;
  DROP TABLE "_newsletters_v_blocks_image" CASCADE;
  DROP TABLE "_newsletters_v" CASCADE;
  DROP TABLE "_newsletters_v_rels" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_newsletters_fk";
  
  DROP INDEX "payload_locked_documents_rels_newsletters_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "newsletters_id";
  DROP TYPE "public"."enum_newsletters_status";
  DROP TYPE "public"."enum__newsletters_v_version_status";`)
}
