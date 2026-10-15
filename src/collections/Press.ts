import type { CollectionConfig } from 'payload'

import { anyone } from '../access/anyone'
import { authenticated } from '../access/authenticated'
import { urlField } from '../fields/website'

export const Press: CollectionConfig = {
  slug: 'press',
  labels: { singular: 'Press item', plural: 'Press' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'outlet', 'date'],
    description: 'Articles about TDA or its projects. They appear on the press page and on each project.',
  },
  defaultSort: '-date',
  access: {
    read: anyone,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      admin: { description: 'The headline as published.' },
    },
    {
      type: 'row',
      fields: [
        { name: 'outlet', type: 'text', admin: { description: 'e.g. Architectural Record' } },
        {
          name: 'date',
          type: 'date',
          admin: { date: { pickerAppearance: 'dayOnly' } },
        },
      ],
    },
    { ...urlField('url', 'Link'), required: true },
    {
      name: 'projects',
      type: 'relationship',
      relationTo: 'projects',
      hasMany: true,
      admin: { description: 'Projects the article covers, if any.' },
    },
  ],
}
