'use client'

import { useActionState } from 'react'

import { subscribeAction } from '@/app/(frontend)/newsletter-actions'
import type { SignupResult } from '@/lib/subscribe'

/** Footer newsletter signup (Resend, double opt-in: lib/subscribe.ts). Rendered only once Resend is set up. */
export function NewsletterSignup() {
  const [state, action, pending] = useActionState<SignupResult | null, FormData>(
    subscribeAction,
    null,
  )
  if (state?.ok) {
    return (
      <p className="newsletter-done" role="status">
        Almost done: check your inbox to confirm.
      </p>
    )
  }
  return (
    <form action={action} className="newsletter" aria-label="Newsletter">
      <label htmlFor="newsletter-email">Newsletter</label>
      <div className="visually-hidden" aria-hidden="true">
        <input name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      <div className="newsletter-row">
        <input
          id="newsletter-email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="Email address"
          required
          aria-invalid={state && !state.ok ? true : undefined}
          aria-describedby={state && !state.ok ? 'newsletter-error' : undefined}
        />
        <button type="submit" disabled={pending}>
          {pending ? '…' : 'Sign up'}
        </button>
      </div>
      {state && !state.ok && (
        <p id="newsletter-error" className="field-error">
          {state.error}
        </p>
      )}
    </form>
  )
}
