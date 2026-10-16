import type { CollectionConfig } from 'payload'

import { anyone } from '../access/anyone'
import { authenticated } from '../access/authenticated'
import { sanitizeUpload } from '../hooks/sanitizeUpload'

export const Media: CollectionConfig = {
  slug: 'media',
  labels: { singular: 'Image', plural: 'Images' },
  admin: {
    useAsTitle: 'alt',
    defaultColumns: ['filename', 'alt', 'photographer', 'updatedAt'],
    description:
      'Photographs and headshots. Every image needs a description for screen readers and a credit; crediting the photographer is part of the license. Upload JPEGs exported at about 3000 px on the long side and under 4 MB; larger files are refused by the server.',
  },
  access: {
    read: anyone,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  hooks: {
    beforeOperation: [sanitizeUpload],
  },
  fields: [
    {
      name: 'alt',
      label: 'Description (alt text)',
      type: 'text',
      required: true,
      admin: {
        description:
          'What the image shows, for people using screen readers, e.g. "Lobby with a backlit onyx wall". Do not name private clients.',
      },
    },
    {
      name: 'photographer',
      type: 'relationship',
      relationTo: 'photographers',
    },
    {
      name: 'credit',
      label: 'Credit override',
      type: 'text',
      admin: {
        description:
          'Only when the credit is not a photographer in the list, or must read differently, e.g. "Courtesy of the architect".',
      },
      validate: (value: null | string | undefined, { siblingData }: { siblingData: { photographer?: unknown } }) =>
        value || siblingData?.photographer
          ? true
          : 'Choose a photographer or write a credit. Every image must be credited.',
    },
  ],
  upload: {
    mimeTypes: ['image/*'],
    focalPoint: true,
    imageSizes: [
      { name: 'card', width: 800, withoutEnlargement: true },
      { name: 'gallery', width: 1600, withoutEnlargement: true },
      { name: 'hero', width: 2400, withoutEnlargement: true },
      // Open Graph / social preview, cropped around the focal point.
      { name: 'og', width: 1200, height: 630, position: 'centre' },
    ],
    adminThumbnail: 'card',
  },
}
