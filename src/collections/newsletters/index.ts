import type { Access, CollectionConfig } from 'payload'

import { authenticated } from '../../access/authenticated'
import { userIsAdmin } from '../../access/isAdmin'
import { NEWSLETTER_BLOCKS, TEMPLATE } from './blocks'
import { previewBlocks, sendingStatus, sendNewsletter, sendTest } from './endpoints'

/**
 * Newsletter issues, written in the admin from blocks and sent through Resend (docs/newsletter.md).
 * Drafts autosave, so the preview beside the form follows what is typed. Once sent, an issue
 * can't be sent again or deleted, and it appears at /newsletter/<id> for "View in browser".
 */
const unsentOrAdmin: Access = ({ req }) =>
  userIsAdmin(req) ? true : req.user ? { sentAt: { exists: false } } : false

/** A duplicate is a new, unsent issue. */
const clearOnDuplicate = { beforeDuplicate: [() => null] }

export const Newsletters: CollectionConfig = {
  slug: 'newsletters',
  labels: { singular: 'Newsletter', plural: 'Newsletters' },
  admin: {
    useAsTitle: 'subject',
    defaultColumns: ['subject', 'issueNumber', 'sentAt', 'updatedAt'],
    group: 'Newsletter',
    description:
      'Issues of the newsletter. Build an issue from blocks, check it in the preview, send yourself a test, then send it to the list.',
    components: {
      views: {
        edit: {
          // The visual editor: drag blocks into the email (components/admin/NewsletterDesign).
          design: {
            Component: '/components/admin/NewsletterDesignView#NewsletterDesignView',
            path: '/design',
            tab: { label: 'Design', href: '/design', order: 150 },
          },
        },
      },
    },
    livePreview: {
      // Same address as the admin, so the preview refreshes on each autosave.
      url: ({ data }) => (data?.id ? `/newsletter-preview/${data.id}` : null),
      breakpoints: [
        { label: 'Desktop', name: 'desktop', width: 760, height: 1000 },
        { label: 'Phone', name: 'phone', width: 390, height: 844 },
      ],
    },
  },
  defaultSort: '-createdAt',
  versions: { drafts: { autosave: { interval: 800 } }, maxPerDoc: 30 },
  access: {
    read: authenticated,
    create: authenticated,
    // A sent issue is the record of what went out (and its "View in browser" page): editors can't
    // change or delete it; to send a correction, duplicate it.
    update: unsentOrAdmin,
    delete: unsentOrAdmin,
  },
  endpoints: [
    { path: '/sending-status', method: 'get', handler: sendingStatus },
    { path: '/preview-blocks', method: 'post', handler: previewBlocks },
    { path: '/:id/test', method: 'post', handler: sendTest },
    { path: '/:id/send', method: 'post', handler: sendNewsletter },
  ],
  fields: [
    {
      name: 'subject',
      type: 'text',
      required: true,
      admin: {
        description: 'The email’s subject line, e.g. the issue’s theme or its three headlines.',
      },
    },
    {
      name: 'preheader',
      label: 'Preview line',
      type: 'text',
      maxLength: 140,
      admin: { description: 'Shown after the subject in most inboxes. One short sentence.' },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'masthead',
          label: 'Newsletter name',
          type: 'text',
          // The same every issue: a new issue starts with the last one's name.
          defaultValue: async ({ req }) => {
            const last = await req.payload.find({
              collection: 'newsletters',
              sort: '-createdAt',
              limit: 1,
              depth: 0,
              draft: true,
              req,
              select: { masthead: true },
            })
            return last.docs[0]?.masthead ?? undefined
          },
        },
        { name: 'issueNumber', label: 'Issue no.', type: 'number', min: 1 },
        {
          name: 'theme',
          type: 'text',
          admin: { description: 'Optional, e.g. Light and heritage.' },
        },
        { name: 'season', type: 'text', admin: { description: 'e.g. Autumn 2026' } },
      ],
    },
    {
      name: 'content',
      type: 'blocks',
      blocks: NEWSLETTER_BLOCKS,
      defaultValue: TEMPLATE,
      admin: {
        description:
          'Add, remove, reorder or duplicate blocks here, or visually in the Design tab. Empty blocks and headings with nothing under them are left out of the email.',
        initCollapsed: false,
      },
    },
    {
      name: 'sending',
      type: 'ui',
      admin: {
        position: 'sidebar',
        components: { Field: '/components/admin/NewsletterSend#NewsletterSend' },
      },
    },
    {
      name: 'sentAt',
      label: 'Sent',
      type: 'date',
      admin: {
        position: 'sidebar',
        readOnly: true,
        date: { displayFormat: 'MMM d, yyyy h:mm a' },
        condition: (d) => Boolean(d?.sentAt),
      },
      hooks: clearOnDuplicate,
    },
    {
      name: 'sentBy',
      type: 'text',
      admin: { position: 'sidebar', readOnly: true, condition: (d) => Boolean(d?.sentAt) },
      hooks: clearOnDuplicate,
    },
    {
      name: 'broadcastId',
      type: 'text',
      admin: { hidden: true, readOnly: true },
      hooks: clearOnDuplicate,
    },
  ],
}
