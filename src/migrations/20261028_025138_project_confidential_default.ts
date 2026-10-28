import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * A project's owner is now shown to the public only when the project is known not to be
 * confidential (Projects.ts, clients' field access). A project saved without a value would hide
 * its owner, so every empty value becomes "not confidential", what it already meant.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   UPDATE "projects" SET "confidential" = false WHERE "confidential" IS NULL;
  UPDATE "_projects_v" SET "version_confidential" = false WHERE "version_confidential" IS NULL;`)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // Nothing to undo: false is what an empty value meant.
}
