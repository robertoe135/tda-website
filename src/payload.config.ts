import { postgresAdapter } from '@payloadcms/db-postgres'
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
import { People } from './collections/People'
import { Projects } from './collections/Projects'
import { Awards } from './collections/Awards'
import { Press } from './collections/Press'
import { About } from './globals/About'
import { SiteSettings } from './globals/SiteSettings'
import { migrations } from './migrations'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [Projects, People, Media, Awards, Press, Typologies, Locations, Firms, Photographers, Users],
  globals: [SiteSettings, About],
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
    migrationDir: path.resolve(dirname, 'migrations'),
    // Run pending migrations when the production server starts.
    prodMigrations: migrations,
  }),
  sharp,
  plugins: [],
})
