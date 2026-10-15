import type { CollectionConfig } from 'payload'

import { authenticated } from '../access/authenticated'
import { publishedOrAuthenticated } from '../access/publishedOrAuthenticated'
import { fillSlug, slug } from '../fields/slug'

// Project facts are structured fields, never sentences: architect, location, year and team
// are relationships or numbers so every label on the site can link to a filtered view.
// Never write or "improve" summaries, descriptions, client names or credits; leave them
// empty for marketing.
export const Projects: CollectionConfig = {
  slug: 'projects',
  labels: { singular: 'Project', plural: 'Projects' },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'year', 'status', 'location', 'featured', '_status'],
    listSearchableFields: ['name', 'summary'],
  },
  defaultSort: '-year',
  versions: { drafts: true, maxPerDoc: 50 },
  access: {
    read: publishedOrAuthenticated(),
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  hooks: {
    beforeValidate: [fillSlug('name')],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      admin: { description: 'The project name only. Location and architect have their own fields.' },
    },
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Facts',
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'status',
                  label: 'Project status',
                  type: 'select',
                  // The default enum name would collide with the drafts enum for _status.
                  enumName: 'enum_projects_project_status',
                  required: true,
                  options: [
                    { label: 'Completed', value: 'completed' },
                    { label: 'In progress', value: 'in-progress' },
                    { label: 'Unbuilt', value: 'unbuilt' },
                  ],
                },
                {
                  name: 'year',
                  type: 'number',
                  min: 1900,
                  max: 2100,
                  admin: { description: 'Completion year, or expected year if in progress.' },
                },
              ],
            },
            {
              name: 'location',
              type: 'relationship',
              relationTo: 'locations',
            },
            {
              name: 'typologies',
              type: 'relationship',
              relationTo: 'typologies',
              hasMany: true,
              admin: { description: 'A project can belong to more than one.' },
            },
            {
              name: 'architects',
              type: 'relationship',
              relationTo: 'firms',
              hasMany: true,
              admin: { description: 'Architect(s) of the project. Add missing firms under Firms.' },
            },
            {
              name: 'otherCollaborators',
              type: 'array',
              labels: { singular: 'Collaborator', plural: 'Other collaborators' },
              fields: [
                {
                  type: 'row',
                  fields: [
                    { name: 'firm', type: 'relationship', relationTo: 'firms', required: true },
                    {
                      name: 'role',
                      type: 'select',
                      required: true,
                      options: [
                        { label: 'Interior designer', value: 'interior-designer' },
                        { label: 'Landscape architect', value: 'landscape-architect' },
                        { label: 'Exhibit designer', value: 'exhibit-designer' },
                        { label: 'Artist', value: 'artist' },
                        { label: 'Other', value: 'other' },
                      ],
                    },
                  ],
                },
              ],
            },
            {
              name: 'team',
              label: 'TDA team',
              type: 'relationship',
              relationTo: 'people',
              hasMany: true,
              filterOptions: { showOnSite: { equals: true } },
              admin: {
                description: 'Only people with "Show on site" turned on can be picked.',
              },
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'client',
                  type: 'text',
                  access: {
                    // Hidden from the public API, not just the page, when confidential.
                    read: ({ req, doc }) => Boolean(req.user) || !doc?.confidential,
                  },
                },
                {
                  name: 'confidential',
                  type: 'checkbox',
                  defaultValue: false,
                  admin: {
                    description:
                      'Hides the client everywhere on the public site. Usual for residences.',
                  },
                },
              ],
            },
            {
              name: 'predecessorFirm',
              label: 'Completed as',
              type: 'text',
              admin: {
                description:
                  'Only for work completed under a predecessor firm, e.g. Kugler Tillotson Associates.',
              },
            },
          ],
        },
        {
          label: 'Text',
          fields: [
            {
              name: 'summary',
              type: 'textarea',
              maxLength: 300,
              admin: {
                description:
                  'About two sentences. Used on project cards and in search results. Leave empty until marketing provides it.',
              },
            },
            {
              name: 'description',
              type: 'richText',
              admin: { description: 'Leave empty until marketing provides it.' },
            },
          ],
        },
        {
          label: 'Images',
          fields: [
            {
              name: 'heroImage',
              type: 'upload',
              relationTo: 'media',
              admin: { description: 'Main image. Also used when the page is shared.' },
            },
            {
              name: 'gallery',
              type: 'array',
              labels: { singular: 'Image', plural: 'Gallery' },
              fields: [
                { name: 'image', type: 'upload', relationTo: 'media', required: true },
                {
                  name: 'caption',
                  type: 'text',
                  admin: { description: 'Optional. Never paste the file name here.' },
                },
              ],
            },
          ],
        },
        {
          label: 'Old site',
          fields: [
            {
              name: 'legacyUrls',
              label: 'Old addresses',
              type: 'array',
              admin: {
                description:
                  'Every address this project had on the old site, e.g. /corporate/one-vanderbilt. Visitors and search engines using them are redirected here.',
              },
              fields: [
                {
                  name: 'path',
                  type: 'text',
                  required: true,
                  validate: (value: null | string | undefined) =>
                    value && /^\/[^\s]*$/.test(value) && !value.startsWith('//')
                      ? true
                      : 'Enter the part after the domain, starting with /, e.g. /corporate/one-vanderbilt',
                },
              ],
            },
          ],
        },
      ],
    },
    {
      name: 'featured',
      type: 'checkbox',
      defaultValue: false,
      admin: { position: 'sidebar', description: 'Show on the homepage.' },
    },
    slug('name'),
  ],
}
