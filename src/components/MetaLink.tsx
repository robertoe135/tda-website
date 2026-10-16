import Link from 'next/link'

/**
 * A metadata value (location, architect, category...). Always a link, to a filtered view or a
 * detail page, never a dead end. Styled as plain text like the current tillotsondesign.com.
 */
export function MetaLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link className="meta-link" href={href}>
      {children}
    </Link>
  )
}

/** "New York, NY | Kohn Pedersen Fox": the old site's label line, with each part linked. */
export function MetaLine({ items }: { items: { href: string; label: string }[] }) {
  return (
    <>
      {items.map((item, i) => (
        <span key={item.href}>
          {i > 0 && <span aria-hidden="true"> | </span>}
          <MetaLink href={item.href}>{item.label}</MetaLink>
        </span>
      ))}
    </>
  )
}
