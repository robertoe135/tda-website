import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

/**
 * The password page. src/proxy.ts shows it in place of any page while SITE_PASSWORD is set, and
 * checks what is typed here (the form posts to /unlock). Works without JavaScript.
 */
export default async function Unlock({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>
}) {
  const { next, error } = await searchParams
  const to = next?.startsWith('/') && !next.startsWith('//') ? next : '/'
  if (!process.env.SITE_PASSWORD) redirect(to)
  return (
    <main className="gate">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/tda-logo.svg" alt="Tillotson Design Associates" />
      <h1>Preview</h1>
      <p>The new site is not public yet. Enter the password to see it.</p>
      <form method="post" action="/unlock">
        <input type="hidden" name="next" value={to} />
        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          autoFocus
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'gate-error' : undefined}
        />
        {error && (
          <p id="gate-error" className="gate-error" role="alert">
            That password isn’t right.
          </p>
        )}
        <button type="submit">Enter</button>
      </form>
    </main>
  )
}
