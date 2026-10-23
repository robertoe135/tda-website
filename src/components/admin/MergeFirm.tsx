'use client'

import { Button, useDocumentInfo, useFormModified } from '@payloadcms/ui'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

type Firm = { id: number; name: string }
type Plan = {
  error?: string
  keep?: string
  merge?: string
  projects?: string[]
  aliases?: string[]
  years?: number[]
  filled?: string[]
  merged?: boolean
}

const small: React.CSSProperties = { margin: '0.4rem 0 0', fontSize: '0.85rem', color: 'var(--theme-elevation-650)' }
const panel: React.CSSProperties = {
  margin: '0.6rem 0 0',
  padding: '0.6rem 0.75rem',
  border: '1px solid var(--theme-elevation-150)',
  borderRadius: 'var(--style-radius-m)',
  fontSize: '0.85rem',
}

async function call(keepId: number, mergeId: number, confirm: boolean): Promise<Plan> {
  const res = await fetch(`/api/firms/${keepId}/merge`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mergeId, confirm }),
  })
  return res.json().catch(() => ({ error: 'Something went wrong. Nothing was changed.' }))
}

const FILLED: Record<string, string> = { website: 'its website', listAsCollaborator: 'its place on the Collaborators page' }

/**
 * What merging `merge` into `keep` would change, and the button that does it. The merge itself
 * runs on the server in one transaction (collections/firms-endpoints).
 */
export function MergePreview({ keep, merge, onDone, onCancel }: { keep: Firm; merge: Firm; onDone: (plan: Plan) => void; onCancel: () => void }) {
  const [plan, setPlan] = useState<Plan>()
  const [busy, setBusy] = useState(false)

  // The preview: what would change, with nothing changed yet.
  useEffect(() => {
    let current = true
    void call(keep.id, merge.id, false).then((p) => current && setPlan(p))
    return () => {
      current = false
    }
  }, [keep.id, merge.id])

  const confirm = async () => {
    setBusy(true)
    const result = await call(keep.id, merge.id, true)
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
                ? `${plan.projects.length} project${plan.projects.length === 1 ? '' : 's'} will name ${keep.name} instead: ${plan.projects.join(', ')}.`
                : `No project names ${merge.name}.`}
            </li>
            {plan.years?.length ? <li>Year of Light {plan.years.join(', ')} will feature {keep.name} instead.</li> : null}
            {plan.filled?.length ? <li>{keep.name} takes {plan.filled.map((f) => FILLED[f] ?? f).join(' and ')} from it.</li> : null}
            <li>
              &ldquo;{merge.name}&rdquo; becomes another name of {keep.name}, so old links, filters and imports using it
              land here.
            </li>
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
 * In a firm's sidebar: merge a duplicate (another record of the same firm or client) into this
 * one. Suggests records that look alike; any other can be found by name.
 */
export function MergeFirm() {
  const { id, title } = useDocumentInfo()
  const modified = useFormModified()
  const router = useRouter()
  const [suggested, setSuggested] = useState<Firm[]>()
  const [query, setQuery] = useState('')
  const [found, setFound] = useState<Firm[]>()
  const [chosen, setChosen] = useState<Firm>()
  const [done, setDone] = useState<string>()

  if (!id) return null
  const keep = { id: Number(id), name: String(title ?? 'this firm') }

  const suggest = async () => {
    const res = await fetch(`/api/firms/${keep.id}/duplicates`, { credentials: 'include' })
    setSuggested(((await res.json().catch(() => ({}))) as { firms?: Firm[] }).firms ?? [])
  }
  const search = async () => {
    if (!query.trim()) return
    const params = new URLSearchParams({ 'where[name][like]': query.trim(), limit: '10', depth: '0', sort: 'name' })
    const res = await fetch(`/api/firms?${params}`, { credentials: 'include' })
    const docs = ((await res.json().catch(() => ({}))) as { docs?: Firm[] }).docs ?? []
    setFound(docs.filter((f) => f.id !== keep.id).map((f) => ({ id: f.id, name: f.name })))
  }

  const pick = (list: Firm[] | undefined, empty: string) =>
    list &&
    (list.length ? (
      <ul style={{ listStyle: 'none', margin: '0.4rem 0 0', padding: 0 }}>
        {list.map((f) => (
          <li key={f.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'center', padding: '0.2rem 0' }}>
            <Link href={`/admin/collections/firms/${f.id}`}>{f.name}</Link>
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
      <h4 style={{ margin: 0 }}>Duplicates</h4>
      <p style={small}>Another record of the same firm or client? Merge it into this one: its projects move here and its name becomes another name of this record.</p>
      {modified && <p style={small}>Save your changes before merging.</p>}
      {done && <p style={{ ...small, color: 'var(--theme-success-500)' }}>{done}</p>}
      {chosen ? (
        <MergePreview
          keep={keep}
          merge={chosen}
          onCancel={() => setChosen(undefined)}
          onDone={(plan) => {
            setDone(`Merged ${plan.merge} into this record${plan.projects?.length ? ` (${plan.projects.length} project${plan.projects.length === 1 ? '' : 's'})` : ''}.`)
            setChosen(undefined)
            setSuggested((s) => s?.filter((f) => f.id !== chosen.id))
            setFound((s) => s?.filter((f) => f.id !== chosen.id))
            router.refresh()
          }}
        />
      ) : (
        <>
          {!suggested && (
            <div style={{ marginTop: '0.5rem' }}>
              <Button size="small" buttonStyle="secondary" margin={false} onClick={suggest}>
                Find likely duplicates
              </Button>
            </div>
          )}
          {pick(suggested, 'No record looks like this one. Search for one below.')}
          {/* Not a form: this sits inside the firm's own form, and Enter must not save the firm. */}
          <div role="search" style={{ display: 'flex', gap: '0.4rem', marginTop: '0.6rem' }}>
            <input
              type="search"
              aria-label="Search firms and clients by name"
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
