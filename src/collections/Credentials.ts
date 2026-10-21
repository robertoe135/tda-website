import type { CollectionConfig } from 'payload'

import { anyone } from '../access/anyone'
import { authenticated } from '../access/authenticated'
import { fillSlug, slug } from '../fields/slug'
import { urlField } from '../fields/website'

// Professional credentials shown as badges under a person's name (CLD, LEED AP, WELL AP…).
// A list rather than a fixed dropdown so marketing can add one without a developer. Each badge
// links to the team page showing everyone who holds it.
export const Credentials: CollectionConfig = {
  slug: 'credentials',
  labels: { singular: 'Credential', plural: 'Credentials' },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'fullName', 'order'],
    group: 'Reference',
    description:
      'Professional credentials and memberships shown under a person’s name, e.g. CLD or LEED AP. Add them to a person under People → Credentials.',
  },
  defaultSort: ['order', 'name'],
  access: {
    read: anyone,
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
      label: 'Badge',
      type: 'text',
      required: true,
      unique: true,
      admin: { description: 'As written after a name, e.g. CLD, LEED AP BD+C, WELL AP.' },
    },
    {
      name: 'fullName',
      label: 'Full name',
      type: 'text',
      admin: {
        description: 'Optional, as the issuing body writes it, e.g. Certified Lighting Designer. Shown when someone points at the badge.',
      },
    },
    urlField('website', 'Website'),
    {
      name: 'order',
      type: 'number',
      admin: { position: 'sidebar', description: 'Position on the team page filter. Lower numbers come first.' },
    },
    slug('name'),
  ],
}
