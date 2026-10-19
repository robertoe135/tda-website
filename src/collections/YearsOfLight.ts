import type { CollectionConfig } from 'payload'

import { authenticated } from '../access/authenticated'
import { publishedOrAuthenticated } from '../access/publishedOrAuthenticated'

/**
 * Year of Light: the studio's year in review, a scroll story at /year-of-light/<year>.
 * The numbers (projects completed, places, awards, collaborators) are counted from published
 * projects and awards when the page is read, so they are never typed here and always match the
 * portfolio. Marketing adds only what the data can't know: the studio's own numbers, the light
 * of the year, and a few optional lines. Nothing shows until the year is published.
 */
export const CARD_OPTIONS = [
  { label: 'Projects completed', value: 'completed' },
  { label: 'Where', value: 'where' },
  { label: 'Awards', value: 'awards' },
  { label: 'Collaborators', value: 'collaborators' },
  { label: 'In the studio', value: 'studio' },
  { label: 'Light of the year', value: 'light' },
] as const
export type CardKey = (typeof CARD_OPTIONS)[number]['value']

export const YearsOfLight: CollectionConfig = {
  slug: 'years-of-light',
  labels: { singular: 'Year of Light', plural: 'Year of Light' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['year', '_status', 'updatedAt'],
    description:
      'The year in review, at /year-of-light. Projects, places, awards and collaborators are counted from published projects; add the studio’s own numbers and the light of the year here, then publish.',
    livePreview: {
      url: ({ data }) => (data?.year ? `/year-of-light/${data.year}?preview=1` : null),
      breakpoints: [
        { label: 'Phone', name: 'phone', width: 390, height: 844 },
        { label: 'Desktop', name: 'desktop', width: 1280, height: 860 },
      ],
    },
  },
  defaultSort: '-year',
  versions: { drafts: { autosave: { interval: 800 } }, maxPerDoc: 30 },
  access: {
    read: publishedOrAuthenticated(),
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  hooks: {
    beforeChange: [
      ({ data, originalDoc }) => {
        const year = data.year ?? originalDoc?.year
        return { ...data, title: year ? `Year of Light ${year}` : undefined }
      },
    ],
  },
  fields: [
    {
      name: 'year',
      type: 'number',
      required: true,
      unique: true,
      index: true,
      min: 1990,
      max: 2100,
      admin: { description: 'The year this looks back on. Its address is /year-of-light/<year>.' },
    },
    { name: 'title', type: 'text', admin: { hidden: true, readOnly: true } },
    {
      name: 'intro',
      label: 'Opening line',
      type: 'text',
      maxLength: 140,
      admin: { description: 'Optional, under the title on the first card.' },
    },
    {
      name: 'hiddenCards',
      label: 'Leave out',
      type: 'select',
      hasMany: true,
      options: [...CARD_OPTIONS],
      admin: {
        description:
          'Cards to skip this year. A card with nothing to show is skipped anyway (e.g. no awards, or no studio numbers).',
      },
    },
    {
      name: 'whereNote',
      label: 'Line on the “Where” card',
      type: 'text',
      maxLength: 160,
      admin: { description: 'Optional.' },
    },
    {
      name: 'collaborators',
      label: 'Collaborators to feature',
      type: 'relationship',
      relationTo: 'firms',
      hasMany: true,
      maxRows: 3,
      admin: {
        description:
          'Leave empty to show the firm(s) on the most awarded projects of the year, ties together (architects and credited firms, never clients). Choose firms here to show them instead.',
      },
    },
    {
      name: 'studio',
      label: 'In the studio',
      type: 'array',
      maxRows: 6,
      labels: { singular: 'Number', plural: 'Numbers' },
      admin: {
        description:
          'The studio’s own numbers for the year, e.g. 48 / mock-ups built. Only numbers someone has counted.',
      },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'value', type: 'text', required: true, maxLength: 12, admin: { width: '30%' } },
            { name: 'label', type: 'text', required: true, maxLength: 60, admin: { width: '70%' } },
          ],
        },
      ],
    },
    {
      name: 'light',
      label: 'Light of the year',
      type: 'group',
      fields: [
        {
          name: 'project',
          type: 'relationship',
          relationTo: 'projects',
          admin: { description: 'The studio’s pick. The card shows only once a published project is chosen.' },
        },
        {
          name: 'image',
          type: 'upload',
          relationTo: 'media',
          admin: { description: 'Optional. Leave empty to use the project’s main photo.' },
        },
        {
          name: 'quote',
          type: 'textarea',
          maxLength: 280,
          admin: { description: 'Optional: why this one, in the studio’s words.' },
        },
        {
          name: 'quoteBy',
          label: 'Quote by',
          type: 'relationship',
          relationTo: 'people',
          admin: { condition: (_, s) => Boolean(s?.quote) },
        },
      ],
    },
    {
      name: 'thanks',
      label: 'Thank-you line',
      type: 'text',
      maxLength: 160,
      admin: { description: 'Optional, on the last card.' },
    },
  ],
}
