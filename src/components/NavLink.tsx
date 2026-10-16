'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/** Menu link, underlined on its own section as on the current tillotsondesign.com. */
export function NavLink({ href, exact, children }: { href: string; exact?: boolean; children: React.ReactNode }) {
  const pathname = usePathname()
  const current = pathname === href || (!exact && pathname.startsWith(`${href}/`))
  return (
    <Link href={href} aria-current={current ? 'page' : undefined}>
      {children}
    </Link>
  )
}
