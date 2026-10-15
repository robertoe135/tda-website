import type { GlobalConfig } from 'payload'

import { anyone } from '../access/anyone'
import { isAdmin } from '../access/isAdmin'
import { urlField } from '../fields/website'

// Contact details shown in the footer and on the contact page. Numbers like staff count do
// not belong here: compute them from People where they are needed.
export const SiteSettings: GlobalConfig = {
  slug: 'siteSettings',
  label: 'Site settings',
  admin: {
    description: 'Contact details and social links used across the site. Admins only.',
  },
  access: {
    read: anyone,
    update: isAdmin,
  },
  fields: [
    {
      name: 'address',
      type: 'group',
      admin: {
        description: 'The canonical office address. Directories and search listings should match it.',
      },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'street', type: 'text' },
            { name: 'suite', type: 'text', admin: { description: 'e.g. Suite 703' } },
          ],
        },
        {
          type: 'row',
          fields: [
            { name: 'city', type: 'text' },
            { name: 'region', label: 'State', type: 'text' },
            { name: 'postalCode', label: 'ZIP code', type: 'text' },
          ],
        },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'phone', type: 'text' },
        { name: 'generalEmail', label: 'General email', type: 'email' },
        { name: 'pressEmail', label: 'Press email', type: 'email' },
      ],
    },
    {
      name: 'careersText',
      label: 'Careers text',
      type: 'richText',
      admin: { description: 'Shown on the contact page. Leave empty if TDA is not hiring.' },
    },
    {
      name: 'socialLinks',
      label: 'Social links',
      type: 'array',
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'platform',
              type: 'select',
              required: true,
              options: ['Instagram', 'LinkedIn', 'Facebook', 'Vimeo', 'YouTube', 'X', 'Other'].map(
                (label) => ({ label, value: label.toLowerCase() }),
              ),
            },
            { ...urlField('url', 'Link'), required: true },
          ],
        },
      ],
    },
  ],
}
