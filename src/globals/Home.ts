import type { GlobalConfig } from 'payload'

import { authenticated } from '../access/authenticated'
import { publishedGlobal } from '../access/publishedGlobal'

/**
 * The homepage: an ordered list of projects, with quotes between them, as on the current
 * site. Each tile shows the project's main image and name and links to the project.
 */
export const Home: GlobalConfig = {
  slug: 'home',
  label: 'Homepage',
  admin: { description: 'Drag rows to reorder. Only published projects appear.' },
  access: { read: publishedGlobal, update: authenticated },
  versions: { drafts: true },
  fields: [
    {
      name: 'items',
      label: 'Projects and quotes',
      type: 'blocks',
      blocks: [
        {
          slug: 'project',
          labels: { singular: 'Project', plural: 'Projects' },
          fields: [{ name: 'project', type: 'relationship', relationTo: 'projects', required: true }],
        },
        {
          slug: 'quote',
          labels: { singular: 'Quote', plural: 'Quotes' },
          fields: [
            { name: 'text', type: 'textarea', required: true, admin: { description: 'Exactly as said. No quotation marks; the site adds them.' } },
            { name: 'attribution', type: 'text', required: true, admin: { description: 'e.g. Suzan Tillotson' } },
          ],
        },
      ],
    },
  ],
}
