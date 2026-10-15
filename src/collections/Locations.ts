import type { CollectionBeforeValidateHook, CollectionConfig } from 'payload'

import { anyone } from '../access/anyone'
import { authenticated } from '../access/authenticated'
import { fillSlug, slug } from '../fields/slug'
import { normalizedNameField, preventNearDuplicates } from '../hooks/preventNearDuplicates'

type LocationParts = { city?: null | string; region?: null | string; country?: null | string }

/** "New York, NY" when there is a region, otherwise "London, United Kingdom". */
export const formatLocation = ({ city, region, country }: LocationParts): string =>
  [city, region || country].filter(Boolean).join(', ')

const setDisplayName: CollectionBeforeValidateHook = ({ data, originalDoc }) => {
  if (!data) return data
  const merged = { ...originalDoc, ...data } as LocationParts
  data.displayName = formatLocation(merged)
  return data
}

export const Locations: CollectionConfig = {
  slug: 'locations',
  labels: { singular: 'Location', plural: 'Locations' },
  admin: {
    useAsTitle: 'displayName',
    defaultColumns: ['displayName', 'country', 'slug'],
    group: 'Reference',
    description:
      'Cities where projects are. One record per city; projects link to it so the site can filter and map by place.',
  },
  defaultSort: 'displayName',
  access: {
    read: anyone,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  hooks: {
    beforeValidate: [
      setDisplayName,
      fillSlug('displayName'),
      preventNearDuplicates('locations', 'displayName'),
    ],
  },
  fields: [
    {
      type: 'row',
      fields: [
        { name: 'city', type: 'text', required: true },
        {
          name: 'region',
          type: 'text',
          admin: { description: 'State or province, as it should appear, e.g. NY' },
        },
        {
          name: 'country',
          type: 'text',
          required: true,
          admin: { description: 'Write each country the same way every time.' },
        },
      ],
    },
    {
      name: 'displayName',
      type: 'text',
      admin: {
        readOnly: true,
        description: 'Filled in automatically from city and state, or city and country.',
      },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'lat',
          label: 'Latitude',
          type: 'number',
          min: -90,
          max: 90,
          admin: { description: 'For the map. Right-click the city in Google Maps to copy it.' },
        },
        { name: 'lng', label: 'Longitude', type: 'number', min: -180, max: 180 },
      ],
    },
    normalizedNameField,
    slug('displayName'),
  ],
}
