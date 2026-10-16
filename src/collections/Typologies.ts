import type { CollectionConfig } from 'payload'

import { anyone } from '../access/anyone'
import { authenticated } from '../access/authenticated'
import { fillSlug, slug } from '../fields/slug'
import { normalizedNameField, preventNearDuplicates } from '../hooks/preventNearDuplicates'

// The list itself is TDA marketing's to decide (docs/decisions.md, open question 4).
// Do not seed it.
export const Typologies: CollectionConfig = {
  slug: 'typologies',
  labels: { singular: 'Typology', plural: 'Typologies' },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'order', 'slug'],
    group: 'Reference',
    description: 'Project types used to group and filter projects, e.g. Performing Arts.',
  },
  defaultSort: 'order',
  access: {
    read: anyone,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  hooks: {
    beforeValidate: [fillSlug('name'), preventNearDuplicates('typologies')],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      unique: true,
    },
    {
      name: 'order',
      type: 'number',
      admin: {
        description: 'Position in menus and filters. Lower numbers come first.',
        position: 'sidebar',
      },
    },
    normalizedNameField,
    slug('name'),
  ],
}
