/**
 * The visual editor (components/admin/NewsletterDesign) edits the same blocks as the form: this
 * turns an issue's blocks into the editor's data and back. A reference to something on the site
 * (a project, award, press item or image) is kept as { id, label } in the editor, so it can be
 * shown, and saved as its id. No database or browser code here: shared by both, and tested.
 */

export type Ref = { id: number; label: string; thumb?: string } | null
type Obj = Record<string, unknown>
type PuckItem = { type: string; props: Obj & { id: string } }
export type PuckData = { root: { props: Obj }; content: PuckItem[] }

export const BLOCK_TYPES = [
  'letter',
  'section',
  'project',
  'projectGrid',
  'conversation',
  'awards',
  'press',
  'events',
  'text',
  'image',
] as const
export type BlockType = (typeof BLOCK_TYPES)[number]

export type Kind = 'projects' | 'media' | 'awards' | 'press'

/** For each block, its fields that point at something on the site, and what they point at. */
const REFS: Partial<Record<BlockType, Record<string, Kind>>> = {
  project: { project: 'projects', image: 'media' },
  conversation: { portrait: 'media' },
  image: { image: 'media' },
}
/** Fields that point at several things, kept in the editor as a list of { [key]: Ref }. */
const LISTS: Partial<Record<BlockType, { field: string; key: string; kind: Kind }>> = {
  projectGrid: { field: 'projects', key: 'project', kind: 'projects' },
  awards: { field: 'awards', key: 'award', kind: 'awards' },
  press: { field: 'items', key: 'item', kind: 'press' },
}

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined)

/** How the editor names something on the site, from a read with depth 1 (or only its id). */
export function toRef(v: unknown, kind: Kind): Ref {
  if (v == null) return null
  if (typeof v === 'number') return { id: v, label: `#${v}` }
  if (!isObj(v) || typeof v.id !== 'number') return null
  const project = isObj(v.project) ? str(v.project.name) : undefined
  const label =
    kind === 'projects'
      ? str(v.name)
      : kind === 'media'
        ? str(v.alt)
        : kind === 'awards'
          ? [v.year, str(v.name), project && `(${project})`].filter(Boolean).join(' ')
          : [str(v.outlet), str(v.title)].filter(Boolean).join(': ')
  return {
    id: v.id,
    label: label || `#${v.id}`,
    thumb: kind === 'media' ? str(v.thumbnailURL) : undefined,
  }
}

const idOf = (v: unknown): number | null =>
  isObj(v) && typeof v.id === 'number' ? v.id : typeof v === 'number' ? v : null

/** An issue's blocks (as read with depth 1) as the editor's data. */
export function blocksToPuck(content: unknown[] | null | undefined): PuckData {
  const items: PuckItem[] = []
  for (const raw of content ?? []) {
    if (!isObj(raw) || typeof raw.blockType !== 'string') continue
    const type = raw.blockType as BlockType
    if (!BLOCK_TYPES.includes(type)) continue
    const { blockType: _t, id, blockName: _n, ...fields } = raw
    const props: Obj & { id: string } = { ...fields, id: String(id ?? `${type}-${items.length}`) }
    for (const [f, kind] of Object.entries(REFS[type] ?? {})) props[f] = toRef(fields[f], kind)
    const list = LISTS[type]
    if (list)
      props[list.field] = ((fields[list.field] as unknown[]) ?? [])
        .map((v) => toRef(v, list.kind))
        .filter(Boolean)
        .map((r) => ({ [list.key]: r }))
    if (type === 'events')
      props.events = ((fields.events as Obj[]) ?? []).map(({ id: _id, ...e }) => e)
    items.push({ type, props })
  }
  return { root: { props: {} }, content: items }
}

/** The editor's data as blocks to save: references back to ids, nothing the editor added. */
export function puckToBlocks(data: Pick<PuckData, 'content'>): Obj[] {
  return (data.content ?? [])
    .filter((item) => BLOCK_TYPES.includes(item.type as BlockType))
    .map((item) => {
      const type = item.type as BlockType
      const { id, ...props } = item.props
      const block: Obj = { blockType: type, id, ...props }
      for (const f of Object.keys(REFS[type] ?? {})) block[f] = idOf(props[f])
      const list = LISTS[type]
      if (list)
        block[list.field] = ((props[list.field] as Obj[]) ?? [])
          .map((row) => idOf(row?.[list.key]))
          .filter((n): n is number => n != null)
      if (type === 'events')
        block.events = ((props.events as Obj[]) ?? []).filter((e) => str(e.title)?.trim())
      for (const k of Object.keys(block)) if (block[k] === undefined) delete block[k]
      return block
    })
}
