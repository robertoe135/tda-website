'use client'

import { Button } from '@payloadcms/ui'
import { useRef, useState } from 'react'

type Line = { line: number; message: string }
type Result = {
  error?: string
  problems?: Line[]
  warnings?: Line[]
  projects?: { id: number; name: string; team: string[] }[]
  newPeople?: string[]
  saved?: boolean
}

const box: React.CSSProperties = {
  margin: '0 0 var(--base)',
  padding: 'calc(var(--base) * 0.75)',
  border: '1px solid var(--theme-elevation-150)',
  borderRadius: 'var(--style-radius-m)',
}
const small: React.CSSProperties = { margin: '0.4rem 0 0', fontSize: '0.85rem', color: 'var(--theme-elevation-650)' }

/**
 * Above the Projects list: spreadsheets in and out (endpoints in collections/projects-endpoints).
 * Export every project; download the team worksheet; upload it filled in, check it, then save
 * each project's TDA team as a draft. Nothing is saved while any row has a problem.
 */
export function ProjectTools() {
  const [open, setOpen] = useState(false)
  const [csv, setCsv] = useState<string>()
  const [file, setFile] = useState<string>()
  const [createPeople, setCreatePeople] = useState(false)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<Result>()
  const input = useRef<HTMLInputElement>(null)

  const send = async (save: boolean) => {
    if (!csv) return
    setBusy(true)
    try {
      const res = await fetch('/api/projects/import-team', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv, createPeople, save }),
      })
      setResult(await res.json().catch(() => ({ error: 'Something went wrong.' })))
    } finally {
      setBusy(false)
    }
  }

  const ok = result && !result.error && !result.problems?.length
  return (
    <div style={box}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
        <Button buttonStyle="secondary" size="small" el="anchor" url="/api/projects/export" newTab={false}>
          Export all projects (CSV)
        </Button>
        <Button buttonStyle="secondary" size="small" onClick={() => setOpen((o) => !o)}>
          {open ? 'Close team import' : 'Import TDA team credits'}
        </Button>
      </div>

      {open && (
        <div style={{ marginTop: '0.8rem' }}>
          <p style={small}>
            1. Download the <a href="/api/projects/team-worksheet" download>team worksheet</a> (every project, with its team)
            and the <a href="/api/projects/team-worksheet?names=1" download>list of names</a> to copy from. 2. Type names in the{' '}
            <code>person</code> column; roles are Principal in Charge, Project Manager or Designer. Leave rows you don’t need
            empty. 3. Save it as CSV and choose it here. Each project in the file gets exactly those people; projects saved as
            drafts, to publish when they look right.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', marginTop: '0.6rem' }}>
            <input
              ref={input}
              type="file"
              accept=".csv,text/csv,text/plain"
              onChange={async (e) => {
                const f = e.target.files?.[0]
                setResult(undefined)
                setFile(f?.name)
                setCsv(f ? await f.text() : undefined)
              }}
            />
            <label style={{ ...small, margin: 0, display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
              <input type="checkbox" checked={createPeople} onChange={(e) => setCreatePeople(e.target.checked)} />
              Add people who aren’t in the admin yet (as drafts)
            </label>
            <Button buttonStyle="primary" size="small" disabled={!csv || busy} onClick={() => send(false)}>
              {busy ? 'Checking…' : 'Check'}
            </Button>
          </div>

          {result?.error && <p style={{ ...small, color: 'var(--theme-error-500)' }}>{result.error}</p>}
          {result?.problems && result.problems.length > 0 && (
            <div role="alert" style={{ marginTop: '0.6rem' }}>
              <p style={{ ...small, color: 'var(--theme-error-500)' }}>
                {result.problems.length} problem(s) in {file}. Nothing was saved; fix them and choose the file again.
              </p>
              <ul style={{ ...small, paddingLeft: '1.2rem' }}>
                {result.problems.map((p, i) => (
                  <li key={i}>
                    Line {p.line}: {p.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {result?.warnings && result.warnings.length > 0 && (
            <ul style={{ ...small, paddingLeft: '1.2rem' }}>
              {result.warnings.map((w, i) => (
                <li key={i}>
                  Line {w.line}: {w.message}
                </li>
              ))}
            </ul>
          )}
          {ok && (
            <div style={{ marginTop: '0.6rem' }}>
              <p style={{ ...small, color: result.saved ? 'var(--theme-success-500)' : 'var(--theme-text)' }}>
                {result.saved
                  ? `Saved ${result.projects?.length} project draft(s)${result.newPeople?.length ? ` and ${result.newPeople.length} new person draft(s)` : ''}. Publish each project to show its team on the site.`
                  : `${result.projects?.length} project(s) will get these teams${result.newPeople?.length ? `, and ${result.newPeople.length} new person draft(s) will be added (${result.newPeople.join(', ')})` : ''}:`}
              </p>
              <ul style={{ ...small, paddingLeft: '1.2rem', maxHeight: '14rem', overflow: 'auto' }}>
                {result.projects?.map((p) => (
                  <li key={p.id}>
                    <a href={`/admin/collections/projects/${p.id}`}>{p.name}</a>: {p.team.join(', ')}
                  </li>
                ))}
              </ul>
              {!result.saved && (
                <Button buttonStyle="primary" size="small" disabled={busy} onClick={() => send(true)}>
                  {busy ? 'Saving…' : `Save ${result.projects?.length} project draft(s)`}
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
