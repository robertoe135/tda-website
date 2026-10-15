import type { CollectionConfig } from 'payload'

import { anyone } from '../access/anyone'
import { authenticated } from '../access/authenticated'
import { fillSlug, slug } from '../fields/slug'
import { websiteField } from '../fields/website'
import { normalizedNameField, preventNearDuplicates } from '../hooks/preventNearDuplicates'

// Architects and other collaborators. Firm names are canonical here and nowhere else.
export const Firms: CollectionConfig = {
  slug: 'firms',
  labels: { singular: 'Firm', plural: 'Firms' },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'website', 'slug'],
    group: 'Reference',
    description:
      'Architects and other collaborators. Each firm gets a page listing every project TDA did with them.',
  },
  defaultSort: 'name',
  access: {
    read: anyone,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  hooks: {
    beforeValidate: [fillSlug('name'), preventNearDuplicates('firms')],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        description: "The firm's own spelling of its name, e.g. Kohn Pedersen Fox.",
      },
    },
    websiteField,
    {
      name: 'projects',
      type: 'join',
      collection: 'projects',
      on: 'architects',
      admin: { description: 'Projects where this firm is an architect. Edit the project to change this.' },
    },
    normalizedNameField,
    slug('name'),
  ],
}
