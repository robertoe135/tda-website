import Link from 'next/link'

import { NewsletterSignup } from '@/components/NewsletterSignup'
import { signupConfigured } from '@/lib/subscribe'
import { filterHref, getPublishedProjects, getTypologies } from '@/lib/projects'
import { formatAddress, getSettings, telHref } from '@/lib/site'

const SOCIAL_LABEL: Record<string, string> = { x: 'X', linkedin: 'LinkedIn', youtube: 'YouTube' }

/**
 * Footer 1 (black): the logo and the studio's statement, then the studio's details, the site's
 * pages, every category that has published work, the newsletter (when Resend is set up) and
 * social links, and the legal line. Everything comes from Site settings and the portfolio, so
 * marketing edits it in the admin.
 */
export async function SiteFooter() {
  const [settings, projects, typologies] = await Promise.all([
    getSettings(),
    getPublishedProjects(),
    getTypologies(),
  ])
  const address = settings.address ? formatAddress(settings.address) : undefined
  const social = settings.socialLinks ?? []
  const used = new Set(projects.flatMap((p) => p.typologies.map((t) => t.slug)))
  const categories = typologies.filter((t) => t.slug && used.has(t.slug))
  const newsletter = signupConfigured()

  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-top">
          <Link href="/" className="footer-home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/tda-logo.svg"
              alt="Tillotson Design Associates"
              width={1000}
              height={414}
              className="footer-logo"
            />
          </Link>
          {settings.intro && <p className="footer-statement">{settings.intro}</p>}
        </div>

        <div className="footer-cols">
          <div>
            <h2 className="footer-heading">{settings.address?.city || 'Studio'}</h2>
            <p className="footer-text">
              {address?.lines.map((l) => (
                <span key={l} className="footer-line">
                  {l}
                </span>
              ))}
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
            </p>
          </div>
          <nav aria-label="Studio">
            <h2 className="footer-heading">Studio</h2>
            <ul className="footer-links">
              <li>
                <Link href="/projects">Portfolio</Link>
              </li>
              <li>
                <Link href="/timeline">Timeline</Link>
              </li>
              <li>
                <Link href="/about">Profile</Link>
              </li>
              <li>
                <Link href="/about/team">Team</Link>
              </li>
              <li>
                <Link href="/about/collaborators">Collaborators</Link>
              </li>
              <li>
                <Link href="/careers">Careers</Link>
              </li>
              <li>
                <Link href="/contact">Contact</Link>
              </li>
            </ul>
          </nav>
          {categories.length > 0 && (
            <nav aria-label="Work by category">
              <h2 className="footer-heading">Work</h2>
              <ul className="footer-links footer-links-split">
                {categories.map((t) => (
                  <li key={t.slug}>
                    <Link href={filterHref('typology', t.slug!)}>{t.name}</Link>
                  </li>
                ))}
              </ul>
            </nav>
          )}
          {(newsletter || social.length > 0) && (
            <div>
              {newsletter && <NewsletterSignup />}
              {social.length > 0 && (
                <ul className="footer-social">
                  {social.map((s) => (
                    <li key={s.id}>
                      <a href={s.url} rel="noopener me">
                        {SOCIAL_LABEL[s.platform] ??
                          s.platform.charAt(0).toUpperCase() + s.platform.slice(1)}{' '}
                        ↗
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="footer-legal">
          <span>© {new Date().getFullYear()} Tillotson Design Associates</span>
          <a href="#top">Back to top ↑</a>
        </div>
      </div>
    </footer>
  )
}
