'use client'

import { useField } from '@payloadcms/ui'

import type { FromApp, Match } from '@/lib/app-sync'

/**
 * Project → "From the TDA app" tab: what the internal app last sent (docs/app-sync.md) and how
 * each name was matched. Read-only. Suggested matches were used in the draft and need a person
 * to confirm them; missing ones were left empty. Fix either in the fields on the other tabs.
 */

const box: React.CSSProperties = {
  padding: 'calc(var(--base) * 0.75)',
  border: '1px solid var(--theme-elevation-150)',
  borderRadius: 'var(--style-radius-m)',
  marginBottom: 'var(--base)',
}
const muted: React.CSSProperties = { color: 'var(--theme-elevation-650)', fontSize: '0.85rem' }
const cell: React.CSSProperties = { padding: '6px 10px', borderBottom: '1px solid var(--theme-elevation-100)', verticalAlign: 'top', textAlign: 'left' }

const STATUS: Record<Match['status'], { label: string; color: string; bg: string }> = {
  matched: { label: 'Matched', color: 'var(--theme-success-750)', bg: 'var(--theme-success-100)' },
  suggested: { label: 'Suggested: check', color: 'var(--theme-warning-750)', bg: 'var(--theme-warning-100)' },
  missing: { label: 'Not found', color: 'var(--theme-error-750)', bg: 'var(--theme-error-100)' },
}

const ROLE: Record<string, string> = { principal: 'Principal in Charge', 'project-manager': 'Project Manager', designer: 'Designer' }

export function FromAppPanel({ path }: { path: string }) {
  const { value } = useField<FromApp | null>({ path })
  if (!value?.sent) {
    return (
      <div style={box}>
        <p style={{ margin: 0 }}>Nothing has been sent from the TDA app for this project.</p>
        <p style={{ ...muted, margin: '0.4rem 0 0' }}>The app&apos;s Marketing tab has a Send to website button. See docs/app-sync.md.</p>
      </div>
    )
  }
  const { sent, matches = [], warnings = [] } = value
  const toCheck = matches.filter((m) => m.status !== 'matched')
  const rows: [string, string | undefined][] = [
    ['Name', sent.name],
    ['TDA project number', sent.projectNumber],
    ['Year', sent.year ? String(sent.year) : undefined],
    ['Area (sq ft)', sent.areaSqFt ? sent.areaSqFt.toLocaleString('en-US') : undefined],
    ['Location', sent.location],
    ['Architects', sent.architects?.join('; ')],
    ['Credits', sent.credits?.map((c) => `${c.role}: ${c.firm}`).join('; ')],
    ['Client', sent.client],
    ['Summary', sent.summary],
    ['Write-up', sent.description?.join('\n\n')],
    ['TDA team', sent.team?.map((m) => `${m.name} (${ROLE[m.role] ?? m.role})`).join('; ')],
  ]

  return (
    <div>
      <div style={box}>
        <strong>
          Sent {new Date(value.sentAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
          {value.sentBy ? ` by ${value.sentBy}` : ''}
        </strong>
        <p style={{ ...muted, margin: '0.4rem 0 0' }}>
          {toCheck.length
            ? `${toCheck.length} name${toCheck.length === 1 ? '' : 's'} to check before publishing. Suggested ones are already in the draft; not-found ones were left empty.`
            : 'Every name matched a record here.'}{' '}
          Fields this project already had were kept; to take the app&apos;s version, clear the field and send again.
        </p>
        {warnings.map((w) => (
          <p key={w} style={{ margin: '0.5rem 0 0', color: 'var(--theme-warning-750)' }}>{w}</p>
        ))}
      </div>

      {matches.length > 0 && (
        <div style={{ ...box, overflowX: 'auto' }}>
          <h4 style={{ margin: '0 0 0.5rem' }}>Names</h4>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={cell}>Field</th>
                <th style={cell}>Sent from the app</th>
                <th style={cell}>Used here</th>
                <th style={cell}>Status</th>
              </tr>
            </thead>
            <tbody>
              {matches.map((m, i) => (
                <tr key={`${m.field}-${m.sent}-${i}`}>
                  <td style={cell}>{m.field}</td>
                  <td style={cell}>{m.sent}</td>
                  <td style={cell}>{m.usedName ?? '—'}</td>
                  <td style={cell}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, padding: '1px 8px', borderRadius: 10, color: STATUS[m.status].color, background: STATUS[m.status].bg }}>
                      {STATUS[m.status].label}
                    </span>
                    {m.note && <div style={{ ...muted, marginTop: 4 }}>{m.note}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ ...box, overflowX: 'auto' }}>
        <h4 style={{ margin: '0 0 0.5rem' }}>Everything sent</h4>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            {rows.map(([label, v]) => (
              <tr key={label}>
                <th style={{ ...cell, width: 180, fontWeight: 500 }}>{label}</th>
                <td style={{ ...cell, whiteSpace: 'pre-wrap', color: v ? undefined : 'var(--theme-elevation-500)' }}>{v || 'not sent'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
