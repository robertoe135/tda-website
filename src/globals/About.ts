import type { GlobalConfig } from 'payload'

import { anyone } from '../access/anyone'
import { authenticated } from '../access/authenticated'

// Text comes from marketing; never draft or "improve" it here. Figures such as years of
// experience must be confirmed by marketing (the old site and Archinect disagree).
export const About: GlobalConfig = {
  slug: 'about',
  label: 'About page',
  access: {
    read: anyone,
    update: authenticated,
  },
  fields: [
    { name: 'philosophy', type: 'richText' },
    { name: 'background', type: 'richText' },
  ],
}
