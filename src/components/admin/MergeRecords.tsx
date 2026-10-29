'use client'

import { Button, useDocumentInfo, useFormModified } from '@payloadcms/ui'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

type Item = { id: number; name: string }
type Plan = {
  error?: string
  keep?: string
  merge?: string
  projects?: string[]
  aliases?: string[]
  years?: number[]
  photos?: number
  filled?: string[]
  merged?: boolean
}

/** What one record is called, for the texts below. */
const NOUN: Record<string, string> = { firms: 'firm', clients: 'client', photographers: 'photographer' }

const small: React.CSSProperties = { margin: '0.4rem 0 0', fontSize: '0.85rem', color: 'var(--theme-elevation-650)' }
const panel: React.CSSProperties = {
  margin: '0.6rem 0 0',
  padding: '0.6rem 0.75rem',
  border: '1px solid var(--theme-elevation-150)',
  borderRadius: 'var(--style-radius-m)',
  fontSize: '0.85rem',
}

async function call(collection: string, keepId: number, mergeId: number, confirm: boolean): Promise<Plan> {
  const res = await fetch(`/api/${collection}/${keepId}/merge`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mergeId, confirm }),
  })
  return res.json().catch(() => ({ error: 'Something went wrong. Nothing was changed.' }))
}

const FILLED: Record<string, string> = { website: 'its website', listAsCollaborator: 'its place on the Collaborators page' }
const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`

/**
 * What merging `merge` into `keep` would change, and the button that does it. The merge itself
 * runs on the server in one transaction (collections/merge-endpoint).
 */
function MergePreview({
  collection,
  keep,
  merge,
  onDone,
  onCancel,
}: {
  collection: string
  keep: Item
  merge: Item
  onDone: (plan: Plan) => void
  onCancel: () => void
}) {
  const [plan, setPlan] = useState<Plan>()
  const [busy, setBusy] = useState(false)

  // The preview: what would change, with nothing changed yet.
  useEffect(() => {
    let current = true
    void call(collection, keep.id, merge.id, false).then((p) => current && setPlan(p))
    return () => {
      current = false
    }
  }, [collection, keep.id, merge.id])

  const confirm = async () => {
    setBusy(true)
    const result = await call(collection, keep.id, merge.id, true)
    setBusy(false)
    if (result.error) setPlan(result)
    else onDone(result)
  }

  return (
    <div style={panel} role="region" aria-label={`Merge ${merge.name} into ${keep.name}`}>
      {!plan ? (
        <p style={{ margin: 0 }}>Checking what would change…</p>
      ) : plan.error ? (
        <p style={{ margin: 0, color: 'var(--theme-error-500)' }}>{plan.error}</p>
      ) : (
        <>
          <p style={{ margin: 0 }}>
            Keep <strong>{keep.name}</strong>; remove <strong>{merge.name}</strong>.
          </p>
          <ul style={{ margin: '0.4rem 0 0', paddingLeft: '1.1rem' }}>
            <li>
              {plan.projects?.length
                ? `${plural(plan.projects.length, 'project')} will name ${keep.name} instead: ${plan.projects.join(', ')}.`
                : `No project names ${merge.name}.`}
            </li>
            {plan.photos ? <li>{plural(plan.photos, 'photo')} will be credited to {keep.name} instead.</li> : null}
            {plan.years?.length ? <li>Year of Light {plan.years.join(', ')} will feature {keep.name} instead.</li> : null}
            {plan.filled?.length ? <li>{keep.name} takes {plan.filled.map((f) => FILLED[f] ?? f).join(' and ')} from it.</li> : null}
            {plan.aliases ? (
              <li>
                &ldquo;{merge.name}&rdquo; becomes another name of {keep.name}, so old links, filters and imports using it
                land here.
              </li>
            ) : null}
          </ul>
          <p style={small}>This can&rsquo;t be undone, except by recreating the record by hand.</p>
        </>
      )}
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.6rem' }}>
        {plan && !plan.error && (
          <Button size="small" margin={false} disabled={busy} onClick={confirm}>
            {busy ? 'Merging…' : `Merge into ${keep.name}`}
          </Button>
        )}
        <Button size="small" buttonStyle="secondary" margin={false} disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  )
}

/**
 * In the sidebar of a firm, client or photographer: merge another record of the same one into
 * this one. Find it by name, check what will change, confirm.
 */
export function MergeRecords() {
  const { id, title, collectionSlug } = useDocumentInfo()
  const modified = useFormModified()
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [found, setFound] = useState<Item[]>()
  const [chosen, setChosen] = useState<Item>()
  const [done, setDone] = useState<string>()

  if (!id || !collectionSlug) return null
  const noun = NOUN[collectionSlug] ?? 'record'
  const keep = { id: Number(id), name: String(title ?? `this ${noun}`) }

  const search = async () => {
    if (!query.trim()) return
    const params = new URLSearchParams({ 'where[name][like]': query.trim(), limit: '10', depth: '0', sort: 'name' })
    const res = await fetch(`/api/${collectionSlug}?${params}`, { credentials: 'include' })
    const docs = ((await res.json().catch(() => ({}))) as { docs?: Item[] }).docs ?? []
    setFound(docs.filter((f) => f.id !== keep.id).map((f) => ({ id: f.id, name: f.name })))
  }

  const pick = (list: Item[] | undefined, empty: string) =>
    list &&
    (list.length ? (
      <ul style={{ listStyle: 'none', margin: '0.4rem 0 0', padding: 0 }}>
        {list.map((f) => (
          <li key={f.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'center', padding: '0.2rem 0' }}>
            <Link href={`/admin/collections/${collectionSlug}/${f.id}`}>{f.name}</Link>
            <Button size="small" buttonStyle="secondary" margin={false} disabled={modified} onClick={() => setChosen(f)}>
              Merge in
            </Button>
          </li>
        ))}
      </ul>
    ) : (
      <p style={small}>{empty}</p>
    ))

  return (
    <div style={{ marginBottom: 'var(--base)' }}>
      <h4 style={{ margin: 0 }}>Merge</h4>
      <p style={small}>
        Another record of the same {noun}? Merge it into this one: its projects
        {collectionSlug === 'photographers' ? ' and photos' : ''} move here
        {collectionSlug === 'firms' ? ' and its name becomes another name of this record' : ''}.
      </p>
      {modified && <p style={small}>Save your changes before merging.</p>}
      {done && <p style={{ ...small, color: 'var(--theme-success-500)' }}>{done}</p>}
      {chosen ? (
        <MergePreview
          collection={collectionSlug}
          keep={keep}
          merge={chosen}
          onCancel={() => setChosen(undefined)}
          onDone={(plan) => {
            setDone(`Merged ${plan.merge} into this record${plan.projects?.length ? ` (${plural(plan.projects.length, 'project')})` : ''}.`)
            setChosen(undefined)
            setFound((s) => s?.filter((f) => f.id !== chosen.id))
            router.refresh()
          }}
        />
      ) : (
        <>
          {/* Not a form: this sits inside the record's own form, and Enter must not save it. */}
          <div role="search" style={{ display: 'flex', gap: '0.4rem', marginTop: '0.6rem' }}>
            <input
              type="search"
              aria-label={`Search ${noun}s by name`}
              placeholder="Search by name"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return
                e.preventDefault()
                void search()
              }}
              style={{ flex: 1, minWidth: 0, padding: '0.35rem 0.5rem', border: '1px solid var(--theme-elevation-250)', borderRadius: 'var(--style-radius-s)', background: 'var(--theme-input-bg)', color: 'inherit' }}
            />
            <Button size="small" buttonStyle="secondary" margin={false} onClick={search}>
              Search
            </Button>
          </div>
          {pick(found, 'No other record by that name.')}
        </>
      )}
    </div>
  )
}

export default MergeRecords
