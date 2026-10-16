import Link from 'next/link'

import { NewsletterSignup } from '@/components/NewsletterSignup'
import { mailchimpConfigured } from '@/lib/mailchimp'
import { formatAddress, getSettings, telHref } from '@/lib/site'

/** Address, phone and email from Site settings. Replaces the old site's broken newsletter block. */
export async function SiteFooter() {
  const settings = await getSettings()
  const address = settings.address ? formatAddress(settings.address) : undefined
  const social = settings.socialLinks ?? []
  return (
    <footer className="site-footer">
      <div>
        <Link href="/contact" className="footer-name">
          Tillotson Design Associates
        </Link>
        {address?.lines.map((l) => (
          <span key={l} className="footer-line">
            {l}
          </span>
        ))}
      </div>
      <div>
        {settings.phone && (
          <a href={telHref(settings.phone)} className="footer-line">
            {settings.phone}
          </a>
        )}
        {settings.generalEmail && (
          <a href={`mailto:${settings.generalEmail}`} className="footer-line">
            {settings.generalEmail}
          </a>
        )}
      </div>
      <div className="footer-end">
        {mailchimpConfigured() && <NewsletterSignup />}
        {social.length > 0 && (
          <ul className="footer-social">
            {social.map((s) => (
              <li key={s.id}>
                <a href={s.url} rel="noopener me">
                  {s.platform === 'x'
                    ? 'X'
                    : s.platform.charAt(0).toUpperCase() + s.platform.slice(1)}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </footer>
  )
}
