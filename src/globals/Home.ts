import type { GlobalConfig } from 'payload'

import { authenticated } from '../access/authenticated'
import { publishedGlobal } from '../access/publishedGlobal'

/** Row layouts and how many items each holds. Widths are on a 22-part grid: 13 + 9. */
export const ROW_LAYOUTS = {
  one: { label: 'One, full width', items: 1 },
  two: { label: 'Two, equal', items: 2 },
  'wide-narrow': { label: 'Two, wide then narrow', items: 2 },
  'narrow-wide': { label: 'Two, narrow then wide', items: 2 },
  three: { label: 'Three, equal', items: 3 },
} as const
export type RowLayout = keyof typeof ROW_LAYOUTS

/**
 * The homepage, as on the current site: rows of project photographs, looping videos and
 * quotes. Each row has a layout; each item in it is a project tile or a quote.
 */
export const Home: GlobalConfig = {
  slug: 'home',
  label: 'Homepage',
  admin: { description: 'Rows from top to bottom. Drag to reorder. Only published projects appear.' },
  access: { read: publishedGlobal, update: authenticated },
  versions: { drafts: true },
  fields: [
    {
      name: 'rows',
      type: 'array',
      labels: { singular: 'Row', plural: 'Rows' },
      fields: [
        {
          name: 'layout',
          type: 'select',
          required: true,
          defaultValue: 'three',
          options: Object.entries(ROW_LAYOUTS).map(([value, { label }]) => ({ value, label })),
          admin: { description: 'One, two or three items side by side. On phones they stack.' },
        },
        {
          name: 'items',
          type: 'blocks',
          required: true,
          minRows: 1,
          maxRows: 3,
          validate: (value: unknown, { siblingData }: { siblingData: { layout?: RowLayout } }) => {
            const wanted = ROW_LAYOUTS[siblingData?.layout ?? 'three']?.items
            const count = Array.isArray(value) ? value.length : 0
            return !wanted || count === wanted
              ? true
              : `This layout holds ${wanted} item${wanted > 1 ? 's' : ''}; this row has ${count}. Add or remove items, or pick another layout.`
          },
          blocks: [
            {
              slug: 'project',
              labels: { singular: 'Project', plural: 'Projects' },
              fields: [
                { name: 'project', type: 'relationship', relationTo: 'projects', required: true },
                {
                  type: 'row',
                  fields: [
                    {
                      name: 'image',
                      type: 'upload',
                      relationTo: 'media',
                      admin: { description: "Optional. Another photograph of the project instead of its main image." },
                    },
                    {
                      name: 'video',
                      type: 'upload',
                      relationTo: 'videos',
                      admin: { description: 'Optional. Plays muted, on a loop, in place of the photograph.' },
                    },
                  ],
                },
              ],
            },
            {
              slug: 'quote',
              labels: { singular: 'Quote', plural: 'Quotes' },
              fields: [
                {
                  name: 'text',
                  type: 'textarea',
                  required: true,
                  admin: { description: 'Exactly as said. No quotation marks; the site adds them.' },
                },
                { name: 'attribution', type: 'text', required: true, admin: { description: 'e.g. Suzan Tillotson' } },
              ],
            },
          ],
        },
      ],
    },
  ],
}
