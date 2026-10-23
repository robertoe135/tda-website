import type { Block } from 'payload'

import { urlField } from '../../fields/website'

/**
 * The building blocks of a newsletter issue. Each has one fixed look (src/emails/Newsletter.tsx),
 * so every issue stays on brand and reads well in Outlook and Gmail; editors choose, order and
 * fill them. A block left empty is not sent, and a section heading with nothing under it is
 * dropped, so the template's blocks can stay in an issue that doesn't use them.
 */

const published = { _status: { equals: 'published' } } as const

const paragraphs = 'Separate paragraphs with an empty line.'

export const LetterBlock: Block = {
  slug: 'letter',
  labels: { singular: 'Letter', plural: 'Letters' },
  admin: { group: 'Opening', disableBlockName: true },
  fields: [
    { name: 'body', type: 'textarea', admin: { description: `The opening letter. ${paragraphs}` } },
    {
      type: 'row',
      fields: [
        { name: 'signatureName', label: 'Signed by', type: 'text' },
        { name: 'signatureTitle', label: 'Their title', type: 'text' },
      ],
    },
  ],
}

export const SectionBlock: Block = {
  slug: 'section',
  labels: { singular: 'Section heading', plural: 'Section headings' },
  admin: { group: 'Layout', disableBlockName: true },
  fields: [
    {
      name: 'title',
      type: 'text',
      admin: {
        description:
          'e.g. Recent work. Numbered (01, 02…) in order; left out of the email when nothing follows it.',
      },
    },
  ],
}

export const ProjectBlock: Block = {
  slug: 'project',
  labels: { singular: 'Project', plural: 'Projects' },
  admin: { group: 'From the site', disableBlockName: true },
  fields: [
    {
      name: 'project',
      type: 'relationship',
      relationTo: 'projects',
      filterOptions: () => published,
      admin: {
        description:
          'Its main photo, name, city, architect, client and photographer come from the project. Only published projects can be chosen; a confidential project never shows its client.',
      },
    },
    {
      name: 'note',
      type: 'textarea',
      admin: {
        description: `A few lines for this issue. Empty: the project’s summary is used. ${paragraphs}`,
      },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'image',
          label: 'Different photo',
          type: 'upload',
          relationTo: 'media',
          admin: { description: 'Optional. Otherwise the project’s main photo.' },
        },
        { name: 'showCredits', label: 'Show credits', type: 'checkbox', defaultValue: true },
      ],
    },
  ],
}

export const ProjectGridBlock: Block = {
  slug: 'projectGrid',
  labels: { singular: 'Projects, two across', plural: 'Projects, two across' },
  admin: { group: 'From the site', disableBlockName: true },
  fields: [
    {
      name: 'projects',
      type: 'relationship',
      relationTo: 'projects',
      hasMany: true,
      filterOptions: () => published,
      admin: {
        description: 'Shown two across with photo, name and city, every photo cropped to the same shape around its focal point. Good for work in progress.',
      },
    },
  ],
}

export const ConversationBlock: Block = {
  slug: 'conversation',
  labels: { singular: 'Conversation', plural: 'Conversations' },
  admin: { group: 'Stories', disableBlockName: true },
  fields: [
    {
      type: 'row',
      fields: [
        { name: 'name', type: 'text', admin: { description: 'Who TDA spoke with.' } },
        { name: 'role', type: 'text', admin: { description: 'Their role or firm.' } },
      ],
    },
    { name: 'portrait', type: 'upload', relationTo: 'media' },
    { name: 'question', type: 'textarea' },
    {
      name: 'answer',
      type: 'textarea',
      admin: { description: `The start of the answer. ${paragraphs}` },
    },
    {
      type: 'row',
      fields: [
        urlField('url', 'Link to the full conversation'),
        { name: 'linkLabel', type: 'text', defaultValue: 'Read the conversation' },
      ],
    },
  ],
}

export const AwardsBlock: Block = {
  slug: 'awards',
  labels: { singular: 'Awards', plural: 'Awards' },
  admin: { group: 'From the site', disableBlockName: true },
  fields: [
    {
      name: 'awards',
      type: 'relationship',
      relationTo: 'awards',
      hasMany: true,
      admin: { description: 'Listed with the year and the project, linked to the project page.' },
    },
  ],
}

export const PressBlock: Block = {
  slug: 'press',
  labels: { singular: 'Press', plural: 'Press' },
  admin: { group: 'From the site', disableBlockName: true },
  fields: [
    {
      name: 'items',
      label: 'Articles',
      type: 'relationship',
      relationTo: 'press',
      hasMany: true,
      admin: { description: 'Listed with the outlet, linked to the article.' },
    },
  ],
}

export const EventsBlock: Block = {
  slug: 'events',
  labels: { singular: 'Talks and events', plural: 'Talks and events' },
  admin: { group: 'Stories', disableBlockName: true },
  fields: [
    {
      name: 'events',
      type: 'array',
      labels: { singular: 'Event', plural: 'Events' },
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'date',
              type: 'text',
              admin: { description: 'As it should read, e.g. May 20' },
            },
            { name: 'title', type: 'text', required: true },
            { name: 'place', type: 'text' },
          ],
        },
        urlField('url', 'Link (optional)'),
      ],
    },
  ],
}

export const TextBlock: Block = {
  slug: 'text',
  labels: { singular: 'Text', plural: 'Text' },
  admin: { group: 'Stories', disableBlockName: true },
  fields: [
    { name: 'heading', type: 'text' },
    { name: 'body', type: 'textarea', admin: { description: paragraphs } },
    {
      type: 'row',
      fields: [
        urlField('url', 'Link (optional)'),
        { name: 'linkLabel', type: 'text', defaultValue: 'Read more' },
      ],
    },
  ],
}

export const ImageBlock: Block = {
  slug: 'image',
  labels: { singular: 'Image', plural: 'Images' },
  admin: { group: 'Stories', disableBlockName: true },
  fields: [
    { name: 'image', type: 'upload', relationTo: 'media' },
    { name: 'caption', type: 'text' },
    urlField('url', 'Link (optional)'),
  ],
}

export const NEWSLETTER_BLOCKS = [
  LetterBlock,
  SectionBlock,
  ProjectBlock,
  ProjectGridBlock,
  ConversationBlock,
  AwardsBlock,
  PressBlock,
  EventsBlock,
  TextBlock,
  ImageBlock,
]

/** A new issue starts as the agreed layout (design D); editors delete what they don't use. */
export const TEMPLATE = [
  { blockType: 'letter' },
  { blockType: 'section', title: 'Recent work' },
  { blockType: 'project', showCredits: true },
  { blockType: 'project', showCredits: true },
  { blockType: 'section', title: 'In progress' },
  { blockType: 'projectGrid' },
  { blockType: 'section', title: 'Conversation' },
  { blockType: 'conversation', linkLabel: 'Read the conversation' },
  { blockType: 'section', title: 'Recognition' },
  { blockType: 'awards' },
  { blockType: 'press' },
  { blockType: 'events' },
]
