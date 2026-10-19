import type { Metadata } from 'next'

import { ConfirmSignup } from '@/components/ConfirmSignup'
import { readSignupToken } from '@/lib/subscribe'

export const metadata: Metadata = {
  title: 'Confirm your subscription — Tillotson Design Associates',
  robots: { index: false, follow: false },
}

/**
 * Where the sign-up email's link leads. Opening it changes nothing: mail scanners open links on
 * their own, so the address joins the list only when its owner presses the button.
 */
export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>
}) {
  const { t } = await searchParams
  const email = readSignupToken(t)
  return (
    <div className="subscribe-confirm">
      <h1 className="page-title page-title-large">Newsletter</h1>
      {email ? (
        <ConfirmSignup token={t!} email={email} />
      ) : (
        <p className="subscribe-note">
          This link has expired or is incomplete. Sign up again with the box at the bottom of any
          page.
        </p>
      )}
    </div>
  )
}
