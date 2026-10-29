import type { CollectionBeforeValidateHook, CollectionConfig } from 'payload'
import { ValidationError } from 'payload'

import { anyone } from '../access/anyone'
import { authenticated } from '../access/authenticated'
import { fillSlug, slug } from '../fields/slug'
import { websiteField } from '../fields/website'
import { normalizeName, normalizedNameField, preventNearDuplicates } from '../hooks/preventNearDuplicates'
import { mergeHandler } from './merge-endpoint'

/**
 * Other names a firm goes by (SOM for Skidmore, Owings & Merrill) or has been misspelled as.
 * They are never shown; they make old links, filters and imports land on the main record.
 * An alias may not be this firm's name, repeat, or belong to another firm.
 */
const checkAliases: CollectionBeforeValidateHook = async ({ data, originalDoc, req }) => {
  if (!data?.aliases) return data
  const main = normalizeName(String(data.name ?? originalDoc?.name ?? ''))
  const seen = new Set<string>()
  for (const alias of data.aliases as { name?: string; normalizedName?: string }[]) {
    const key = normalizeName(alias.name ?? '')
    alias.normalizedName = key
    const problem =
      !key ? 'An alias needs a name.' : key === main ? 'An alias cannot be the firm’s own name.' : seen.has(key) ? `"${alias.name}" is listed twice.` : undefined
    seen.add(key)
    const other = problem
      ? undefined
      : (
          await req.payload.find({
            collection: 'firms',
            depth: 0,
            limit: 1,
            req,
            where: {
              and: [
                { or: [{ normalizedName: { equals: key } }, { 'aliases.normalizedName': { equals: key } }] },
                ...(originalDoc?.id ? [{ id: { not_equals: originalDoc.id } }] : []),
              ],
            },
          })
        ).docs[0]
    const message = problem ?? (other ? `"${alias.name}" already belongs to "${other.name}".` : undefined)
    if (message) throw new ValidationError({ collection: 'firms', errors: [{ path: 'aliases', message }], req })
  }
  return data
}

// Architects and other collaborators. Firm names are canonical here and nowhere else.
export const Firms: CollectionConfig = {
  slug: 'firms',
  labels: { singular: 'Firm', plural: 'Firms' },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'website', 'listAsCollaborator', 'slug'],
    group: 'Reference',
    description:
      'Architects and consultants. Firms that are an architect on a project get a collaborator page; consultants appear in project credits. Project owners are under Clients.',
  },
  endpoints: [
    { path: '/:id/merge', method: 'post', handler: mergeHandler('firms') },
  ],
  defaultSort: 'name',
  access: {
    read: anyone,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  hooks: {
    beforeValidate: [fillSlug('name'), preventNearDuplicates('firms', 'name', { aliases: true }), checkAliases],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        description: "The organization's own spelling of its name, e.g. Kohn Pedersen Fox.",
      },
    },
    {
      name: 'aliases',
      label: 'Other names',
      type: 'array',
      labels: { singular: 'Other name', plural: 'Other names' },
      admin: {
        description:
          'Abbreviations and other spellings of this firm, e.g. SOM. Never shown on the site: old links, filters and imports using them land on this firm.',
      },
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'normalizedName', type: 'text', index: true, admin: { hidden: true } },
      ],
    },
    websiteField,
    {
      name: 'projects',
      type: 'join',
      collection: 'projects',
      on: 'architects',
      admin: { description: 'Projects where this firm is an architect. Edit the project to change this.' },
    },
    {
      name: 'listAsCollaborator',
      label: 'Show on Collaborators page',
      type: 'checkbox',
      defaultValue: false,
      index: true,
      admin: {
        position: 'sidebar',
        description:
          'Lists this firm on About → Collaborators. Its name links to its projects in the portfolio once one is published.',
      },
    },
    {
      // Merge another record of the same firm into this one.
      name: 'mergeTool',
      type: 'ui',
      admin: { position: 'sidebar', components: { Field: '/components/admin/MergeRecords#MergeRecords' } },
    },
    normalizedNameField,
    slug('name'),
  ],
}
