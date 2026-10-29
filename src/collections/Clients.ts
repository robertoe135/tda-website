import type { CollectionConfig } from 'payload'

import { authenticated } from '../access/authenticated'
import { normalizedNameField, preventNearDuplicates } from '../hooks/preventNearDuplicates'
import { mergeHandler } from './merge-endpoint'

/**
 * Project owners, kept apart from Firms: TDA rarely works for the same owner twice, so a client
 * has no page, no filter and no place in site search. A project page shows its owner as plain
 * text unless the project is confidential.
 *
 * Staff only, even the list: it holds owners of confidential projects (private residences). The
 * public site reads the name of a non-confidential project's owner on the server
 * (lib/projects, withClientNames).
 */
export const Clients: CollectionConfig = {
  slug: 'clients',
  labels: { singular: 'Client', plural: 'Clients' },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'updatedAt'],
    group: 'Reference',
    description:
      'Project owners. Shown as plain text on a project page unless the project is confidential; never linked or searchable.',
  },
  endpoints: [{ path: '/:id/merge', method: 'post', handler: mergeHandler('clients') }],
  defaultSort: 'name',
  access: {
    read: authenticated,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  hooks: {
    beforeValidate: [preventNearDuplicates('clients')],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      unique: true,
      admin: { description: 'As the owner is named in credits, e.g. Lincoln Center for the Performing Arts.' },
    },
    {
      name: 'projects',
      type: 'join',
      collection: 'projects',
      on: 'clients',
      admin: { description: 'Projects this client owns. Edit the project to change this.' },
    },
    {
      // Merge another record of the same client into this one.
      name: 'mergeTool',
      type: 'ui',
      admin: { position: 'sidebar', components: { Field: '/components/admin/MergeRecords#MergeRecords' } },
    },
    normalizedNameField,
  ],
}
