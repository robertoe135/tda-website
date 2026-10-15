import type { CollectionConfig } from 'payload'

import { anyone } from '../access/anyone'
import { authenticated } from '../access/authenticated'
import { websiteField } from '../fields/website'
import { normalizedNameField, preventNearDuplicates } from '../hooks/preventNearDuplicates'

// Credited on every image they took; credit is part of the photography license.
export const Photographers: CollectionConfig = {
  slug: 'photographers',
  labels: { singular: 'Photographer', plural: 'Photographers' },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'website'],
    group: 'Reference',
    description: 'Credited on every image they took. The credit links to their website.',
  },
  defaultSort: 'name',
  access: {
    read: anyone,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  hooks: {
    beforeValidate: [preventNearDuplicates('photographers')],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      unique: true,
      admin: { description: 'As the photographer wants to be credited.' },
    },
    websiteField,
    normalizedNameField,
  ],
}
