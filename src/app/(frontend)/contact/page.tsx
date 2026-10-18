import { RichText } from '@payloadcms/richtext-lexical/react'
import type { Metadata } from 'next'
import Link from 'next/link'

import { formatAddress, getSettings, telHref } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Contact — Tillotson Design Associates',
  description: 'Address, phone and email for Tillotson Design Associates, New York.',
  alternates: { canonical: '/contact' },
}

const Arrow = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    aria-hidden="true"
  >
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
)

/**
 * Contact, laid out as on the old site: the statement, the details and Careers on the left, a
 * map of the studio in greys on the right (under the details on a phone). Everything comes from
 * Site settings; the map is Google's embed of the address there, loaded only when scrolled near.
 */
export default async function ContactPage() {
  const settings = await getSettings()
  const address = settings.address ? formatAddress(settings.address) : undefined
  const sameEmail = settings.generalEmail && settings.generalEmail === settings.pressEmail
  return (
    <div className="contact">
      <div className={address?.mapEmbed ? 'contact-top has-map' : 'contact-top'}>
        {settings.intro ? (
          <h1 className="contact-intro">{settings.intro}</h1>
        ) : (
          <h1 className="page-title">Contact</h1>
        )}

        <dl className="contact-list">
          {address && address.lines.length > 0 && (
            <div>
              <dt>Address</dt>
              <dd>
                <address>
                  {address.lines.map((l) => (
                    <span key={l} className="contact-line">
                      {l}
                    </span>
                  ))}
                </address>
                {address.directions && (
                  <a href={address.directions} rel="noopener" className="contact-action">
                    Get Directions <Arrow />
                  </a>
                )}
              </dd>
            </div>
          )}
          {settings.generalEmail && (
            <div>
              <dt>{sameEmail ? 'General Information & Press Inquiries' : 'General Information'}</dt>
              <dd>
                <a href={`mailto:${settings.generalEmail}`}>{settings.generalEmail}</a>
              </dd>
            </div>
          )}
          {settings.pressEmail && !sameEmail && (
            <div>
              <dt>Press Inquiries</dt>
              <dd>
                <a href={`mailto:${settings.pressEmail}`}>{settings.pressEmail}</a>
              </dd>
            </div>
          )}
          {settings.phone && (
            <div>
              <dt>Phone</dt>
              <dd>
                <a href={telHref(settings.phone)}>{settings.phone}</a>
              </dd>
            </div>
          )}
        </dl>

        {address?.mapEmbed && (
          <figure className="contact-map">
            <iframe
              src={address.mapEmbed}
              title={`Map: ${address.lines.join(', ')}`}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
            {address.directions && (
              <figcaption>
                <a href={address.directions} rel="noopener">
                  Open in Google Maps ↗
                </a>
              </figcaption>
            )}
          </figure>
        )}

        {settings.careersText && (
          <section className="contact-careers" aria-labelledby="careers">
            <h2 id="careers">Careers at TDA</h2>
            <div className="contact-careers-text">
              <RichText data={settings.careersText} />
            </div>
            {settings.careersLink ? (
              <a href={settings.careersLink} rel="noopener" className="button-outline">
                Submission Form <Arrow />
              </a>
            ) : (
              <Link href="/careers" className="button-outline">
                Submission Form <Arrow />
              </Link>
            )}
          </section>
        )}
      </div>
    </div>
  )
}
