import type { CollectionConfig } from 'payload'

import { anyone } from '../access/anyone'
import { authenticated } from '../access/authenticated'

export const Awards: CollectionConfig = {
  slug: 'awards',
  labels: { singular: 'Award', plural: 'Awards' },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'issuer', 'year', 'project'],
    description: 'Awards won by a project. They appear on the project page.',
  },
  defaultSort: '-year',
  access: {
    read: anyone,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      admin: { description: 'As the issuer names it, e.g. Award of Excellence.' },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'issuer',
          type: 'text',
          admin: { description: 'e.g. IALD International Lighting Design Awards' },
        },
        { name: 'year', type: 'number', min: 1900, max: 2100 },
      ],
    },
    { name: 'project', type: 'relationship', relationTo: 'projects', required: true },
  ],
}
