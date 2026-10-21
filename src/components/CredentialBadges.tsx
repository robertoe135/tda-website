import Link from 'next/link'

import type { Badge } from '@/lib/site'

/**
 * A person's credentials under their name (CLD, LEED AP…). Each links to the team page showing
 * everyone who holds it; the full name, when marketing has entered one, shows on hover and is
 * read out by screen readers.
 */
export function CredentialBadges({ badges, className }: { badges: Badge[]; className?: string }) {
  if (!badges.length) return null
  return (
    <ul className={className ? `badges ${className}` : 'badges'} aria-label="Credentials">
      {badges.map((b) => (
        <li key={b.slug}>
          <Link href={`/about/team?credential=${encodeURIComponent(b.slug)}`} className="badge" title={b.fullName ?? undefined}>
            {b.fullName ? <abbr title={b.fullName}>{b.name}</abbr> : b.name}
          </Link>
        </li>
      ))}
    </ul>
  )
}
