import { postgresAdapter } from '@payloadcms/db-postgres'
import { vercelBlobStorage } from '@payloadcms/storage-vercel-blob'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { Typologies } from './collections/Typologies'
import { Locations } from './collections/Locations'
import { Firms } from './collections/Firms'
import { Photographers } from './collections/Photographers'
import { CreditRoles } from './collections/CreditRoles'
import { People } from './collections/People'
import { Projects } from './collections/Projects'
import { Awards } from './collections/Awards'
import { Press } from './collections/Press'
import { About } from './globals/About'
import { Home } from './globals/Home'
import { SiteSettings } from './globals/SiteSettings'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [Projects, People, Media, Awards, Press, Typologies, Locations, Firms, Photographers, CreditRoles, Users],
  globals: [Home, About, SiteSettings],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL || '',
    },
    // Schema changes always go through committed migrations, in dev too, so local and
    // production never drift. After editing a collection: `pnpm payload migrate:create <name>`
    // then `pnpm payload migrate`.
    push: false,
    // Production runs `payload migrate` once per deploy, in the build (vercel.json), rather
    // than on every server start, where several instances could race.
    migrationDir: path.resolve(dirname, 'migrations'),
  }),
  sharp,
  plugins: [
    // Images go to Vercel Blob when BLOB_READ_WRITE_TOKEN is set (production); without it, to
    // ./media on disk (local development). alwaysInsertFields keeps the database schema the
    // same in both, so migrations generated locally match production.
    vercelBlobStorage({
      token: process.env.BLOB_READ_WRITE_TOKEN,
      enabled: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
      alwaysInsertFields: true,
      collections: { media: true },
    }),
  ],
})
