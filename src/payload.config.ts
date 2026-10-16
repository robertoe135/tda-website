import { postgresAdapter } from '@payloadcms/db-postgres'
import { vercelBlobStorage } from '@payloadcms/storage-vercel-blob'
import { nodemailerAdapter } from '@payloadcms/email-nodemailer'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { Videos } from './collections/Videos'
import { Leads } from './collections/Leads'
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
  collections: [Projects, People, Media, Videos, Awards, Press, Typologies, Locations, Firms, Photographers, CreditRoles, Leads, Users],
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
  // Outgoing email (career applications, admin password resets) through any SMTP service:
  // Microsoft 365, Google Workspace or a sending service such as Resend. Without SMTP_HOST,
  // emails are printed to the server log instead (local development).
  email: process.env.SMTP_HOST
    ? nodemailerAdapter({
        defaultFromAddress: process.env.EMAIL_FROM || 'website@tillotsondesign.com',
        defaultFromName: 'Tillotson Design Associates website',
        transportOptions: {
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT || 587),
          secure: Number(process.env.SMTP_PORT) === 465,
          auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        },
      })
    : undefined,
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
    // Videos are uploaded from the browser straight to Blob, past Vercel's 4.5 MB request
    // limit. Images must not be: they go through the server, which renames them and strips
    // camera data (src/hooks/sanitizeUpload.ts). Hence a second, video-only instance.
    vercelBlobStorage({
      token: process.env.BLOB_READ_WRITE_TOKEN,
      enabled: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
      alwaysInsertFields: true,
      clientUploads: true,
      addRandomSuffix: true,
      collections: { videos: { prefix: 'videos' } },
    }),
  ],
})
