import type { CollectionConfig } from 'payload'

import { authenticated } from '../access/authenticated'
import { publishedOrAuthenticated } from '../access/publishedOrAuthenticated'
import { fillSlug, slug } from '../fields/slug'
import { stillNeededField } from '../fields/stillNeeded'
import { exportProjects, importTeam, teamWorksheet } from './projects-endpoints'

// Project facts are structured fields, never sentences: architect, location, year and team
// are relationships or numbers so every label on the site can link to a filtered view.
// Never write or "improve" summaries, descriptions, client names or credits; leave them
// empty for marketing.
export const Projects: CollectionConfig = {
  slug: 'projects',
  labels: { singular: 'Project', plural: 'Projects' },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'year', 'status', 'stillNeeded', '_status'],
    listSearchableFields: ['name', 'summary'],
    components: {
      // Export every project as CSV; import TDA team credits from a filled-in worksheet.
      beforeListTable: ['/components/admin/ProjectTools#ProjectTools'],
    },
  },
  endpoints: [
    { path: '/export', method: 'get', handler: exportProjects },
    { path: '/team-worksheet', method: 'get', handler: teamWorksheet },
    { path: '/import-team', method: 'post', handler: importTeam },
  ],
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
                    { label: 'Cancelled', value: 'cancelled' },
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
              type: 'row',
              fields: [
                {
                  name: 'areaSqFt',
                  label: 'Area (sq ft)',
                  type: 'number',
                  min: 0,
                  admin: { description: 'Gross area in square feet, numbers only.' },
                },
                {
                  name: 'areaNote',
                  label: 'Area note',
                  type: 'text',
                  admin: { description: 'Optional, e.g. "Lobby: 5,200 SF".' },
                },
              ],
            },
            {
              name: 'certifications',
              label: 'Sustainability certifications',
              type: 'array',
              labels: { singular: 'Certification', plural: 'Certifications' },
              fields: [
                {
                  type: 'row',
                  fields: [
                    {
                      name: 'system',
                      type: 'select',
                      required: true,
                      options: [
                        { label: 'LEED', value: 'leed' },
                        { label: 'WELL', value: 'well' },
                        { label: 'Other', value: 'other' },
                      ],
                    },
                    {
                      name: 'level',
                      type: 'select',
                      required: true,
                      options: [
                        { label: 'Certified', value: 'certified' },
                        { label: 'Silver', value: 'silver' },
                        { label: 'Gold', value: 'gold' },
                        { label: 'Platinum', value: 'platinum' },
                      ],
                    },
                    {
                      name: 'note',
                      type: 'text',
                      admin: { description: 'Optional, e.g. "ID+C" or the system name for Other.' },
                    },
                  ],
                },
              ],
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
              name: 'credits',
              label: 'Credits',
              type: 'array',
              labels: { singular: 'Credit', plural: 'Credits' },
              admin: {
                description:
                  'Everyone else on the project: executive architect, engineers, consultants. Architects above are featured; these are listed.',
              },
              fields: [
                {
                  type: 'row',
                  fields: [
                    {
                      name: 'role',
                      type: 'relationship',
                      relationTo: 'creditRoles',
                      required: true,
                      admin: { description: 'Add missing roles under Credit roles.' },
                    },
                    {
                      name: 'firms',
                      type: 'relationship',
                      relationTo: 'firms',
                      hasMany: true,
                      required: true,
                    },
                  ],
                },
              ],
            },
            {
              name: 'team',
              label: 'TDA team',
              type: 'array',
              labels: { singular: 'Team member', plural: 'TDA team' },
              admin: {
                description:
                  'Who worked on the project and in what role. Only people with "Show on site" on can be picked; former staff appear without a link.',
              },
              fields: [
                {
                  type: 'row',
                  fields: [
                    {
                      name: 'person',
                      type: 'relationship',
                      relationTo: 'people',
                      required: true,
                      filterOptions: { showOnSite: { equals: true } },
                    },
                    {
                      name: 'role',
                      type: 'select',
                      required: true,
                      options: [
                        { label: 'Principal in Charge', value: 'principal' },
                        { label: 'Project Manager', value: 'project-manager' },
                        { label: 'Designer', value: 'designer' },
                      ],
                    },
                  ],
                },
              ],
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'clients',
                  label: 'Client',
                  type: 'relationship',
                  relationTo: 'firms',
                  hasMany: true,
                  admin: {
                    description:
                      'The owner. Can be the same firm as the architect. Add missing clients under Firms & clients.',
                  },
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
              admin: {
                // Many photos at once, through Payload's bulk upload (components/admin/GalleryBulkAdd).
                components: { beforeInput: ['/components/admin/GalleryBulkAdd#GalleryBulkAdd'] },
              },
              fields: [
                { name: 'image', type: 'upload', relationTo: 'media', required: true },
                {
                  name: 'caption',
                  type: 'text',
                  admin: { description: 'Optional. Never paste the file name here.' },
                },
              ],
            },
            {
              name: 'photographers',
              type: 'relationship',
              relationTo: 'photographers',
              hasMany: true,
              admin: {
                description:
                  'Credited as "Photography" on the project page, for all its images. Set a photographer on a single image only when it differs.',
              },
            },
          ],
        },
        {
          label: 'Awards & press',
          fields: [
            {
              name: 'awards',
              type: 'join',
              collection: 'awards',
              on: 'project',
              admin: { description: 'Add awards under Awards and pick this project.' },
            },
            {
              name: 'press',
              type: 'join',
              collection: 'press',
              on: 'projects',
              admin: { description: 'Add articles under Press and pick this project.' },
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
    stillNeededField,
    {
      name: 'featured',
      type: 'checkbox',
      defaultValue: false,
      admin: { position: 'sidebar', description: 'Show on the homepage.' },
    },
    slug('name'),
  ],
}
