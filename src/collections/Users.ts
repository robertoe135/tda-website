import type { CollectionBeforeChangeHook, CollectionBeforeDeleteHook, CollectionConfig } from 'payload'
import { APIError } from 'payload'

import { isAdmin, isAdminField, isAdminOrSelf } from '../access/isAdmin'

const countAdmins = async (req: Parameters<CollectionBeforeChangeHook>[0]['req']) =>
  (
    await req.payload.count({
      collection: 'users',
      where: { role: { equals: 'admin' } },
      req,
    })
  ).totalDocs

// The very first account (created on the admin's "create first user" screen) is an admin.
const firstUserIsAdmin: CollectionBeforeChangeHook = async ({ data, operation, req }) => {
  if (operation !== 'create') return data
  const { totalDocs } = await req.payload.count({ collection: 'users', req })
  if (totalDocs === 0) data.role = 'admin'
  return data
}

// Guards apply to people using the admin or API. Scripts run without a user and are trusted.
const keepOneAdmin: CollectionBeforeChangeHook = async ({ data, operation, originalDoc, req }) => {
  if (!req.user) return data
  if (operation === 'update' && originalDoc?.role === 'admin' && data.role && data.role !== 'admin') {
    if ((await countAdmins(req)) <= 1) {
      throw new APIError('This is the only admin. Make someone else an admin first.', 400, null, true)
    }
  }
  return data
}

const keepOneAdminOnDelete: CollectionBeforeDeleteHook = async ({ id, req }) => {
  if (!req.user) return
  const user = await req.payload.findByID({ collection: 'users', id, depth: 0, req })
  if (user.role === 'admin' && (await countAdmins(req)) <= 1) {
    throw new APIError('This is the only admin. Make someone else an admin first.', 400, null, true)
  }
}

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'name', 'role'],
    description: 'People who can log in to this admin. Only admins can add or remove them.',
  },
  auth: true,
  access: {
    read: isAdminOrSelf,
    create: isAdmin,
    update: isAdminOrSelf,
    delete: isAdmin,
  },
  hooks: {
    beforeChange: [firstUserIsAdmin, keepOneAdmin],
    beforeDelete: [keepOneAdminOnDelete],
  },
  fields: [
    { name: 'name', type: 'text' },
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'editor',
      saveToJWT: true,
      options: [
        { label: 'Editor (content)', value: 'editor' },
        { label: 'Admin (content, users and site settings)', value: 'admin' },
      ],
      access: {
        create: isAdminField,
        update: isAdminField,
      },
      admin: { position: 'sidebar' },
    },
  ],
}
