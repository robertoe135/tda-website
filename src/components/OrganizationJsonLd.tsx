import { getSettings } from '@/lib/site'
import { siteUrl } from '@/lib/seo'

/**
 * TDA's name, address, phone and profiles for search engines (schema.org), from Site
 * settings only: nothing here is typed in twice, and empty settings are left out.
 */
export async function OrganizationJsonLd() {
  const s = await getSettings()
  const a = s.address ?? {}
  const data = {
    '@context': 'https://schema.org',
    '@type': 'ProfessionalService',
    name: 'Tillotson Design Associates',
    url: siteUrl(),
    logo: `${siteUrl()}/tda-logo.svg`,
    ...(a.street
      ? {
          address: {
            '@type': 'PostalAddress',
            streetAddress: [a.street, a.suite].filter(Boolean).join(' '),
            addressLocality: a.city || undefined,
            addressRegion: a.region || undefined,
            postalCode: a.postalCode || undefined,
            addressCountry: 'US',
          },
        }
      : {}),
    ...(s.phone ? { telephone: s.phone } : {}),
    ...(s.generalEmail ? { email: s.generalEmail } : {}),
    ...((s.socialLinks ?? []).length ? { sameAs: s.socialLinks!.map((l) => l.url) } : {}),
  }
  return (
    <script
      type="application/ld+json"
      // JSON from our own settings; "<" is escaped so no text can close the script tag.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  )
}
