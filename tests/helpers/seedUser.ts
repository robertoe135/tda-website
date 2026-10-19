import { getPayload } from 'payload'
import config from '../../src/payload.config.js'

export const testUser = {
  email: 'dev@payloadcms.com',
  password: 'test',
  role: 'admin' as const,
}

/**
 * Seeds a test user for e2e admin tests. Spec files that run in parallel each pass their own
 * user, so one file's cleanup can't log another out.
 */
export async function seedTestUser(user: typeof testUser = testUser): Promise<void> {
  const payload = await getPayload({ config })

  // Delete existing test user if any
  await payload.delete({
    collection: 'users',
    where: {
      email: {
        equals: user.email,
      },
    },
  })

  // Create fresh test user
  await payload.create({
    collection: 'users',
    data: user,
  })
}

/**
 * Cleans up test user after tests
 */
export async function cleanupTestUser(user: typeof testUser = testUser): Promise<void> {
  const payload = await getPayload({ config })

  await payload.delete({
    collection: 'users',
    where: {
      email: {
        equals: user.email,
      },
    },
  })
}
