// Load .env files
import 'dotenv/config'

// The integration tests create and delete records (projects, people, leads). They must never
// reach a shared database: refuse to start unless DATABASE_URL points at this machine.
const host = (() => {
  try {
    return new URL(process.env.DATABASE_URL ?? '').hostname
  } catch {
    return ''
  }
})()
if (!['localhost', '127.0.0.1', '::1'].includes(host)) {
  throw new Error(`Integration tests only run against a local database; DATABASE_URL points at ${host || 'nothing'}.`)
}
