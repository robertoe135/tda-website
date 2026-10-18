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
      name: 'lede',
      label: 'Opening line',
      type: 'text',
      admin: { description: 'Shown large at the top of the page. One sentence, from the text below.' },
    },
    {
      name: 'facts',
      type: 'array',
      maxRows: 4,
      labels: { singular: 'Fact', plural: 'Facts' },
      admin: { description: 'Up to four short facts under the opening line, e.g. 2004 / Founded. Only confirmed figures.' },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'value', type: 'text', required: true, admin: { description: 'e.g. 2004' } },
            { name: 'label', type: 'text', required: true, admin: { description: 'e.g. Founded' } },
          ],
        },
      ],
    },
    {
      name: 'sections',
      type: 'array',
      labels: { singular: 'Section', plural: 'Sections' },
      fields: [
        { name: 'heading', type: 'text', required: true },
        { name: 'body', type: 'richText', required: true },
        { name: 'image', type: 'upload', relationTo: 'media', admin: { description: 'Optional. Stays in view beside the text while this section is read (a band at the top on phones). Shown whole, never cropped.' } },
      ],
    },
  ],
}
