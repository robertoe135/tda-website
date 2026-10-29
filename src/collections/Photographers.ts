import type { CollectionConfig } from 'payload'

import { anyone } from '../access/anyone'
import { authenticated } from '../access/authenticated'
import { fillSlug, slug } from '../fields/slug'
import { websiteField } from '../fields/website'
import { normalizedNameField, preventNearDuplicates } from '../hooks/preventNearDuplicates'
import { mergeHandler } from './merge-endpoint'

// Credited on every image they took; credit is part of the photography license.
export const Photographers: CollectionConfig = {
  slug: 'photographers',
  labels: { singular: 'Photographer', plural: 'Photographers' },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'website'],
    group: 'Reference',
    description:
      'Credited on every image they took. On the site, the credit links to every project with their photographs.',
  },
  endpoints: [{ path: '/:id/merge', method: 'post', handler: mergeHandler('photographers') }],
  defaultSort: 'name',
  access: {
    read: anyone,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  hooks: {
    beforeValidate: [preventNearDuplicates('photographers'), fillSlug('name')],
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
    {
      // Merge another record of the same photographer into this one.
      name: 'mergeTool',
      type: 'ui',
      admin: { position: 'sidebar', components: { Field: '/components/admin/MergeRecords#MergeRecords' } },
    },
    normalizedNameField,
    slug('name'),
  ],
}
