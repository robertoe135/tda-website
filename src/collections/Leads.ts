import type { CollectionConfig } from 'payload'

import { isAdmin } from '../access/isAdmin'

/**
 * People who contacted TDA through the site: career applications for now, other inquiries
 * later. Personal data, so admins only, and nothing here is ever public. Leads are created
 * by the site's own forms (src/lib/careers.ts), never through the API. CVs are not stored:
 * they are attached to the email sent to the jobs inbox, and only the file name is kept here.
 */
export const Leads: CollectionConfig = {
  slug: 'leads',
  labels: { singular: 'Lead', plural: 'Leads' },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'type', 'position', 'status', 'createdAt'],
    group: 'Inbox',
    description:
      'Career applications and inquiries sent through the site. Admins only. Delete applications once a position is filled or after six months, whichever comes first.',
  },
  defaultSort: '-createdAt',
  access: {
    read: isAdmin,
    create: () => false, // only the site's forms, via the Local API
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'type',
          type: 'select',
          required: true,
          defaultValue: 'career',
          options: [
            { label: 'Career application', value: 'career' },
            { label: 'Inquiry', value: 'inquiry' },
          ],
          admin: { readOnly: true },
        },
        {
          name: 'status',
          type: 'select',
          required: true,
          defaultValue: 'new',
          options: [
            { label: 'New', value: 'new' },
            { label: 'Reviewing', value: 'reviewing' },
            { label: 'Contacted', value: 'contacted' },
            { label: 'Closed', value: 'closed' },
          ],
        },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'name', type: 'text', required: true, admin: { readOnly: true } },
        { name: 'email', type: 'email', required: true, admin: { readOnly: true } },
        { name: 'phone', type: 'text', admin: { readOnly: true } },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'position', label: 'Position of interest', type: 'text', admin: { readOnly: true } },
        { name: 'portfolioUrl', label: 'Portfolio or website', type: 'text', admin: { readOnly: true } },
      ],
    },
    { name: 'message', type: 'textarea', admin: { readOnly: true } },
    {
      name: 'cvFileName',
      label: 'CV',
      type: 'text',
      admin: { readOnly: true, description: 'File name only. The CV itself is attached to the email in the jobs inbox.' },
    },
    {
      name: 'notes',
      label: 'Internal notes',
      type: 'textarea',
      admin: { description: 'For TDA only. Never shared with the applicant.' },
    },
    {
      name: 'emailSent',
      label: 'Emailed to the jobs inbox',
      type: 'checkbox',
      defaultValue: false,
      admin: { readOnly: true, position: 'sidebar', description: 'Off means the email failed: read the CV from the applicant directly.' },
    },
    // A hash of the sender's IP address with a server secret, only to limit repeated
    // submissions. It cannot be turned back into the address.
    { name: 'senderHash', type: 'text', index: true, admin: { hidden: true } },
  ],
}
