'use client'

import { Button, useAuth, useDocumentInfo, useFormFields } from '@payloadcms/ui'
import { useEffect, useState } from 'react'

type Status = { test: boolean; list: boolean; missing: string[]; site: string; siteOk: boolean }
type Note = { tone: 'ok' | 'error'; text: string } | undefined

const box: React.CSSProperties = {
  marginBottom: 'var(--base)',
  padding: 'calc(var(--base) * 0.75)',
  border: '1px solid var(--theme-elevation-150)',
  borderRadius: 'var(--style-radius-m)',
}
const small: React.CSSProperties = {
  margin: '0.4rem 0 0',
  fontSize: '0.8rem',
  color: 'var(--theme-elevation-600)',
}

/**
 * The issue's sidebar: send a test to yourself (the latest draft, edits included), then send the
 * published issue to the list once. Endpoints: collections/newsletters/endpoints.ts.
 */
export function NewsletterSend() {
  const { id } = useDocumentInfo()
  const { user } = useAuth()
  const sentAt = useFormFields(([fields]) => fields.sentAt?.value as string | undefined)
  const [status, setStatus] = useState<Status>()
  const [to, setTo] = useState('')
  const [busy, setBusy] = useState<'test' | 'send'>()
  const [note, setNote] = useState<Note>()
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    fetch('/api/newsletters/sending-status', { credentials: 'include' })
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus(undefined))
  }, [])

  if (!id) return <p style={small}>Save the issue to preview, test and send it.</p>

  const post = async (kind: 'test' | 'send') => {
    setBusy(kind)
    setNote(undefined)
    try {
      const res = await fetch(`/api/newsletters/${id}/${kind}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(kind === 'test' ? { to: to || user?.email } : {}),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) setNote({ tone: 'error', text: body.error ?? 'Something went wrong.' })
      else if (kind === 'test') setNote({ tone: 'ok', text: `Test sent to ${body.to.join(', ')}.` })
      else {
        setNote({ tone: 'ok', text: 'Sent to the list.' })
        window.location.reload()
      }
    } finally {
      setBusy(undefined)
      setConfirming(false)
    }
  }

  return (
    <div style={box}>
      <p style={{ margin: 0, fontWeight: 600 }}>Send</p>
      {status && !status.siteOk && (
        <p style={{ ...small, color: 'var(--theme-error-500)' }}>
          Links in the email lead to {status.site}, which isn’t this website. Set
          NEXT_PUBLIC_SERVER_URL in Vercel to this site’s address and redeploy (docs/newsletter.md).
        </p>
      )}
      {sentAt ? (
        <p style={small}>
          Sent {new Date(sentAt).toLocaleString()}. An issue goes out once; duplicate it to send a
          corrected one.
        </p>
      ) : (
        <>
          <label
            htmlFor="newsletter-test-to"
            style={{ ...small, display: 'block', marginTop: '0.8rem' }}
          >
            Send a test to
          </label>
          <input
            id="newsletter-test-to"
            type="text"
            inputMode="email"
            placeholder={user?.email ?? 'you@tillotsondesign.com'}
            value={to}
            onChange={(e) => setTo(e.target.value)}
            style={{ width: '100%', marginTop: '0.3rem', padding: '0.5rem', font: 'inherit' }}
          />
          <Button
            buttonStyle="secondary"
            size="small"
            disabled={!!busy || status?.test === false}
            onClick={() => post('test')}
          >
            {busy === 'test' ? 'Sending…' : 'Send a test'}
          </Button>
          <p style={small}>
            {status?.test === false
              ? 'Tests need an email service: RESEND_API_KEY and NEWSLETTER_FROM, or the site’s SMTP settings (docs/newsletter.md).'
              : 'The latest draft, edits included. Up to five addresses, separated by commas.'}
          </p>

          <div
            style={{
              marginTop: '1rem',
              paddingTop: '0.8rem',
              borderTop: '1px solid var(--theme-elevation-150)',
            }}
          >
            {status && !status.list ? (
              <p style={small}>
                Sending to the list isn’t set up yet. Missing in Vercel: {status.missing.join(', ')}{' '}
                (docs/newsletter.md).
              </p>
            ) : confirming ? (
              <>
                <p style={{ ...small, color: 'var(--theme-text)' }}>
                  Send the published issue to everyone on the list? This can’t be undone.
                </p>
                <Button
                  buttonStyle="primary"
                  size="small"
                  disabled={!!busy}
                  onClick={() => post('send')}
                >
                  {busy === 'send' ? 'Sending…' : 'Yes, send it'}
                </Button>{' '}
                <Button
                  buttonStyle="secondary"
                  size="small"
                  disabled={!!busy}
                  onClick={() => setConfirming(false)}
                >
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <Button
                  buttonStyle="primary"
                  size="small"
                  disabled={!!busy || !status}
                  onClick={() => setConfirming(true)}
                >
                  Send to the list
                </Button>
                <p style={small}>Sends the published version. Publish your changes first.</p>
              </>
            )}
          </div>
        </>
      )}
      {note && (
        <p
          role="status"
          style={{
            ...small,
            color: note.tone === 'error' ? 'var(--theme-error-500)' : 'var(--theme-success-500)',
          }}
        >
          {note.text}
        </p>
      )}
    </div>
  )
}
