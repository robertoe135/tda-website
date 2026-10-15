import type { CollectionConfig } from 'payload'

import { authenticated } from '../access/authenticated'
import { publishedOrAuthenticated } from '../access/publishedOrAuthenticated'
import { fillSlug, slug } from '../fields/slug'
import { urlField } from '../fields/website'

// Bios and headshots come from each person, approved by them, via marketing. Never write or
// "improve" bio text here or in scripts: leave it empty and the page renders without it.
// Who is credited on the site is undecided (docs/decisions.md, question 2), so showOnSite
// defaults to off.
export const People: CollectionConfig = {
  slug: 'people',
  labels: { singular: 'Person', plural: 'People' },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'title', 'group', 'showOnSite', '_status'],
    description:
      'Everyone who can be credited on a project or shown on the team page. Only people with "Show on site" on and a published version appear publicly.',
  },
  defaultSort: ['group', 'order', 'name'],
  versions: { drafts: true, maxPerDoc: 50 },
  access: {
    read: publishedOrAuthenticated([{ showOnSite: { equals: true } }]),
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
      admin: { description: 'As the person wants it to appear.' },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'title',
          type: 'text',
          admin: {
            description:
              'e.g. Principal, Associate Principal, Senior Associate, Senior Designer, Designer',
          },
        },
        {
          name: 'group',
          type: 'select',
          options: [
            { label: 'Leadership', value: 'leadership' },
            { label: 'Design Team', value: 'design' },
            { label: 'Administration', value: 'administration' },
          ],
          admin: { description: 'Section of the team page.' },
        },
      ],
    },
    {
      name: 'headshot',
      type: 'upload',
      relationTo: 'media',
      admin: { description: 'Approved by the person.' },
    },
    {
      name: 'bio',
      type: 'richText',
      admin: { description: 'Written or approved by the person. Leave empty until it is.' },
    },
    urlField('linkedin', 'LinkedIn'),
    {
      name: 'projects',
      type: 'join',
      collection: 'projects',
      on: 'team',
      admin: { description: 'Projects crediting this person. Edit the project to change this.' },
    },
    {
      name: 'showOnSite',
      label: 'Show on site',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        position: 'sidebar',
        description: 'Off: hidden from the team page and from project credits.',
      },
    },
    {
      name: 'isCurrent',
      label: 'Current staff',
      type: 'checkbox',
      defaultValue: true,
      admin: { position: 'sidebar', description: 'Turn off when someone leaves TDA.' },
    },
    {
      name: 'order',
      type: 'number',
      admin: {
        position: 'sidebar',
        description: 'Position within their group on the team page. Lower numbers come first.',
      },
    },
    slug('name'),
  ],
}
