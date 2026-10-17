import type { Field } from 'payload'

/** What a project can be missing, in the order marketing usually fills it in. */
export const STILL_NEEDED = [
  { value: 'photos', label: 'Photos' },
  { value: 'photographer', label: 'Photographer' },
  { value: 'category', label: 'Category' },
  { value: 'year', label: 'Completion year' },
  { value: 'location', label: 'Location' },
  { value: 'architect', label: 'Design architect' },
  { value: 'write-up', label: 'Write-up' },
] as const
export type StillNeeded = (typeof STILL_NEEDED)[number]['value']

const has = (v: unknown) => (Array.isArray(v) ? v.length > 0 : v !== null && v !== undefined && v !== '')

/** Rich text with at least one word in it. */
const hasText = (value: unknown): boolean => {
  if (typeof value === 'string') return value.trim().length > 0
  if (!value || typeof value !== 'object') return false
  const node = value as { text?: unknown; root?: unknown; children?: unknown[] }
  if (typeof node.text === 'string' && node.text.trim()) return true
  return [node.root, ...(node.children ?? [])].some((child) => child !== undefined && hasText(child))
}

/** What a project is missing, from its own fields. Photos without a credit need a photographer. */
export function stillNeeded(p: Record<string, unknown>): StillNeeded[] {
  const out: StillNeeded[] = []
  const photos = has(p.heroImage) || has(p.gallery)
  if (!photos) out.push('photos')
  if (photos && !has(p.photographers)) out.push('photographer')
  if (!has(p.typologies)) out.push('category')
  if (p.status !== 'in-progress' && !has(p.year)) out.push('year')
  if (!has(p.location)) out.push('location')
  if (!has(p.architects)) out.push('architect')
  if (!hasText(p.description)) out.push('write-up')
  return out
}

/**
 * "Still needed": worked out each time the project is read, never stored, so it is always
 * current and needs no upkeep. Shown to editors only (in the sidebar and as a list column);
 * the public site never sees it. Photos imported without a photographer show up here until
 * a credit is added.
 */
export const stillNeededField: Field = {
  name: 'stillNeeded',
  label: 'Still needed',
  type: 'select',
  hasMany: true,
  virtual: true,
  options: STILL_NEEDED.map((o) => ({ ...o })),
  access: { read: ({ req }) => Boolean(req.user) },
  admin: {
    readOnly: true,
    position: 'sidebar',
    description: 'Worked out from this project each time you save. Add what is listed before publishing; each item clears itself once filled in.',
  },
  hooks: { afterRead: [({ siblingData }) => stillNeeded(siblingData ?? {})] },
}
