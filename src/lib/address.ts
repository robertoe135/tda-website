import type { SiteSetting } from '../payload-types'

/** The office address as lines, plus map links. No database: safe to import from collections. */
export function formatAddress(address: NonNullable<SiteSetting['address']>) {
  const line1 = [address.street, address.suite].filter(Boolean).join(' ')
  const line2 = [address.city, [address.region, address.postalCode].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(', ')
  const query = [address.street, line2].filter(Boolean).join(', ')
  return {
    lines: [line1, line2].filter(Boolean),
    directions: query
      ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}`
      : undefined,
    /** Google's keyless embed of the address, for the Contact page map. */
    mapEmbed: query
      ? `https://maps.google.com/maps?q=${encodeURIComponent(query)}&z=15&output=embed`
      : undefined,
  }
}
