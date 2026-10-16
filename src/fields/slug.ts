import type { CollectionBeforeValidateHook, RowField } from 'payload'
import { slugField } from 'payload'

/** "Museums + Galleries" → "museums-galleries", "Café Boulud" → "cafe-boulud". */
export const toSlug = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined
  const slug = value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || undefined
}

/**
 * Payload's slug field (sidebar, unique, indexed, editable), using TDA's slug rules.
 * Marked optional so Local API callers need not pass it (fillSlug supplies it), but the
 * validator still refuses to save a document without one.
 */
export const slug = (useAsSlug: string): RowField =>
  slugField({
    useAsSlug,
    required: false,
    slugify: ({ valueToSlugify }) => toSlug(valueToSlugify),
    overrides: (row) => {
      const field = row.fields.find((f) => 'name' in f && f.name === 'slug')
      if (field && field.type === 'text') {
        field.validate = (value: null | string | undefined) =>
          value ? true : 'A URL slug is required. Use letters, numbers and hyphens.'
      }
      return row
    },
  })

/**
 * Payload fills the slug in a beforeChange hook, which runs after required-field validation.
 * The admin UI fills it on the client first, but Local API callers (the migration scripts)
 * do not, so fill it here on create. Updates never touch an existing slug: changing it would
 * break live links.
 */
export const fillSlug =
  (useAsSlug: string): CollectionBeforeValidateHook =>
  ({ data, operation }) => {
    if (operation === 'create' && data && !data.slug) {
      data.slug = toSlug(data[useAsSlug])
    }
    return data
  }
