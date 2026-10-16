import type { CollectionConfig } from 'payload'

import { anyone } from '../access/anyone'
import { authenticated } from '../access/authenticated'
import { sanitizeUpload } from '../hooks/sanitizeUpload'
import { blobFileURL } from '../lib/blob'

export const Media: CollectionConfig = {
  slug: 'media',
  labels: { singular: 'Image', plural: 'Images' },
  admin: {
    useAsTitle: 'alt',
    defaultColumns: ['filename', 'alt', 'photographer', 'updatedAt'],
    description:
      'Photographs and headshots. Every image needs a description for screen readers. Every image must be credited, on the image or, for project photos, on the project; crediting the photographer is part of the license. Upload JPEGs exported at about 3000 px on the long side and under 4 MB; larger files are refused by the server.',
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
          'Only when the credit is not a photographer in the list, or must read differently, e.g. "Courtesy of the architect". Project photos are credited on the project (Images → Photographers); leave both empty when that covers this image.',
      },
    },
    {
      // Set by scripts/media/import.ts so a second run reuses the upload instead of
      // duplicating it. A hash of the original file's bytes; reveals nothing about it.
      name: 'sourceHash',
      type: 'text',
      index: true,
      admin: { hidden: true },
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
    // Built from the file name, not the address saved at upload: photos load straight from Blob,
    // and addresses saved before that change (/api/media/file/…) no longer lead anywhere.
    adminThumbnail: ({ doc }) => {
      const sizes = doc.sizes as { card?: { filename?: string | null } } | undefined
      const filename = sizes?.card?.filename || (doc.filename as string | undefined)
      return filename ? blobFileURL(filename) : null
    },
  },
}
