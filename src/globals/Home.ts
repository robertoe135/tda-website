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
 * Photo height on desktop, as a share of the row's width, so a row keeps its look at any screen
 * size. The steps cover the heights the old homepage used (its rows were 20% to 48% of the
 * page width). Phones always use the standard shapes.
 */
export const ROW_HEIGHTS = {
  low: { label: 'Low', share: 0.2 },
  medium: { label: 'Medium', share: 0.25 },
  tall: { label: 'Tall', share: 0.29 },
  taller: { label: 'Taller', share: 0.34 },
  tallest: { label: 'Tallest', share: 0.48 },
} as const
export type RowHeight = keyof typeof ROW_HEIGHTS

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
          name: 'height',
          type: 'select',
          options: Object.entries(ROW_HEIGHTS).map(([value, { label }]) => ({ value, label })),
          admin: {
            description:
              'How tall the photos in this row are on larger screens: Low is a wide strip, Tallest is close to square. Leave empty for the standard shapes.',
          },
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
                  name: 'name',
                  label: 'Name on the homepage',
                  type: 'text',
                  admin: {
                    description:
                      "Optional. Shown on this tile instead of the project's name, on the homepage only; the project page and everywhere else keep the project's name. A name only: location and architect have their own fields.",
                  },
                },
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
