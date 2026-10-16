import type { GlobalConfig } from 'payload'

import { authenticated } from '../access/authenticated'
import { publishedGlobal } from '../access/publishedGlobal'

// Text comes from marketing; never draft or "improve" it here. Figures such as staff count or
// years of experience must be confirmed by marketing (the old site and Archinect disagree).
export const About: GlobalConfig = {
  slug: 'about',
  label: 'About page',
  admin: { description: 'The Profile page: one section per heading (Philosophy, Background, …).' },
  access: { read: publishedGlobal, update: authenticated },
  versions: { drafts: true },
  fields: [
    {
      name: 'sections',
      type: 'array',
      labels: { singular: 'Section', plural: 'Sections' },
      fields: [
        { name: 'heading', type: 'text', required: true },
        { name: 'body', type: 'richText', required: true },
        { name: 'image', type: 'upload', relationTo: 'media', admin: { description: 'Optional. Shown above the section.' } },
      ],
    },
  ],
}
