import { getPayload, Payload } from 'payload'
import config from '@/payload.config'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { User } from '@/payload-types'

let payload: Payload
const stamp = Date.now()
const email = (name: string) => `zz-test-${stamp}-${name}@example.com`
let admin: User
let editor: User

beforeAll(async () => {
  payload = await getPayload({ config: await config })
  admin = await payload.create({
    collection: 'users',
    data: { email: email('admin'), password: 'pw-123456', role: 'admin' },
  })
  editor = await payload.create({
    collection: 'users',
    data: { email: email('editor'), password: 'pw-123456', role: 'editor' },
  })
})

afterAll(async () => {
  await payload.delete({ collection: 'users', where: { email: { like: `zz-test-${stamp}` } } })
})

const as = (user: User) => ({ overrideAccess: false, user }) as const

describe('users and roles', () => {
  it('lets an editor see only their own account', async () => {
    const result = await payload.find({ collection: 'users', ...as(editor) })
    expect(result.docs.map((u) => u.id)).toEqual([editor.id])
  })

  it('does not let an editor create users', async () => {
    await expect(
      payload.create({
        collection: 'users',
        data: { email: email('sneaky'), password: 'pw-123456', role: 'editor' },
        ...as(editor),
      }),
    ).rejects.toThrow()
  })

  it('does not let an editor promote themselves', async () => {
    await payload.update({ collection: 'users', id: editor.id, data: { role: 'admin' }, ...as(editor) })
    const after = await payload.findByID({ collection: 'users', id: editor.id })
    expect(after.role).toBe('editor')
  })

  it('lets an admin promote an editor', async () => {
    const other = await payload.create({
      collection: 'users',
      data: { email: email('other'), password: 'pw-123456', role: 'editor' },
    })
    const updated = await payload.update({
      collection: 'users',
      id: other.id,
      data: { role: 'admin' },
      ...as(admin),
    })
    expect(updated.role).toBe('admin')
  })

  it('refuses to demote the last admin', async () => {
    const admins = await payload.find({ collection: 'users', where: { role: { equals: 'admin' } }, limit: 0 })
    // Demote every other admin with scripts (no user), then try through the admin as a user.
    const others = admins.docs.filter((u) => u.id !== admin.id)
    for (const u of others) await payload.update({ collection: 'users', id: u.id, data: { role: 'editor' } })
    try {
      await expect(
        payload.update({ collection: 'users', id: admin.id, data: { role: 'editor' }, ...as(admin) }),
      ).rejects.toThrow(/only admin/)
    } finally {
      for (const u of others) await payload.update({ collection: 'users', id: u.id, data: { role: 'admin' } })
    }
  })
})
