'use client'

import { useActionState } from 'react'

import { applyAction } from '@/app/(frontend)/careers/actions'
import type { ApplicationResult } from '@/lib/careers'

/** The careers form. Works without JavaScript too; with it, errors show without a reload. */
export function ApplicationForm({ startedAt, maxMb }: { startedAt: number; maxMb: number }) {
  const [state, action, pending] = useActionState<ApplicationResult | null, FormData>(applyAction, null)
  const errors = state && !state.ok ? state.errors : {}

  if (state?.ok) {
    return (
      <div className="form-done" role="status">
        <h2>Thank you</h2>
        <p>Your application has been sent to our team. We will be in touch if there is a fit.</p>
      </div>
    )
  }

  const field = (name: keyof typeof errors) =>
    errors[name] ? { 'aria-invalid': true, 'aria-describedby': `${name}-error` } : {}
  const error = (name: keyof typeof errors) =>
    errors[name] ? (
      <p id={`${name}-error`} className="field-error">
        {errors[name]}
      </p>
    ) : null

  return (
    <form action={action} className="application-form" noValidate>
      <input type="hidden" name="startedAt" value={startedAt} />
      {/* Hidden from people; bots fill it in. */}
      <div className="visually-hidden" aria-hidden="true">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="field">
        <label htmlFor="name">Name</label>
        <input id="name" name="name" type="text" autoComplete="name" required {...field('name')} />
        {error('name')}
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" autoComplete="email" required {...field('email')} />
          {error('email')}
        </div>
        <div className="field">
          <label htmlFor="phone">
            Phone <span className="optional">optional</span>
          </label>
          <input id="phone" name="phone" type="tel" autoComplete="tel" />
        </div>
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor="position">
            Position of interest <span className="optional">optional</span>
          </label>
          <input id="position" name="position" type="text" placeholder="e.g. Lighting Designer" />
        </div>
        <div className="field">
          <label htmlFor="portfolioUrl">
            Portfolio or website <span className="optional">optional</span>
          </label>
          <input id="portfolioUrl" name="portfolioUrl" type="url" inputMode="url" autoComplete="url" {...field('portfolioUrl')} />
          {error('portfolioUrl')}
        </div>
      </div>
      <div className="field">
        <label htmlFor="cv">CV (PDF, up to {maxMb} MB)</label>
        <input id="cv" name="cv" type="file" accept="application/pdf,.pdf" required {...field('cv')} />
        {error('cv')}
      </div>
      <div className="field">
        <label htmlFor="message">
          Message <span className="optional">optional</span>
        </label>
        <textarea id="message" name="message" rows={6} />
      </div>
      {errors.form && (
        <p className="field-error" role="alert">
          {errors.form}
        </p>
      )}
      <button type="submit" className="button-solid" disabled={pending}>
        {pending ? 'Sending…' : 'Send application'}
      </button>
      <p className="form-note">
        Your application is emailed to our team and kept only as long as we need it to consider you.
      </p>
    </form>
  )
}
