import type { CollectionBeforeValidateHook, CollectionSlug, Field } from 'payload'
import { ValidationError } from 'payload'

/**
 * Reduces a name to letters and digits so that spelling-only variants collide:
 * "OMA-Office for Metropolitan Architecture" and "OMA - Office for Metropolitan Architecture"
 * both become "omaofficeformetropolitanarchitecture". Only used for comparison; the name an
 * editor types is stored exactly as written.
 */
export const normalizeName = (value: string): string =>
  value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]/g, '')

/** Hidden field that stores the normalized name, with a unique index as a backstop. */
export const normalizedNameField: Field = {
  name: 'normalizedName',
  type: 'text',
  admin: { hidden: true },
  index: true,
  unique: true,
}

/**
 * Refuses to save a record whose name differs from an existing one only by spacing,
 * punctuation, capitalization or accents, and tells the editor which record already exists.
 */
export const preventNearDuplicates =
  (collection: CollectionSlug, field = 'name'): CollectionBeforeValidateHook =>
  async ({ data, originalDoc, req }) => {
    const value = data?.[field] ?? originalDoc?.[field]
    if (!data || typeof value !== 'string') return data

    const normalizedName = normalizeName(value)
    data.normalizedName = normalizedName

    const existing = await req.payload.find({
      collection,
      depth: 0,
      limit: 1,
      pagination: false,
      req,
      where: {
        and: [
          { normalizedName: { equals: normalizedName } },
          ...(originalDoc?.id ? [{ id: { not_equals: originalDoc.id } }] : []),
        ],
      },
    })

    const match = existing.docs[0] as unknown as Record<string, unknown> | undefined
    if (match) {
      throw new ValidationError({
        collection,
        errors: [
          {
            path: field,
            message: `"${String(match[field])}" already exists. Use that record instead of creating a second one.`,
          },
        ],
        req,
      })
    }

    return data
  }
