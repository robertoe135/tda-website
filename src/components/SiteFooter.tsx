import Link from 'next/link'

import { formatAddress, getSettings } from '@/lib/site'

/** Address, phone and email from Site settings. Replaces the old site's broken newsletter block. */
export async function SiteFooter() {
  const settings = await getSettings()
  const address = settings.address ? formatAddress(settings.address) : undefined
  return (
    <footer className="site-footer">
      <p>
        <Link href="/contact">Tillotson Design Associates</Link>
      </p>
      {address && address.lines.length > 0 && <p>{address.lines.join(', ')}</p>}
      <p>
        {settings.phone && <a href={`tel:+1${settings.phone.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '')}`}>{settings.phone}</a>}
        {settings.phone && settings.generalEmail && <span aria-hidden="true"> | </span>}
        {settings.generalEmail && <a href={`mailto:${settings.generalEmail}`}>{settings.generalEmail}</a>}
      </p>
      {(settings.socialLinks ?? []).length > 0 && (
        <ul className="footer-social">
          {settings.socialLinks!.map((s) => (
            <li key={s.id}>
              <a href={s.url} rel="noopener me">
                {s.platform === 'x' ? 'X' : s.platform.charAt(0).toUpperCase() + s.platform.slice(1)}
              </a>
            </li>
          ))}
        </ul>
      )}
    </footer>
  )
}
