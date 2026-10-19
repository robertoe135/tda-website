'use client'

import { useActionState } from 'react'

import { confirmAction } from '@/app/(frontend)/subscribe/confirm/actions'
import type { SignupResult } from '@/lib/subscribe'

/** The confirm button on /subscribe/confirm, then the outcome. */
export function ConfirmSignup({ token, email }: { token: string; email: string }) {
  const [state, action, pending] = useActionState<SignupResult | null, FormData>(
    confirmAction,
    null,
  )
  if (state?.ok)
    return (
      <p className="subscribe-note" role="status">
        You’re subscribed. The next issue will reach {email}.
      </p>
    )
  return (
    <form action={action}>
      <p className="subscribe-note">
        Confirm that {email} should receive the Tillotson Design Associates newsletter.
      </p>
      <input type="hidden" name="t" value={token} />
      <button type="submit" className="button-solid" disabled={pending}>
        {pending ? 'Confirming…' : 'Confirm subscription'}
      </button>
      {state && !state.ok && (
        <p className="field-error" role="alert">
          {state.error}
        </p>
      )}
    </form>
  )
}
