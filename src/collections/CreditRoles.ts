import type { CollectionConfig } from 'payload'

import { anyone } from '../access/anyone'
import { authenticated } from '../access/authenticated'
import { normalizedNameField, preventNearDuplicates } from '../hooks/preventNearDuplicates'

// Roles in a project's credits list, e.g. Structural Engineer. A list rather than a fixed
// dropdown so marketing can add a role without a developer.
export const CreditRoles: CollectionConfig = {
  slug: 'creditRoles',
  labels: { singular: 'Credit role', plural: 'Credit roles' },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'order'],
    group: 'Reference',
    description: 'Roles used in project credits, e.g. Structural Engineer or Façade Consultant.',
  },
  defaultSort: ['order', 'name'],
  access: {
    read: anyone,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  hooks: {
    beforeValidate: [preventNearDuplicates('creditRoles')],
  },
  fields: [
    { name: 'name', type: 'text', required: true, unique: true },
    {
      name: 'order',
      type: 'number',
      admin: {
        position: 'sidebar',
        description: 'Position in a project’s credits. Lower numbers come first.',
      },
    },
    normalizedNameField,
  ],
}
