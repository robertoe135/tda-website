import Link from 'next/link'

/** "About / Team / Name": where a page sits, each step but the last a link. */
export function Breadcrumb({
  trail,
  current,
}: {
  trail: { href: string; label: string }[]
  current: string
}) {
  return (
    <nav aria-label="Breadcrumb" className="breadcrumb">
      {trail.map((t) => (
        <span key={t.href}>
          <Link href={t.href}>{t.label}</Link>
          {' / '}
        </span>
      ))}
      <span aria-current="page">{current}</span>
    </nav>
  )
}
