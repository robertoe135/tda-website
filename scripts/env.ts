/**
 * Environment for the command-line scripts, read the way Next reads it: .env.local first
 * (where `vercel env pull` writes), then .env. A value in .env.local wins.
 */
import path from 'path'
import { fileURLToPath } from 'url'

import dotenv from 'dotenv'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
dotenv.config({ path: [path.join(root, '.env.local'), path.join(root, '.env')], quiet: true } as dotenv.DotenvConfigOptions)
