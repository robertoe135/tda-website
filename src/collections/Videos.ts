import type { CollectionBeforeValidateHook, CollectionConfig } from 'payload'
import { ValidationError } from 'payload'

import { anyone } from '../access/anyone'
import { authenticated } from '../access/authenticated'

// Short muted loops for the homepage. Videos go from the browser straight to Vercel Blob
// (payload.config.ts), so they are not limited by Vercel's 4.5 MB request size, but they also
// skip the server: no renaming or metadata stripping as for images. Hence the size check and
// the file-name warning below. Every homepage visitor downloads each video in full (they
// autoplay), so the limit keeps Blob data transfer low: a 10–15 second loop fits in 5–8 MB.
export const MAX_VIDEO_MB = 15

/** Checks a newly uploaded file only, so a video uploaded under an older limit stays editable. */
export const checkVideoSize: CollectionBeforeValidateHook = ({ data, operation, originalDoc }) => {
  const newFile = operation !== 'update' || (data?.filename && data.filename !== originalDoc?.filename)
  if (newFile && data?.filesize && data.filesize > MAX_VIDEO_MB * 1024 * 1024) {
    throw new ValidationError({
      errors: [{ path: 'filesize', message: `Videos must be under ${MAX_VIDEO_MB} MB. Export a shorter or smaller loop.` }],
    })
  }
  return data
}

export const Videos: CollectionConfig = {
  slug: 'videos',
  labels: { singular: 'Video', plural: 'Videos' },
  admin: {
    useAsTitle: 'alt',
    defaultColumns: ['filename', 'alt', 'updatedAt'],
    description: `Short loops for the homepage. Export as MP4 (H.264), about 1920 px wide, no sound, under ${MAX_VIDEO_MB} MB (aim for 5–8 MB: a 10–15 second loop at about 4 Mbps). The file name is public: name it after the project, never after a private client.`,
  },
  access: {
    read: anyone,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  hooks: { beforeValidate: [checkVideoSize] },
  fields: [
    {
      name: 'alt',
      label: 'Description',
      type: 'text',
      required: true,
      admin: { description: 'What the video shows, in a few words. Do not name private clients.' },
    },
    {
      name: 'poster',
      label: 'Still image',
      type: 'upload',
      relationTo: 'media',
      required: true,
      admin: {
        description: 'Shown while the video loads, and instead of it for visitors who turn off motion. Usually the first frame.',
      },
    },
    {
      name: 'credit',
      type: 'text',
      admin: { description: 'Only if the video needs its own credit, e.g. a filmmaker.' },
    },
  ],
  upload: {
    mimeTypes: ['video/mp4', 'video/webm'],
  },
}
